// tests/superadmin.test.ts
import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../src/app"; // If you export express app in app.ts (recommended)

describe("Superadmin routes", () => {
  it("should reject unauthenticated create-admin", async () => {
    const res = await request(app).post("/api/superadmin/create-admin").send({ uid: "x", email: "x", fullName: "x" });
    expect([401, 403]).toContain(res.status); // either unauthorized or forbidden
  });
});
