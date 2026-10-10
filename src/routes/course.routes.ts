import { Router } from "express";
import { createCourse, getAllCourses } from "../controllers/course.controller.js";
import { verifyToken, requireRole } from "../middlewares/auth.middleware.js";

const router = Router();

// Both ADMIN & HR can view courses
router.get("/", verifyToken, getAllCourses);

// Only ADMIN can create courses
router.post("/", verifyToken, requireRole(["ADMIN"]), createCourse);

export default router;
