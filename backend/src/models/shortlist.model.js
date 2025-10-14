// backend/src/models/shortlist.model.js
import mongoose from "mongoose";

export const Stage = {
  SHORTLISTED: "SHORTLISTED",
  WAITLISTED: "WAITLISTED",
  R1: "R1",
  R2: "R2",
  R3: "R3",
  R4: "R4",
  OFFERED: "OFFERED",
  REJECTED: "REJECTED"
};

const ShortlistSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true },
  currentStage: { type: String, enum: Object.values(Stage), default: Stage.SHORTLISTED },
  remarks: { type: String, default: "" },
  updatedByPocId: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // POC who updated
  updatedAt: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now }
}, {
  timestamps: false
});

// ensure one shortlist entry per student+company
ShortlistSchema.index({ student: 1, company: 1 }, { unique: true });

export default mongoose.model("Shortlist", ShortlistSchema);
