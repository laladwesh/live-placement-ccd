import mongoose from "mongoose";

const StudentSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User", 
    required: true,
    unique: true 
  },
  rollNumber: {
    type: String,
    trim: true,
    validate: {
      validator: v => /^\d{9}$/.test(v),
      message: props => `${props.value} is not a valid 9-digit roll number`
    },
    default: ""
  },
  isPlaced: { 
    type: Boolean, 
    default: false 
  },
  shortlistedCompanies: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Company" 
  }],
  waitlistedCompanies: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Company" 
  }],
  placedCompany: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Company",
    default: null
  },
  // null = current/active season. Set to e.g. "2025-26" via Compass bulk-update when archiving.
  // Bulk command: db.students.updateMany({}, { $set: { placementYear: "2025-26" } })
  placementYear: { type: String, default: null },
}, {
  timestamps: true
});

// Index for quick lookups
StudentSchema.index({ userId: 1 });
StudentSchema.index({ isPlaced: 1 });

export default mongoose.model("Student", StudentSchema);
