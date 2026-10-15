import axios from "axios";
import crypto from "crypto";
import { logger } from "../utils/logger.js";

const PLACEMENT_API = process.env.PLACEMENT_PORTAL_API;
const SYNC_KEY = process.env.DDAY_SYNC_KEY || "";

function hmacForGet() {
  return SYNC_KEY
    ? crypto.createHmac("sha256", SYNC_KEY).update("{}").digest("hex")
    : "";
}

/**
 * GET /api/placement-stats/:rollNumber
 * Proxies to {PLACEMENT_PORTAL_API}/external/dday/placement-stats/:rollNumber
 */
export const getPlacementStatsByRoll = async (req, res) => {
  try {
    if (!PLACEMENT_API) {
      return res.status(502).json({
        message: "Placement portal not configured — set PLACEMENT_PORTAL_API on the server.",
      });
    }

    const { rollNumber } = req.params;
    const upstream = await axios.get(
      `${PLACEMENT_API}/external/dday/placement-stats/${encodeURIComponent(rollNumber)}`,
      {
        headers: { "x-sync-signature": hmacForGet() },
        timeout: 12000,
      }
    );

    return res.json(upstream.data);
  } catch (err) {
    logger.error("getPlacementStatsByRoll upstream error:", err?.message || err);
    const status = err?.response?.status;
    if (status === 404) {
      return res.status(404).json({ message: "Student not found in placement portal" });
    }
    return res.status(502).json({
      message: `Placement portal error${status ? ` (upstream ${status})` : " — upstream unreachable"}`,
    });
  }
};
