import { Router } from "express";
import { register, login } from "../controllers/auth.controller.js";
import { verifyToken, requireRole, AuthenticatedRequest } from "../middlewares/auth.middleware.js";

const router = Router();

// Public Auth routes
router.post("/register", register);
router.post("/login", login);

// Protected route to get logged-in user profile
router.get("/profile", verifyToken, (req: AuthenticatedRequest, res) => {
  res.status(200).json({
    success: true,
    user: req.user,
  });
});

// Admin-only route demonstration
router.get("/admin-only", verifyToken, requireRole(["ADMIN"]), (_req, res) => {
  res.status(200).json({
    success: true,
    message: "Welcome Admin! You have access to administrative controls.",
  });
});

export default router;
