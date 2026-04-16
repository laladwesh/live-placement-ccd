import mongoose from "mongoose";

const InternMasterSchema = new mongoose.Schema(
  {
    iitgEmail: {
      type: String,
      trim: true,
      lowercase: true,
      required: true
    },
    rollNumber: {
      type: String,
      trim: true,
      required: true
    },
    name: {
      type: String,
      trim: true,
      required: true
    },
    cpi: {
      type: Number,
      min: 0,
      max: 10,
      default: null
    },
    department: {
      type: String,
      trim: true,
      default: ""
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: ""
    },
    mobile: {
      type: String,
      trim: true,
      default: ""
    },
    isGotIntern: {
      type: Boolean,
      default: false
    },
    company: {
      type: String,
      trim: true,
      default: ""
    },
    slotSpot: {
      type: String,
      trim: true,
      default: ""
    },
    lastUpdatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    }
  },
  {
    timestamps: true
  }
);

InternMasterSchema.index({ iitgEmail: 1, rollNumber: 1 }, { unique: true });
InternMasterSchema.index({ isGotIntern: 1 });
InternMasterSchema.index({ company: 1 });

export default mongoose.model("InternMaster", InternMasterSchema);
