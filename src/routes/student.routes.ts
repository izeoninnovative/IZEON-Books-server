import { Router } from "express";
import { registerStudent, getAllStudents, getStudentDetails, updateStudent } from "../controllers/student.controller.js";
import { verifyToken, requireRole } from "../middlewares/auth.middleware.js";

const router = Router();

// Both ADMIN and HR can enroll students and view records
router.post("/", verifyToken, requireRole(["ADMIN", "HR"]), registerStudent);
router.get("/", verifyToken, requireRole(["ADMIN", "HR"]), getAllStudents);
router.get("/:id", verifyToken, requireRole(["ADMIN", "HR"]), getStudentDetails);

// Only ADMIN can update student data
router.put("/:id", verifyToken, requireRole(["ADMIN"]), updateStudent);

export default router;

