import express, { Request, Response } from "express";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { auth, db } from "../config/firebase";
import { ensureUserDriveStructure } from "../services/driveService";

dotenv.config();
const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "change-me";

// 🔹 Helper to sign backend JWT
function signServerToken(payload: object) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "1h" });
}

// ✅ REGISTER
router.post("/register", async (req: Request, res: Response) => {
  try {
    const { fullName, email, password, role } = req.body;

    if (!fullName || !email || !password)
      return res.status(400).json({ message: "Full name, email, and password are required." });
    if (password.length < 6)
      return res.status(400).json({ message: "Password must be at least 6 characters long." });

    const userRecord = await auth.createUser({
      email,
      password,
      displayName: fullName,
    });

    const userDoc = {
      uid: userRecord.uid,
      fullName: userRecord.displayName || fullName,
      email: userRecord.email,
      role: role || "user",
      createdAt: new Date().toISOString(),
    };

    await db.collection("users").doc(userRecord.uid).set(userDoc);

    // ✅ Drive structure setup
    try {
      await ensureUserDriveStructure(userRecord.uid);
      console.log(`📁 Drive folder structure ensured for ${userRecord.uid}`);
    } catch (driveErr) {
      console.error("⚠️ Drive folder setup failed:", driveErr);
    }

    const serverToken = signServerToken({
  uid: userRecord.uid,
  email: userRecord.email,
  fullName: userRecord.displayName || fullName,
  picture: "",
  auth_time: Date.now(),
  role: userDoc.role,
});


    res.status(201).json({
      success: true,
      message: "User registered successfully",
      user: userDoc,
      token: serverToken,
    });
  } catch (err: any) {
    console.error("❌ Register error:", err);
    res.status(500).json({ message: err.message || "Registration failed." });
  }
});

// ✅ LOGIN
router.post("/login", async (req: Request, res: Response) => {
  try {
    const { idToken } = req.body;
    if (!idToken) return res.status(400).json({ message: "Firebase ID token required." });

    const decoded = await auth.verifyIdToken(idToken);
    const uid = decoded.uid;

    const userSnap = await db.collection("users").doc(uid).get();
    if (!userSnap.exists)
      return res.status(404).json({ message: "User not found in Firestore." });

    const userDoc = userSnap.data();

    // ✅ Ensure Drive folder exists
    if (!userDoc?.driveRootId) {
      try {
        const driveRootId = await ensureUserDriveStructure(uid);
        await db.collection("users").doc(uid).update({ driveRootId });
        console.log(`📁 Drive folder created for returning user: ${uid}`);
      } catch (driveErr) {
        console.error("⚠️ Drive folder setup on login failed:", driveErr);
      }
    }

    const serverToken = signServerToken({
  uid,
  email: userDoc?.email,
  fullName: userDoc?.fullName,
  picture: userDoc?.photoURL || "",
  auth_time: Date.now(),
  role: userDoc?.role || "user",
});


    res.status(200).json({
      message: "Login successful",
      user: userDoc,
      token: serverToken,
    });
  } catch (err: any) {
    console.error("❌ Login error:", err);
    res.status(401).json({ message: "Invalid Firebase ID token", error: err.message });
  }
});


// ✅ GOOGLE LOGIN or SIGNUP
router.post("/google", async (req: Request, res: Response) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ message: "Missing Google ID token" });
    }

    // 🔍 Verify Firebase ID token
    const decoded = await auth.verifyIdToken(token);
    const { uid, name, email, picture } = decoded;

    if (!email) {
      return res.status(400).json({ message: "Google account missing email." });
    }

    const userRef = db.collection("users").doc(uid);
    const userSnap = await userRef.get();

    let userData: any;

    if (!userSnap.exists) {
      // 🆕 Create new user entry in Firestore
      userData = {
        uid,
        fullName: name || "Google User",
        email,
        photoURL: picture || "",
        role: "user",
        authProvider: "google",
        createdAt: new Date().toISOString(),
      };

      await userRef.set(userData);
      console.log(`🆕 New Google user created: ${email}`);

      // ✅ Create Drive structure for this user
      try {
        const driveRootId = await ensureUserDriveStructure(uid);
        await userRef.update({ driveRootId });
        console.log(`📁 Drive folder created for new Google user (${uid})`);
      } catch (driveErr) {
        console.error("⚠️ Drive setup failed for new Google user:", driveErr);
      }
    } else {
      // 🔁 Existing user
      userData = userSnap.data();

      // ✅ Ensure Drive folder exists (fixes missing root folder for returning users)
      if (!userData?.driveRootId) {
        try {
          const driveRootId = await ensureUserDriveStructure(uid);
          await userRef.update({ driveRootId });
          console.log(`📁 Drive folder ensured for returning Google user (${uid})`);
        } catch (driveErr) {
          console.error("⚠️ Drive setup failed for returning Google user:", driveErr);
        }
      }
    }

    // 🔐 Issue backend JWT (for Exam-AI API access)
    const serverToken = signServerToken({
  uid,
  email,
  fullName: userData.fullName,
  picture: userData.photoURL || picture || "",
  auth_time: Date.now(),
  role: userData?.role || "user",
});


    // ✅ Response
    res.status(200).json({
      success: true,
      message: userSnap.exists
        ? "Welcome back! Google login successful."
        : "New Google user registered successfully.",
      user: userData,
      token: serverToken,
    });
  } catch (err: any) {
    console.error("❌ Google Auth error:", err);
    res.status(401).json({
      message: "Invalid or expired Google token",
      error: err.message,
    });
  }
});



// ✅ Middleware: verify backend JWT
function verifyJWT(req: Request, res: Response, next: Function) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res
      .status(401)
      .json({ message: "Unauthorized: Missing or invalid token" });
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    (req as any).user = decoded;
    next();
  } catch (err) {
    res.status(403).json({ message: "Invalid or expired token" });
  }
}

// ✅ Promote a user to admin (superadmin only)
router.post("/make-admin/:uid", verifyJWT, async (req: Request, res: Response) => {
  try {
    const requester = (req as any).user;
    const { uid } = req.params;

    if (requester.role !== "superadmin") {
      return res
        .status(403)
        .json({ message: "Forbidden: Only superadmin can assign admins." });
    }

    await db.collection("users").doc(uid).update({ role: "admin" });

    res.status(200).json({ message: `✅ User ${uid} promoted to admin.` });
  } catch (err: any) {
    console.error("❌ Make admin error:", err);
    res
      .status(500)
      .json({ message: "Failed to promote user", error: err.message });
  }
});

// ✅ Remove admin (superadmin only)
router.post("/remove-admin/:uid", verifyJWT, async (req: Request, res: Response) => {
  try {
    const requester = (req as any).user;
    const { uid } = req.params;

    if (requester.role !== "superadmin") {
      return res
        .status(403)
        .json({ message: "Forbidden: Only superadmin can remove admins." });
    }

    await db.collection("users").doc(uid).update({ role: "user" });

    res.status(200).json({ message: `✅ User ${uid} demoted to user.` });
  } catch (err: any) {
    console.error("❌ Remove admin error:", err);
    res
      .status(500)
      .json({ message: "Failed to demote admin", error: err.message });
  }
});

// ✅ GET: Fetch all users (admin-only)
router.get("/users", verifyJWT, async (req: Request, res: Response) => {
  const requester = (req as any).user;
  if (requester.role !== "admin" && requester.role !== "superadmin") {
    return res.status(403).json({ message: "Forbidden: Admins only" });
  }

  try {
    const snapshot = await db
      .collection("users")
      .orderBy("createdAt", "desc")
      .get();
    const users = snapshot.docs.map((doc) => doc.data());
    res
      .status(200)
      .json({ message: "✅ Users fetched", count: users.length, users });
  } catch (err: any) {
    console.error("❌ Fetch users error:", err);
    res
      .status(500)
      .json({ message: "Error fetching users", error: err.message });
  }
});

// ✅ GET: Single user
router.get("/users/:uid", verifyJWT, async (req: Request, res: Response) => {
  try {
    const { uid } = req.params;
    const docSnap = await db.collection("users").doc(uid).get();

    if (!docSnap.exists) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ message: "✅ User found", user: docSnap.data() });
  } catch (err: any) {
    console.error("❌ Fetch user error:", err);
    res
      .status(500)
      .json({ message: "Error fetching user", error: err.message });
  }
});

// ✅ GET: Logged-in user's profile
router.get("/me", verifyJWT, async (req: Request, res: Response) => {
  try {
    const decoded = (req as any).user;

    if (!decoded?.uid) {
      return res.status(401).json({ message: "Unauthorized: Invalid token" });
    }

    const userRef = db.collection("users").doc(decoded.uid);
    const docSnap = await userRef.get();
    const userData = docSnap.exists ? docSnap.data() || {} : {};

    const normalized = {
      uid: decoded.uid,
      fullName: userData.fullName ?? decoded.fullName ?? "",
      email: userData.email ?? decoded.email ?? "",
      phone: userData.phone ?? "",
      description: userData.description ?? "",
      location: userData.location ?? "",

      // 🚀 KEEP EXACT URLs FROM FIRESTORE, DO NOT OVERRIDE
      photoURL: userData.photoURL || null,
      backgroundURL: userData.backgroundURL || null,

      achievements: Array.isArray(userData.achievements)
        ? userData.achievements
        : [],

      examCount: userData.examCount ?? 0,
      accuracy: userData.accuracy ?? null,
      createdAt: userData.createdAt ?? decoded.auth_time ?? null,
      updatedAt: userData.updatedAt ?? null,
    };

    return res.status(200).json({
      success: true,
      message: "Profile fetched successfully",
      user: normalized,
    });
  } catch (err: any) {
    return res.status(500).json({
      message: "Error fetching profile",
      error: err.message,
    });
  }
});





// ✅ UPDATE PROFILE
router.put("/update", verifyJWT, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;

    if (!user?.uid) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const {
      fullName,
      phone,
      description,
      location,
      photoURL,
      backgroundURL,
      achievements,
      preferredExam, // ⭐ NEW FIELD
    } = req.body;

    const updateData: any = {
      updatedAt: new Date().toISOString(),
    };

    if (fullName !== undefined) updateData.fullName = fullName;
    if (phone !== undefined) updateData.phone = phone;
    if (description !== undefined) updateData.description = description;
    if (location !== undefined) updateData.location = location;

    // Only update if non-empty
    if (photoURL && photoURL.trim() !== "") {
      updateData.photoURL = photoURL;
    }

    // Can update or clear
    if (backgroundURL !== undefined) {
      updateData.backgroundURL = backgroundURL;
    }

    if (achievements !== undefined) {
      updateData.achievements = achievements;
    }

    // ⭐ Save preferred exam
    if (preferredExam !== undefined) {
      updateData.preferredExam = preferredExam;
    }

    await db.collection("users").doc(user.uid).set(updateData, { merge: true });

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      updatedFields: updateData,
    });

  } catch (err: any) {
    console.error("Update error:", err);
    return res.status(500).json({ message: "Failed to update profile" });
  }
});






export default router;
