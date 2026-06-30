import mongoose from "mongoose";

/**
 * PlacementSeason — records are created and managed ONLY via MongoDB Compass.
 *
 * Lifecycle:
 *   1. Admin creates a season doc in Compass: { year: "2025-26", label: "Placement Season 2025-26" }
 *   2. When the season concludes, admin sets isPrevActive: true in Compass.
 *   3. Admin also bulk-sets placementYear: "2025-26" on all Company docs from that season in Compass.
 *   4. The dday "Prev Placement Data" page reads all seasons where isPrevActive: true.
 *
 * DO NOT expose create/update/delete for this model through any dday API route.
 */
const PlacementSeasonSchema = new mongoose.Schema({
  year: { type: String, required: true, unique: true, trim: true },
  label: { type: String, trim: true },
  isPrevActive: { type: Boolean, default: false },
  // Set true via Compass on the ONE season that just concluded and may still receive late companies/offers.
  // All other archived seasons must have this false — they are fully read-only.
  isLastFinished: { type: Boolean, default: false },
  concludedAt: { type: Date },
}, { timestamps: true });

export default mongoose.model("PlacementSeason", PlacementSeasonSchema);
