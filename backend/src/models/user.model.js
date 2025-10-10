import mongoose from "mongoose";

const providerSchema = new mongoose.Schema({
  provider: { type: String }, // 'azure' | 'google'
  providerId: { type: String } // oid or sub
}, {_id: false});

const userSchema = new mongoose.Schema({
  name: { type: String, trim: true },
  email: { type: String, lowercase: true, trim: true, index: true, unique: true, sparse: true },
  phone: { type: String },
  role: {
    type: String,
    enum: ["superadmin", "admin", "official", "poc", "student"],
    default: "student"
  },
  passwordHash: { type: String }, // only for local login when admin sets password
  providers: [providerSchema], // linked oauth providers
  isAllowed: { type: Boolean, default: false }, // must be true to allow oauth signin
  branch: { type: String },
  rollNo: { type: String },
  isBlocked: { type: Boolean, default: false }
}, { timestamps: true });

export default mongoose.model("User", userSchema);
