// backend/src/models/user.model.js
import mongoose from "mongoose";

const UserSchema = new mongoose.Schema({
  name: { type: String, trim: true },
  email: { type: String, lowercase: true, trim: true, required: true, unique: true },
  rollNumber: { type: String, trim: true, unique: true, sparse: true }, // Student roll number (unique identifier)
  phoneNumber: { type: String, trim: true },
  role: { type: String, enum: ["student", "poc", "admin", "superadmin", "official"], default: "student" },
  // convenience booleans (your UI can use role or these)
  isPoc: { type: Boolean, default: false },
  isAdmin: { type: Boolean, default: false },
  isPlaced: { type: Boolean, default: false },
  passwordHash: { type: String }, // only for local login
  isAllowed: { type: Boolean, default: false }, // pre-authorized for oauth
  isBlocked: { type: Boolean, default: false }, // blocked from other interviews after selection
  providers: [
    {
      provider: { type: String },
      providerId: { type: String }
    }
  ],
}, {
  timestamps: true
});

// Pre-save hook to set convenience booleans based on role
UserSchema.pre('save', function(next) {
  this.isPoc = this.role === 'poc';
  this.isAdmin = this.role === 'admin' || this.role === 'superadmin';
  next();
});

// Quick indexes
UserSchema.index({ email: 1 });
UserSchema.index({ rollNumber: 1 });
UserSchema.index({ role: 1 });

export default mongoose.model("User", UserSchema);
