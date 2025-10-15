/**
 * seed.js
 * Run with: node seed.js
 *
 * Creates:
 * - 1 Superadmin (Google OAuth)
 * - 1 Admin (Google OAuth)
 * - 2 POCs (Local password)
 * - 2 Officials (Local password)
 *
 * Note: Students should be added via CSV upload using sample-students.csv
 * 
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
      "guptaavinash302@gmail.com",
      "vibhugupta908@gmail.com",
      "laladwesh@gmail.com",
      "poc1@iitg.ac.in",
      "poc2@iitg.ac.in",
      "official1@iitg.ac.in",
      "official2@iitg.ac.in"
    ];

    await User.deleteMany({ email: { $in: emailsToRemove } });
    console.log("Removed existing seed emails (if any)");

    const salt = await bcrypt.genSalt(10);

    const users = [
      // Google OAuth - Superadmin
      {
        name: "Avinash Gupta",
        email: "guptaavinash302@gmail.com",
        role: "superadmin",
        isAllowed: true
      },

      // Google OAuth - Superadmin (New)
      {
        name: "Vibhu Gupta",
        email: "vibhugupta908@gmail.com",
        role: "superadmin",
        isAllowed: true
      },

      // Google OAuth - Admin
      {
        name: "Lala Dwesh",
        email: "laladwesh@gmail.com",
        role: "admin",
        isAllowed: true
      },

      // Local Password - POCs
      {
        name: "POC John Doe",
        email: "poc1@iitg.ac.in",
        role: "poc",
        password: "PocPass123!",
        isAllowed: true,
        phoneNumber: "+91-9876543210"
      },
      {
        name: "POC Jane Smith",
        email: "poc2@iitg.ac.in",
        role: "poc",
        password: "PocPass123!",
        isAllowed: true,
        phoneNumber: "+91-9876543211"
      },

      // Local Password - Officials
      {
        name: "Official Rajesh Kumar",
        email: "official1@iitg.ac.in",
        role: "official",
        password: "OfficialPass123!",
        isAllowed: true,
        phoneNumber: "+91-9876543220"
      },
      {
        name: "Official Priya Singh",
        email: "official2@iitg.ac.in",
        role: "official",
        password: "OfficialPass123!",
        isAllowed: true,
        phoneNumber: "+91-9876543221"
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
        phoneNumber: u.phoneNumber || "",
        providers: u.providers || []
      });

      await doc.save();
      if (u.password) {
        console.log(`Created: ${u.email} (role: ${u.role}) — password: ${u.password}`);
      } else {
        console.log(`Created: ${u.email} (role: ${u.role}) — OAuth allowed`);
      }
    }

    console.log("\n Seeding complete! User accounts created:\n");
    
    console.log(" GOOGLE OAUTH USERS:");
    console.log("   Superadmin: guptaavinash302@gmail.com");
    console.log("   Superadmin: vibhugupta908@gmail.com");
    console.log("   Admin:      laladwesh@gmail.com");
    
    console.log("\n LOCAL PASSWORD USERS:");
    console.log("   POC 1: poc1@iitg.ac.in → Password: PocPass123!");
    console.log("   POC 2: poc2@iitg.ac.in → Password: PocPass123!");
    console.log("   Official 1: official1@iitg.ac.in → Password: OfficialPass123!");
    console.log("   Official 2: official2@iitg.ac.in → Password: OfficialPass123!");
    
    console.log("\n Login Instructions:");
    console.log("  • Google users: Click 'Sign in with Google' button");
    console.log("  • Local users: Use email + password shown above");
    console.log("\n Student Accounts:");
    console.log("  • Students should be added via CSV upload");
    console.log("  • Use sample-students.csv as reference");
    console.log("  • CSV Format: rollNumber,email,name,phoneNumber,status");
    process.exit(0);
  } catch (err) {
    console.error("Seed error:", err);
    process.exit(1);
  }
};

main();
