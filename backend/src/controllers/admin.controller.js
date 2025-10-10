import bcrypt from "bcryptjs";
import User from "../models/user.model.js";
import { logger } from "../utils/logger.js";

/**
 * Create a user record used by admin.
 * Body: { name, email, role, password(optional), isAllowed(boolean), providers: [{provider, providerId}] }
 */
export const createUser = async (req, res) => {
  try {
    const { name, email, role, password, isAllowed, providers } = req.body;
    if (!email || !role) return res.status(400).json({ message: "email and role required" });

    const existing = await User.findOne({ email });
    if (existing) return res.status(409).json({ message: "Email already exists" });

    let passwordHash;
    if (password) {
      const salt = await bcrypt.genSalt(10);
      passwordHash = await bcrypt.hash(password, salt);
    }

    const user = new User({
      name, email, role, passwordHash, isAllowed: !!isAllowed,
      providers: providers || []
    });
    await user.save();

    return res.status(201).json({ message: "User created", user: { id: user._id, email: user.email } });
  } catch (err) {
    logger.error("createUser error", err);
    return res.status(500).json({ message: "Server error" });
  }
};
