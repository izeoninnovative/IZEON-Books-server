import { Router } from "express";
import { verifyToken, requireRole } from "../middlewares/auth.middleware.js";
import {
  getCompanyProfileController,
  updateCompanyProfileController,
} from "../controllers/company.controller.js";

const router = Router();

// GET /api/company - Authenticated users (Admin & HR) can view company details on invoices
router.get("/", verifyToken, getCompanyProfileController);

// PUT /api/company - Strictly ADMIN only can modify GSTIN, Legal Name, Address, etc.
router.put("/", verifyToken, requireRole(["ADMIN"]), updateCompanyProfileController);

export default router;
