// backend/src/controllers/company.controller.js
import Company from "../models/company.model.js";
import Shortlist from "../models/shortlist.model.js";
import User from "../models/user.model.js";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { logger } from "../utils/logger.js";
import { emitCompanyUpdate } from "../config/socket.js";

/**
 * Get all companies
 * GET /api/admin/companies
 */
export const getAllCompanies = async (req, res) => {
  try {
    // Only return current-season companies (placementYear === null).
    // Archived seasons have placementYear set via Compass and appear only in /api/prev-placement.
    const companies = await Company.find({ placementYear: null })
      .populate('POCs', 'name emailId phoneNo')
      .sort({ createdAt: -1 });

    return res.json({ companies });
  } catch (err) {
    logger.error("getAllCompanies error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * Get single company by ID
 * GET /api/admin/companies/:id
 */
export const getCompanyById = async (req, res) => {
  try {
    const { id } = req.params;

    const company = await Company.findById(id)
      .populate('POCs', 'name emailId phoneNo');

    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }

    return res.json({ company });
  } catch (err) {
    logger.error("getCompanyById error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * Update company
 * PATCH /api/admin/companies/:id
 * Body: { name, venue, description, maxRounds, pocIds, newPocs }
 */
export const updateCompany = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, venue, description, maxRounds, pocIds, newPocs } = req.body;

    const company = await Company.findById(id);
    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }

    // Update fields
    if (name && name.trim()) {
      // Check for duplicate name (excluding current company)
      const duplicate = await Company.findOne({ 
        name: name.trim(), 
        _id: { $ne: id } 
      });
      if (duplicate) {
        return res.status(400).json({ message: "Company with this name already exists" });
      }
      company.name = name.trim();
    }

    if (venue !== undefined) company.venue = venue.trim();
    if (description !== undefined) company.description = description.trim();
    if (maxRounds !== undefined) company.maxRounds = Number(maxRounds);

    // Create new POCs if provided
    let createdPocIds = [];
    if (newPocs && Array.isArray(newPocs) && newPocs.length > 0) {
      for (const newPoc of newPocs) {
        const { name: pocName, emailId, phoneNo } = newPoc;
        
        if (!pocName || !emailId) {
          return res.status(400).json({ 
            message: "POC name and email are required" 
          });
        }

        // Check if POC with this email already exists
        const existingPoc = await User.findOne({ emailId: emailId.trim() });
        if (existingPoc) {
          // If POC exists, add to the list
          createdPocIds.push(existingPoc._id);
        } else {
          // Create new POC user
          const poc = new User({
            name: pocName.trim(),
            emailId: emailId.trim(),
            phoneNo: phoneNo?.trim() || "",
            role: "poc"
          });
          await poc.save();
          createdPocIds.push(poc._id);
          logger.info(`New POC created: ${poc.name} (${poc.emailId})`);
        }
      }
    }

    // Update POCs if provided
    if (pocIds !== undefined && Array.isArray(pocIds)) {
      // Combine existing POC IDs with newly created POC IDs
      const allPocIds = [...pocIds, ...createdPocIds];
      
      if (allPocIds.length > 0) {
        const pocs = await User.find({ 
          _id: { $in: allPocIds },
          role: { $in: ["poc", "admin"] }
        });
        
        if (pocs.length !== allPocIds.length) {
          return res.status(400).json({ 
            message: "One or more POC IDs are invalid" 
          });
        }
        company.POCs = pocs.map(p => p._id);
      } else {
        company.POCs = [];
      }
    } else if (createdPocIds.length > 0) {
      // Only new POCs were provided, add them to existing POCs
      const existingPocIds = company.POCs || [];
      company.POCs = [...existingPocIds, ...createdPocIds];
    }

    await company.save();
    await company.populate('POCs', 'name emailId phoneNo');

    logger.info(`Company updated: ${company.name} by admin ${req.user.email}`);

    // Emit socket event for real-time update
    emitCompanyUpdate("updated", company);

    return res.json({
      message: "Company updated successfully",
      company
    });
  } catch (err) {
    logger.error("updateCompany error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * Delete company
 * DELETE /api/admin/companies/:id
 */
export const deleteCompany = async (req, res) => {
  try {
    const { id } = req.params;

    const company = await Company.findById(id);
    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }

    const companyData = { _id: company._id, name: company.name };

      // Delete all shortlists associated with this company
      try {
        const resDel = await Shortlist.deleteMany({ companyId: company._id });
        logger.info(`Deleted ${resDel.deletedCount || 0} shortlists for company ${company.name}`);
      } catch (err) {
        logger.error(`Error deleting shortlists for company ${company.name}:`, err);
        // proceed with company deletion even if shortlist deletion fails
      }

      await company.deleteOne();

    logger.info(`Company deleted: ${company.name} by admin ${req.user.email}`);

    // Emit socket event for real-time update
    emitCompanyUpdate("deleted", companyData);

    return res.json({ message: "Company deleted successfully" });
  } catch (err) {
    logger.error("deleteCompany error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * Get all POCs (users with role poc only, not admin)
 * GET /api/admin/pocs
 */
export const getAllPOCs = async (req, res) => {
  try {
    const pocs = await User.find({ 
      role: "poc",
      isAllowed: true
    })
    .select('name emailId phoneNo role')
    .sort({ name: 1 });

    return res.json({ pocs });
  } catch (err) {
    logger.error("getAllPOCs error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};
