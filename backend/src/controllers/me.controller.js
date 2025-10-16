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
      emailId: req.user.emailId,
      phoneNo: req.user.phoneNo,
      role: req.user.role,
      companyName: req.user.companyName || null,
      createdAt: req.user.createdAt || null,
    };

    return res.status(200).json({ user });
  } catch (err) {
    console.error("whoami error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};
