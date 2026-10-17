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
router.put("/employees/:id", updateEmployee);
router.delete("/employees/:id", deleteEmployee);

// 4. Employee & Trainer Salaries (Only Admin)
router.post("/salaries", recordSalary);
router.get("/salaries", getAllSalaries);

// 4. Financial Analytics Report: day, week, month, all (Only Admin)
router.get("/reports", getFinancialReport);

export default router;
