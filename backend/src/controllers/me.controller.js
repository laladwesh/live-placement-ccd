// backend/src/controllers/user.controller.js
export const whoami = (req, res) => {
  try {
    // req.user is set by authMiddleware
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const user = {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
      isBlocked: req.user.isBlocked || false,
      createdAt: req.user.createdAt || null,
    };

    return res.status(200).json({ user });
  } catch (err) {
    console.error("whoami error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};
