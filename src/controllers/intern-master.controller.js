import mongoose from "mongoose";
import InternMaster from "../models/intern-master.model.js";
import { logger } from "../utils/logger.js";

const escapeRegex = (value = "") => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * GET /api/viewers/intern-master
 * Access: admin, viewer
 */
export const getInternMasterData = async (req, res) => {
  try {
    const { search = "", isGotIntern, company = "" } = req.query;

    const query = {};

    if (isGotIntern === "true" || isGotIntern === "false") {
      query.isGotIntern = isGotIntern === "true";
    }

    if (company) {
      query.company = { $regex: escapeRegex(company), $options: "i" };
    }

    if (search) {
      const regex = { $regex: escapeRegex(search), $options: "i" };
      query.$or = [
        { iitgEmail: regex },
        { rollNumber: regex },
        { name: regex },
        { department: regex },
        { email: regex },
        { mobile: regex },
        { company: regex },
        { slotSpot: regex }
      ];
    }

    const internData = await InternMaster.find(query)
      .sort({ cpi: -1, name: 1 })
      .lean();

    return res.json({
      success: true,
      count: internData.length,
      data: internData
    });
  } catch (err) {
    logger.error("getInternMasterData error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * PATCH /api/viewers/intern-master/:id/placement
 * Body: { isGotIntern: boolean, company?: string, slotSpot?: string }
 * Access: admin, viewer
 */
export const updateInternPlacement = async (req, res) => {
  try {
    const { id } = req.params;
    const { isGotIntern, company, slotSpot } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid record id" });
    }

    if (typeof isGotIntern !== "boolean") {
      return res.status(400).json({ message: "isGotIntern must be boolean" });
    }

    if (isGotIntern && !company?.trim()) {
      return res.status(400).json({ message: "Company is required when marking as placed" });
    }

    const update = {
      isGotIntern,
      company: isGotIntern ? company.trim() : "",
      slotSpot: typeof slotSpot === "string" ? slotSpot.trim() : "",
      lastUpdatedBy: req.user?._id || null
    };

    const updated = await InternMaster.findByIdAndUpdate(id, { $set: update }, { new: true });

    if (!updated) {
      return res.status(404).json({ message: "Intern record not found" });
    }

    return res.json({
      success: true,
      message: "Intern placement status updated",
      data: updated
    });
  } catch (err) {
    logger.error("updateInternPlacement error", err);
    return res.status(500).json({ message: "Server error" });
  }
};
