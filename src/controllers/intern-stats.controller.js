import axios from "axios";
import { logger } from "../utils/logger.js";

// 30-second in-memory cache for the list endpoint
let listCache = null; // { data: <upstream response body>, fetchedAt: <ms timestamp> }

// Same convention, per-roll-number, for the by-roll lookup below — bounded by total
// student count, not an unbounded-growth risk. Also means a slow/unreachable intern
// portal doesn't force every repeated lookup of the same roll number to wait out the
// full upstream timeout.
const byRollCache = new Map(); // rollNumber -> { data, fetchedAt }
const BY_ROLL_CACHE_TTL_MS = 30_000;

function internClient() {
  const base = process.env.INTERN_PORTAL_BASE_URL;
  const key = process.env.INTERN_PORTAL_API_KEY;
  if (!base || !key || key === "<paste-from-server-admin>") {
    return null;
  }
  return axios.create({
    baseURL: base,
    // Shortened from 12s — a slow/unreachable intern portal shouldn't stall a D-Day viewer
    // request for that long.
    timeout: 3000,
    headers: { "X-API-KEY": key },
  });
}

/**
 * GET /api/intern-stats
 * Fans out to {INTERN_PORTAL_BASE_URL}/external/dday/intern-stats.
 * Cached in-memory for 30 s; pass ?refresh=1 to bust.
 */
export const getInternStats = async (req, res) => {
  try {
    const client = internClient();
    if (!client) {
      return res.status(502).json({
        message:
          "Intern portal not configured — set INTERN_PORTAL_BASE_URL and INTERN_PORTAL_API_KEY on the server.",
      });
    }

    const cacheBust = req.query.refresh === "1";
    const now = Date.now();

    if (!cacheBust && listCache && now - listCache.fetchedAt < 30_000) {
      return res.json(listCache.data);
    }

    const upstream = await client.get("/external/dday/intern-stats");
    listCache = { data: upstream.data, fetchedAt: now };
    return res.json(upstream.data);
  } catch (err) {
    logger.error("getInternStats upstream error:", err?.message || err);
    const upstreamStatus = err?.response?.status;
    return res.status(502).json({
      message: `Intern portal error${upstreamStatus ? ` (upstream ${upstreamStatus})` : " — upstream unreachable"}`,
    });
  }
};

/**
 * GET /api/intern-stats/:rollNumber
 * Fans out to {INTERN_PORTAL_BASE_URL}/external/dday/intern-stats/:rollNumber.
 * Not cached.
 */
export const getInternStatsByRoll = async (req, res) => {
  try {
    const { rollNumber } = req.params;
    const cacheBust = req.query.refresh === "1";
    const now = Date.now();

    const cached = byRollCache.get(rollNumber);
    if (!cacheBust && cached && now - cached.fetchedAt < BY_ROLL_CACHE_TTL_MS) {
      return res.json(cached.data);
    }

    const client = internClient();
    if (!client) {
      return res.status(502).json({
        message:
          "Intern portal not configured — set INTERN_PORTAL_BASE_URL and INTERN_PORTAL_API_KEY on the server.",
      });
    }

    const upstream = await client.get(
      `/external/dday/intern-stats/${encodeURIComponent(rollNumber)}`
    );
    byRollCache.set(rollNumber, { data: upstream.data, fetchedAt: now });
    return res.json(upstream.data);
  } catch (err) {
    logger.error("getInternStatsByRoll upstream error:", err?.message || err);
    const upstreamStatus = err?.response?.status;
    if (upstreamStatus === 404) {
      return res.status(404).json({ message: "Student not found in intern portal" });
    }
    return res.status(502).json({
      message: `Intern portal error${upstreamStatus ? ` (upstream ${upstreamStatus})` : " — upstream unreachable"}`,
    });
  }
};
