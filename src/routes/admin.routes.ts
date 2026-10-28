import { Router } from "express";
import {
  createHR,
  getAllHRs,
  updateHR,
  createExpense,
  getAllExpenses,
  createEmployee,
  getAllEmployees,
  getEmployeeById,
  updateEmployee,
  deleteEmployee,
  recordSalary,
  getAllSalaries,
  getFinancialReport,
  getAttendancePolicy,
  updateAttendancePolicy,
  recordAttendance,
  recordBulkAttendance,
  getAttendanceByDate,
  getAttendanceRegister,
  getAttendanceMonthlySummary,
  getEmployeePayrollPrep,
  recordEmployeeAppraisal,
  getEmployeeAppraisals,
} from "../controllers/admin.controller.js";
import { verifyToken, requireRole } from "../middlewares/auth.middleware.js";

const router = Router();

// Strict ADMIN-only routes guard
router.use(verifyToken, requireRole(["ADMIN"]));

// 1. HR User Management (Only Admin)
router.post("/hr", createHR);
router.get("/hr", getAllHRs);
router.put("/hr/:id", updateHR);
router.post("/hr-users", createHR);
router.get("/hr-users", getAllHRs);
router.put("/hr-users/:id", updateHR);

// 2. Office Expenses (Only Admin)
router.post("/expenses", createExpense);
router.get("/expenses", getAllExpenses);

// 3. Employee Management (Only Admin)
router.post("/employees", createEmployee);
router.get("/employees", getAllEmployees);
router.get("/employees/:id", getEmployeeById);
router.get("/employees/:id/payroll-prep", getEmployeePayrollPrep);
router.put("/employees/:id", updateEmployee);
router.post("/employees/:id/appraisal", recordEmployeeAppraisal);
router.get("/employees/:id/appraisals", getEmployeeAppraisals);
router.delete("/employees/:id", deleteEmployee);

// 4. Employee & Trainer Salaries (Only Admin)
router.post("/salaries", recordSalary);
router.get("/salaries", getAllSalaries);

// 5. Attendance & Time Tracking (Only Admin)
router.get("/attendance/policy", getAttendancePolicy);
router.put("/attendance/policy", updateAttendancePolicy);
router.post("/attendance", recordAttendance);
router.post("/attendance/bulk", recordBulkAttendance);
router.get("/attendance/date", getAttendanceByDate);
router.get("/attendance/register", getAttendanceRegister);
router.get("/attendance/summary", getAttendanceMonthlySummary);

// 6. Financial Analytics Report: day, week, month, all (Only Admin)
router.get("/reports", getFinancialReport);

export default router;

