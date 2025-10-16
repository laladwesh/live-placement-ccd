// backend/src/models/company.model.js
import mongoose from "mongoose";

const CompanySchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true },
  POCs: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], // Array of POC user IDs
  venue: { type: String, trim: true },
  shortlistedStudents: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], // Student user IDs
  waitlistedStudents: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], // Student user IDs
  placedStudents: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], // Student user IDs
  isProcessCompleted: { type: Boolean, default: false }
}, {
  timestamps: true
});

CompanySchema.index({ name: 1 });

export default mongoose.model("Company", CompanySchema);
