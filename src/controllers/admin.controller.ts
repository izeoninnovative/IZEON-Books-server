import { Response } from "express";
import { AuthenticatedRequest } from "../middlewares/auth.middleware.js";
import * as adminService from "../services/admin.services.js";

// 1. HR User Management
export const createHR = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ success: false, message: "Username, email, and password are required" });
    }

    const hrUser = await adminService.createHRUser({ username, email, password });
    return res.status(201).json({ success: true, message: "HR account created successfully", data: hrUser });
  } catch (err: any) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

export const getAllHRs = async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const hrUsers = await adminService.getAllHRUsers();
    return res.status(200).json({ success: true, data: hrUsers });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const updateHR = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const hrId = Number(req.params.id);
    if (!hrId || isNaN(hrId)) {
      return res.status(400).json({ success: false, message: "Valid HR user ID is required" });
    }

    const { username, email, password, role } = req.body;
    const updated = await adminService.updateHRUser(hrId, { username, email, password, role });
    return res.status(200).json({
      success: true,
      message: "HR staff account updated successfully",
      data: updated,
    });
  } catch (err: any) {
    return res.status(400).json({ success: false, message: err.message });
  }
};


// 2. Expense Recording
export const createExpense = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { title, category, amount, expenseDate, notes } = req.body;
    if (!title || !category || !amount) {
      return res.status(400).json({ success: false, message: "Title, category, and amount are required" });
    }

    const expense = await adminService.createExpense({
      title,
      category,
      amount: Number(amount),
      expenseDate,
      notes,
      createdById: req.user!.id,
    });

    return res.status(201).json({ success: true, message: "Expense recorded successfully", data: expense });
  } catch (err: any) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

export const getAllExpenses = async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const expenses = await adminService.getAllExpenses();
    return res.status(200).json({ success: true, data: expenses });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// 3. Employee Management
export const createEmployee = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { empCode, name, email, phone, role, department, joiningDate, baseSalary, appraisalDate, status, bankName, accountNumber, ifscCode, notes } = req.body;
    if (!name || !role) {
      return res.status(400).json({ success: false, message: "Employee name and designation/role are required" });
    }

    const employee = await adminService.createEmployee({
      empCode,
      name,
      email,
      phone,
      role,
      department,
      joiningDate,
      baseSalary: Number(baseSalary) || 0,
      appraisalDate,
      status,
      bankName,
      accountNumber,
      ifscCode,
      notes,
    });

    return res.status(201).json({ success: true, message: "Employee created successfully", data: employee });
  } catch (err: any) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

export const getAllEmployees = async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const employees = await adminService.getAllEmployees();
    return res.status(200).json({ success: true, data: employees });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const getEmployeeById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const employee = await adminService.getEmployeeById(id);
    return res.status(200).json({ success: true, data: employee });
  } catch (err: any) {
    return res.status(404).json({ success: false, message: err.message });
  }
};

export const updateEmployee = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const employee = await adminService.updateEmployee(id, req.body);
    return res.status(200).json({ success: true, message: "Employee updated successfully", data: employee });
  } catch (err: any) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

export const deleteEmployee = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const result = await adminService.deleteEmployee(id);
    return res.status(200).json({ success: true, message: result.message });
  } catch (err: any) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

// 4. Salary Payment Recording
export const recordSalary = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { employeeId, employeeName, employeeEmail, role, month, year, amount, baseSalary, lopDays, lopDeduction, paymentMethod, reference, notes } = req.body;
    if (!employeeName || !role || !month || !year || amount === undefined) {
      return res.status(400).json({ success: false, message: "Employee name, role, month, year, and amount are required" });
    }

    const salary = await adminService.recordSalaryPayment({
      employeeId: employeeId ? Number(employeeId) : undefined,
      employeeName,
      employeeEmail,
      role,
      month: Number(month),
      year: Number(year),
      amount: Number(amount),
      baseSalary: baseSalary !== undefined ? Number(baseSalary) : undefined,
      lopDays: lopDays !== undefined ? Number(lopDays) : 0,
      lopDeduction: lopDeduction !== undefined ? Number(lopDeduction) : 0,
      paymentMethod,
      reference,
      notes,
      paidById: req.user!.id,
    });

    return res.status(201).json({ success: true, message: "Salary payment recorded successfully", data: salary });
  } catch (err: any) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

export const getAllSalaries = async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const salaries = await adminService.getAllSalaries();
    return res.status(200).json({ success: true, data: salaries });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// 4. Financial Analytics Report (Filter by day, week, month, all)
export const getFinancialReport = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const filter = (req.query.filter as "day" | "week" | "month" | "all") || "all";
    const report = await adminService.getFinancialReport(filter);
    return res.status(200).json({ success: true, data: report });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
};
