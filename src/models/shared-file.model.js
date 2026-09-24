import mongoose from "mongoose";

const sharedFileSchema = new mongoose.Schema({
  originalName: { type: String, required: true },
  fileName:     { type: String, unique: true, sparse: true },
  fileSize:     { type: Number, default: 0 },
  mimeType:     { type: String, default: "application/octet-stream" },
  isPermanent:  { type: Boolean, default: false },
  expiresAt: {
    type: Date,
    required: function () { return !this.isPermanent && !this.isLink && !this.isText; },
  },
  downloadCount: { type: Number, default: 0 },
  uploadedBy:    { type: String, default: "admin" },
  shareUrl:      { type: String, required: true, unique: true },
  isLink:        { type: Boolean, default: false },
  linkUrl:       { type: String },
  isText:        { type: Boolean, default: false },
  textContent:   { type: String },
}, { timestamps: true });

// TTL index — MongoDB auto-removes expired docs
sharedFileSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const SharedFile = mongoose.model("SharedFile", sharedFileSchema);
export default SharedFile;
