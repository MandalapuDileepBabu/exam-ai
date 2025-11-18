// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyC8anNX_cq-cz2bfJbCOZiHeNwz1BkqA9E",
  authDomain: "newcivic-a44c4.firebaseapp.com",
  projectId: "newcivic-a44c4",
  storageBucket: "newcivic-a44c4.firebasestorage.app",
  messagingSenderId: "742000197349",
  appId: "1:742000197349:web:a73778c8e2a6b491fc1e0c",
  measurementId: "G-4GF6PWE41H"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// 🔹 Initialize services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const provider = new GoogleAuthProvider();
