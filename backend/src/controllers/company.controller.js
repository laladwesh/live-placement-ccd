// backend/src/controllers/company.controller.js
import Company from "../models/company.model.js";
import User from "../models/user.model.js";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { logger } from "../utils/logger.js";
import { emitCompanyUpdate } from "../config/socket.js";

/**
 * Create a new company
 * POST /api/admin/companies
 * Body: { name, venue, description, maxRounds, pocIds, newPocs }
 */
export const createCompany = async (req, res) => {
  try {
    console.log("📦 CREATE COMPANY REQUEST:");
    console.log("   User:", req.user.emailId, "| Role:", req.user.role);
    console.log("   Body:", JSON.stringify(req.body, null, 2));
    
    const { name, venue, description, maxRounds, pocIds = [], newPocs = [] } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Company name is required" });
    }

    // Check if company already exists
    const existing = await Company.findOne({ name: name.trim() });
    if (existing) {
      return res.status(400).json({ message: "Company with this name already exists" });
    }

    // 1. Create new POC users if provided
    const newPocIds = [];
    if (Array.isArray(newPocs) && newPocs.length > 0) {
      for (const pocData of newPocs) {
        if (!pocData.emailId || !pocData.name || !pocData.phoneNo) {
          return res.status(400).json({ message: "New POCs must have a name, emailId, and phoneNo." });
        }
        const existingUser = await User.findOne({ emailId: pocData.emailId });
        if (existingUser) {
          return res.status(400).json({ message: `A user with email ${pocData.emailId} already exists.` });
        }

        // Create a user without a password, ready for OAuth login
        const newUser = new User({
          name: pocData.name,
          emailId: pocData.emailId,
          phoneNo: pocData.phoneNo,
          role: "poc",
          isAllowed: true, // New POCs are allowed by default
        });
        await newUser.save();
        newPocIds.push(newUser._id);
        logger.info(`New POC user created for OAuth login: ${newUser.emailId}`);
      }
    }

    // Validate POCs if provided
    if (pocIds && Array.isArray(pocIds) && pocIds.length > 0) {
      const pocs = await User.find({ 
        _id: { $in: pocIds },
        role: { $in: ["poc", "admin"] } // POCs or admins can be assigned
      });
      
      if (pocs.length !== pocIds.length) {
        return res.status(400).json({ 
          message: "One or more POC IDs are invalid or users don't have POC/admin role" 
        });
      }
    }

    // Combine existing and newly created POCs, ensuring no duplicates
    const allPocIds = [...new Set([...pocIds, ...newPocIds.map(id => id.toString())])];

    const company = new Company({
      name: name.trim(),
      venue: venue?.trim() || "",
      POCs: allPocIds,
      shortlistedStudents: [],
      waitlistedStudents: [],
      placedStudents: []
    });

    await company.save();
    
    // Populate POC details for response
    await company.populate('POCs', 'name emailId phoneNo');

    logger.info(`Company created: ${company.name} by admin ${req.user.email}`);

    // Emit socket event for real-time update
    emitCompanyUpdate("created", company);

    return res.status(201).json({
      message: "Company created successfully",
      company
    });
  } catch (err) {
    logger.error("createCompany error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * Get all companies
 * GET /api/admin/companies
 */
export const getAllCompanies = async (req, res) => {
  try {
    const companies = await Company.find()
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
 * Body: { name, venue, description, maxRounds, pocIds }
 */
export const updateCompany = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, venue, description, maxRounds, pocIds } = req.body;

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

    // Update POCs if provided
    if (pocIds !== undefined && Array.isArray(pocIds)) {
      if (pocIds.length > 0) {
        const pocs = await User.find({ 
          _id: { $in: pocIds },
          role: { $in: ["poc", "admin"] }
        });
        
        if (pocs.length !== pocIds.length) {
          return res.status(400).json({ 
            message: "One or more POC IDs are invalid" 
          });
        }
        company.POCs = pocs.map(p => p._id);
      } else {
        company.POCs = [];
      }
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
 * Get all POCs (users with role poc or admin)
 * GET /api/admin/pocs
 */
export const getAllPOCs = async (req, res) => {
  try {
    const pocs = await User.find({ 
      role: { $in: ["poc", "admin"] },
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
