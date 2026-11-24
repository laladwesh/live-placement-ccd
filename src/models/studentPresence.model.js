import mongoose from "mongoose";

// Single "current presence" document per student — bounded by total student count.
// Upserted on enter/exit; never grows beyond one record per student.
const StudentPresenceSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true,
  },
  status: {
    type: String,
    enum: ["free", "busy"],
    default: "free",
  },
  companyId:   { type: mongoose.Schema.Types.ObjectId, ref: "Company", default: null },
  companyName: { type: String, default: null },
  venue:       { type: String, default: null },
  round:       { type: String, default: null },  // "R1" | "R2" | "R3" | "R4"
  enteredAt:   { type: Date, default: null },
}, {
  timestamps: true,
});

StudentPresenceSchema.index({ studentId: 1 });
StudentPresenceSchema.index({ status: 1 });

export default mongoose.model("StudentPresence", StudentPresenceSchema);
