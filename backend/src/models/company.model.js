// backend/src/models/company.model.js
import mongoose from "mongoose";

const CompanySchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true },
  venue: { type: String, trim: true },
  description: { type: String },
  maxRounds: { type: Number, default: 4 },
  createdAt: { type: Date, default: Date.now },
}, {
  timestamps: true
});

CompanySchema.index({ name: 1 });

export default mongoose.model("Company", CompanySchema);
