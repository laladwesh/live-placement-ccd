// backend/src/models/student.model.js
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
  }
}, {
  timestamps: true
});

// Index for quick lookups
StudentSchema.index({ userId: 1 });
StudentSchema.index({ isPlaced: 1 });

export default mongoose.model("Student", StudentSchema);
