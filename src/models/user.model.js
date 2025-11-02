// backend/src/models/user.model.js
import mongoose from "mongoose";

const UserSchema = new mongoose.Schema({
  name: { type: String, trim: true, required: true },
  emailId: { type: String, lowercase: true, trim: true, required: true, unique: true },
  phoneNo: { 
    type: String, 
    trim: true,
    validate: {
      validator: v => /^\d{10}$/.test(v),
      message: props => `${props.value} is not a valid 10-digit phone number`
    }
  },
  role: { type: String, enum: ["student", "poc", "admin", "official"], default: "student" },
  companyName: { type: String, trim: true }, // For POC role - name of their company
  passwordHash: { type: String }, // only for local login
  isAllowed: { type: Boolean, default: false }, // pre-authorized for oauth
  providers: [
    {
      provider: { type: String },
      providerId: { type: String }
    }
  ],
}, {
  timestamps: true
});

// Quick indexes
UserSchema.index({ emailId: 1 });
UserSchema.index({ role: 1 });

export default mongoose.model("User", UserSchema);
