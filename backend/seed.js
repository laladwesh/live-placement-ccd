/**
 * seed.js
 * Run with: node seed.js
 *
 * CLEAN SEED SCRIPT:
 * - Deletes ALL existing data from database
 * - Creates only 1 Admin: guptaavinash302@gmail.com
 * - Students, POCs, Companies, etc. should be added via Admin Panel
 * 
 */

import dotenv from "dotenv";
dotenv.config();

import User from "./src/models/user.model.js";
import Student from "./src/models/student.model.js";
import Company from "./src/models/company.model.js";
import Shortlist from "./src/models/shortlist.model.js";
import Offer from "./src/models/offer.model.js";
import { connectDB } from "./src/config/db.js";

const main = async () => {
  try {
    const MONGO_URI = process.env.MONGO_URI;
    if (!MONGO_URI) {
      console.error("❌ Please set MONGO_URI in .env");
      process.exit(1);
    }

    await connectDB(MONGO_URI);

    console.log("🗑️  Cleaning database...\n");

    // Delete ALL data from all collections
    await User.deleteMany({});
    await Student.deleteMany({});
    await Company.deleteMany({});
    await Shortlist.deleteMany({});
    await Offer.deleteMany({});

    console.log("✅ Database cleaned successfully!");
    console.log("   - Users: 0");
    console.log("   - Students: 0");
    console.log("   - Companies: 0");
    console.log("   - Shortlists: 0");
    console.log("   - Offers: 0\n");

    // Create only ONE admin
    const admin = new User({
      name: "Avinash Gupta",
      emailId: "guptaavinash302@gmail.com",
      role: "admin",
      isAllowed: true,
      phoneNo: "",
      providers: []
    });

    await admin.save();

    console.log("✅ Admin account created!\n");
    console.log("═══════════════════════════════════════════════════");
    console.log("   ADMIN LOGIN");
    console.log("═══════════════════════════════════════════════════");
    console.log("   Email: guptaavinash302@gmail.com");
    console.log("   Login: Use 'Sign in with Google' button");
    console.log("═══════════════════════════════════════════════════\n");
    
    console.log("📋 Next Steps:");
    console.log("   1. Start backend: cd backend && npm run dev");
    console.log("   2. Start frontend: cd backend/client && npm start");
    console.log("   3. Login as admin with Google OAuth");
    console.log("   4. Add Companies via Admin Panel");
    console.log("   5. Add POCs via Admin Panel");
    console.log("   6. Upload Students via CSV in Admin Panel");
    console.log("   7. Assign POCs to Companies\n");

    process.exit(0);
  } catch (err) {
    console.error("❌ Seed error:", err);
    process.exit(1);
  }
};

main();
