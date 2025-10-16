// backend/src/models/offer.model.js
import mongoose from "mongoose";

// Admin approval status
export const ApprovalStatus = {
  PENDING: "PENDING",       // POC created, waiting for admin approval
  APPROVED: "APPROVED",     // Admin approved, sent to student
  REJECTED: "REJECTED"      // Admin rejected
};

// Student response status
export const OfferStatus = {
  PENDING: "PENDING",       // Waiting for student response
  ACCEPTED: "ACCEPTED",     // Student accepted
  DECLINED: "DECLINED"      // Student declined
};

const OfferSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true },
  
  // Admin approval workflow
  approvalStatus: { 
    type: String, 
    enum: Object.values(ApprovalStatus), 
    default: ApprovalStatus.PENDING 
  },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // Admin who approved
  approvedAt: { type: Date },
  
  // Student response
  offerStatus: { 
    type: String, 
    enum: Object.values(OfferStatus), 
    default: OfferStatus.PENDING 
  },
  acceptedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // Student who accepted
  acceptedAt: { type: Date },
  
  // Additional details
  venue: { type: String },
  remarks: { type: String },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

// Indexes for efficient querying
OfferSchema.index({ studentId: 1 });
OfferSchema.index({ companyId: 1 });
OfferSchema.index({ approvalStatus: 1 });
OfferSchema.index({ offerStatus: 1 });

export default mongoose.model("Offer", OfferSchema);
