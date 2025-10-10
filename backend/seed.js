/**
 * seed.js
 * Run with: node src/utils/seed.js
 *
 * Creates:
 * - 2 Microsoft (Azure) users (isAllowed: true)
 * - 2 Google users (isAllowed: true)
 * - 1 local user with password (isAllowed: true)
 * - 1 admin user (with password, isAllowed: true)
 *
 * Make sure your MONGO_URI is set in .env or environment before running.
 */

import dotenv from "dotenv";
dotenv.config();

import bcrypt from "bcryptjs";
import User from "./src/models/user.model.js";
import { connectDB } from "./src/config/db.js";

const main = async () => {
  try {
    const MONGO_URI = process.env.MONGO_URI;
    if (!MONGO_URI) {
      console.error("Please set MONGO_URI in .env");
      process.exit(1);
    }

    await connectDB(MONGO_URI);

    // emails to remove (so seed is idempotent)
    const emailsToRemove = [
      "g.avinash@iitg.ac.in",
      "spirit@iitg.ac.in",
      "guptaavinash302@gmail.com",
      "laladwesh@gmail.com",
      "localuser@iitg.ac.in",
      "admin@iitg.ac.in"
    ];

    await User.deleteMany({ email: { $in: emailsToRemove } });
    console.log("Removed existing seed emails (if any)");

    const salt = await bcrypt.genSalt(10);

    const users = [
      // Microsoft (Azure) users — these will sign in via Azure (email must match)
      {
        name: "G Avinash (Azure)",
        email: "g.avinash@iitg.ac.in",
        role: "student",
        isAllowed: true
      },
      {
        name: "Spirit (Azure)",
        email: "spirit@iitg.ac.in",
        role: "student",
        isAllowed: true
      },

      // Google users — these will sign in via Google (email must match)
      {
        name: "Avinash Gupta (Google)",
        email: "guptaavinash302@gmail.com",
        role: "student",
        isAllowed: true
      },
      {
        name: "Lala Dwesh (Google)",
        email: "laladwesh@gmail.com",
        role: "student",
        isAllowed: true
      },

      // Local credential user (email + password)
      {
        name: "Local Student",
        email: "localuser@iitg.ac.in",
        role: "student",
        password: "LocalPass123!" ,
        isAllowed: true
      },

      // Admin user (for management)
      {
        name: "Placement Admin",
        email: "admin@iitg.ac.in",
        role: "admin",
        password: "AdminPass123!",
        isAllowed: true
      }
    ];

    for (const u of users) {
      let passwordHash;
      if (u.password) {
        passwordHash = await bcrypt.hash(u.password, salt);
      }

      const doc = new User({
        name: u.name,
        email: u.email,
        role: u.role,
        passwordHash,
        isAllowed: !!u.isAllowed,
        providers: u.providers || []
      });

      await doc.save();
      if (u.password) {
        console.log(`Created: ${u.email} (role: ${u.role}) — password: ${u.password}`);
      } else {
        console.log(`Created: ${u.email} (role: ${u.role}) — OAuth allowed`);
      }
    }

    console.log("\nSeeding complete. You can now:");
    console.log("- Sign in locally with the local user:");
    console.log("  email: localuser@iitg.ac.in  password: LocalPass123!");
    console.log("- Sign in as admin:");
    console.log("  email: admin@iitg.ac.in  password: AdminPass123!");
    console.log("- Sign in via Azure using the Microsoft accounts:");
    console.log("  g.avinash@iitg.ac.in  and  spirit@iitg.ac.in");
    console.log("- Sign in via Google using the Gmail accounts:");
    console.log("  guptaavinash302@gmail.com  and  laladwesh@gmail.com");
    process.exit(0);
  } catch (err) {
    console.error("Seed error:", err);
    process.exit(1);
  }
};

main();
