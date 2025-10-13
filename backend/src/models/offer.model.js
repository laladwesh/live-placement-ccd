// backend/src/models/offer.model.js
import mongoose from "mongoose";

export const OfferStatus = {
  PENDING: "PENDING",
  ACCEPTED: "ACCEPTED",
  DECLINED: "DECLINED"
};

const OfferSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true },
  offerStatus: { type: String, enum: Object.values(OfferStatus), default: OfferStatus.PENDING },
  remarks: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

// A student may have multiple offers, but you can add an index to find pending quickly
OfferSchema.index({ student: 1 });
OfferSchema.index({ company: 1 });
OfferSchema.index({ offerStatus: 1 });

export default mongoose.model("Offer", OfferSchema);
