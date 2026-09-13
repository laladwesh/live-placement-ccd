import mongoose from "mongoose";

const sharedFileSchema = new mongoose.Schema({
  originalName: { type: String, required: true },
  fileName:     { type: String, required: true, unique: true },
  fileSize:     { type: Number, required: true },
  mimeType:     { type: String, required: true },
  isPermanent:  { type: Boolean, default: false },
  expiresAt: {
    type: Date,
    required: function () { return !this.isPermanent; },
  },
  downloadCount: { type: Number, default: 0 },
  uploadedBy:    { type: String, default: "admin" },
  shareUrl:      { type: String, required: true, unique: true },
}, { timestamps: true });

// TTL index — MongoDB auto-removes expired docs
sharedFileSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const SharedFile = mongoose.model("SharedFile", sharedFileSchema);
export default SharedFile;
