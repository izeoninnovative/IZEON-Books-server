/** @format */

import { Router } from "express";
import {
  getMyProfile,
  getMyAttendance,
  getMySalaries,
  getMyAppraisals,
  getTodayAttendance,
  punchAttendance,
} from "../controllers/employee.controller.js";
import { verifyToken, requireRole } from "../middlewares/auth.middleware.js";

const router = Router();

// Allow EMPLOYEE, HR, and ADMIN to access employee self-service portal endpoints
router.use(verifyToken, requireRole(["EMPLOYEE", "HR", "ADMIN"]));

router.get("/me", getMyProfile);
router.get("/today", getTodayAttendance);
router.post("/punch", punchAttendance);
router.get("/attendance", getMyAttendance);
router.get("/salaries", getMySalaries);
router.get("/appraisals", getMyAppraisals);

export default router;
