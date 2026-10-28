/** @format */

import bcrypt from "bcrypt";
import { db } from "../prisma/db.js";

// ==================== HR USER MANAGEMENT ====================
export interface CreateHRDTO {
  username: string;
  email: string;
  password: string;
  role?: string;
  department?: string;
  baseSalary?: number;
  phone?: string;
  joiningDate?: string;
  shiftInTime?: string;
  shiftOutTime?: string;
  gracePeriodMinutes?: number;
}

export const createHRUser = async (data: CreateHRDTO) => {
  const existing = await db.orm.public.User.where({
    email: data.email,
  }).first();
  if (existing) {
    throw new Error("User with this email already exists");
  }

  const hashedPassword = await bcrypt.hash(data.password, 10);
  const hrUser = await db.orm.public.User.create({
    username: data.username,
    email: data.email,
    password: hashedPassword,
    role: "HR",
  });

  // Automatically ensure this HR is also registered as an Employee in the employment directory
  try {
    const existingEmp = await db.orm.public.Employee.where({
      email: data.email,
    }).first();
    if (!existingEmp) {
      const empCode = await generateEmployeeCode();
      await db.orm.public.Employee.create({
        empCode,
        name: data.username.trim(),
        email: data.email.trim(),
        phone: data.phone?.trim() || null,
        role: data.role?.trim() || "HR",
        department: data.department?.trim() || "Human Resources",
        baseSalary: Number(data.baseSalary) || 0,
        joiningDate: data.joiningDate || new Date().toISOString().split("T")[0],
        status: "ACTIVE",
        userId: hrUser.id,
        shiftInTime: data.shiftInTime?.trim() || "09:30",
        shiftOutTime: data.shiftOutTime?.trim() || "18:30",
        gracePeriodMinutes:
          data.gracePeriodMinutes !== undefined
            ? Number(data.gracePeriodMinutes)
            : 0,
      });
    } else {
      await db.orm.public.Employee.where({ id: existingEmp.id }).update({
        userId: hrUser.id,
      });
    }
  } catch (syncErr) {
    console.error("[HR Employee Sync Error]", syncErr);
  }

  const { password, ...safeUser } = hrUser;
  return safeUser;
};

export const getAllHRUsers = async () => {
  const users = await db.orm.public.User.where({ role: "HR" }).all();
  const allInvoices = await db.orm.public.Invoice.all(); // get all invoices
  return users.map(({ password, ...user }) => {
    const hrInvoices = allInvoices.filter(
      (invoice) => invoice.createdById === user.id,
    );
    const totalRevenueGenerated = hrInvoices.reduce(
      (acc, curr) => acc + (curr.amountPaid || 0),
      0,
    );

    return {
      ...user,
      totalRevenueGenerated: Math.round(totalRevenueGenerated * 100) / 100,
      invoiceCount: hrInvoices.length,
    };
  });
};

export interface UpdateHRDTO {
  username?: string;
  email?: string;
  password?: string;
  role?: "ADMIN" | "HR";
}

export const updateHRUser = async (id: number, data: UpdateHRDTO) => {
  const existingUser = await db.orm.public.User.where({ id }).first();
  if (!existingUser) {
    throw new Error("HR account not found");
  }

  // If email is changed, verify uniqueness
  if (data.email && data.email !== existingUser.email) {
    const emailConflict = await db.orm.public.User.where({
      email: data.email,
    }).first();
    if (emailConflict && emailConflict.id !== id) {
      throw new Error("User with this email already exists");
    }
  }

  const updateFields: any = {};
  if (data.username !== undefined) updateFields.username = data.username.trim();
  if (data.email !== undefined) updateFields.email = data.email.trim();
  if (data.role !== undefined) updateFields.role = data.role;
  if (data.password && data.password.trim().length > 0) {
    if (data.password.trim().length < 6) {
      throw new Error("Password must be at least 6 characters");
    }
    updateFields.password = await bcrypt.hash(data.password.trim(), 10);
  }

  await db.orm.public.User.where({ id }).update(updateFields);
  const updated = await db.orm.public.User.where({ id }).first();
  if (!updated) {
    throw new Error("HR account update failed");
  }
  const { password, ...safeUser } = updated;
  return safeUser;
};

// ==================== EXPENSE MANAGEMENT ====================
export interface CreateExpenseDTO {
  title: string;
  category:
    | "RENT"
    | "UTILITIES"
    | "MARKETING"
    | "EQUIPMENT"
    | "MAINTENANCE"
    | "SALARY"
    | "OTHER";
  amount: number;
  expenseDate?: string;
  notes?: string;
  createdById: number;
}

export const createExpense = async (data: CreateExpenseDTO) => {
  return await db.orm.public.Expense.create({
    title: data.title,
    category: data.category,
    amount: Number(data.amount),
    expenseDate: data.expenseDate || new Date().toISOString(),
    notes: data.notes || null,
    createdById: data.createdById,
  });
};

export const getAllExpenses = async () => {
  const expenses = await db.orm.public.Expense.all();
  return expenses.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
};

// ==================== EMPLOYEES & PAYROLL ====================
export interface CreateEmployeeDTO {
  empCode?: string;
  name: string;
  email?: string;
  phone?: string;
  role: string;
  department?: string;
  joiningDate?: string;
  baseSalary: number;
  appraisalDate?: string;
  status?: "ACTIVE" | "INACTIVE";
  bankName?: string;
  accountNumber?: string;
  ifscCode?: string;
  notes?: string;
  createLogin?: boolean;
  loginPassword?: string;
  userRole?: "ADMIN" | "HR";
  userId?: number;
  shiftInTime?: string;
  shiftOutTime?: string;
  gracePeriodMinutes?: number;
  lastAppraisalDate?: string;
  lastAppraisalSalary?: number;
  lastAppraisalIncrement?: number;
  lastAppraisalNotes?: string;
}

export interface UpdateEmployeeDTO {
  empCode?: string;
  name?: string;
  email?: string;
  phone?: string;
  role?: string;
  department?: string;
  joiningDate?: string;
  baseSalary?: number;
  appraisalDate?: string;
  lastAppraisalDate?: string;
  lastAppraisalSalary?: number;
  lastAppraisalIncrement?: number;
  lastAppraisalNotes?: string;
  status?: "ACTIVE" | "INACTIVE";
  bankName?: string;
  accountNumber?: string;
  ifscCode?: string;
  notes?: string;
  createLogin?: boolean;
  loginPassword?: string;
  userRole?: "ADMIN" | "HR";
  shiftInTime?: string;
  shiftOutTime?: string;
  gracePeriodMinutes?: number;
}

export const generateEmployeeCode = async (): Promise<string> => {
  const employees = await db.orm.public.Employee.all();
  let maxNum = 0;
  for (const emp of employees) {
    const match = emp.empCode?.match(/\d+/);
    if (match) {
      const n = parseInt(match[0], 10);
      if (n > maxNum) maxNum = n;
    }
  }
  let nextNum = Math.max(maxNum + 1, employees.length + 1);
  while (employees.some((e) => e.empCode === `EMP-${String(nextNum).padStart(3, "0")}`)) {
    nextNum++;
  }
  return `EMP-${String(nextNum).padStart(3, "0")}`;
};

export const createEmployee = async (data: CreateEmployeeDTO) => {
  const empCode = data.empCode?.trim() || (await generateEmployeeCode());

  // Verify code uniqueness
  const existing = await db.orm.public.Employee.where({ empCode }).first();
  if (existing) {
    throw new Error(`Employee with ID/Code ${empCode} already exists`);
  }

  // Verify email uniqueness among employees
  if (data.email?.trim()) {
    const existingEmp = await db.orm.public.Employee.where({
      email: data.email.trim(),
    }).first();
    if (existingEmp) {
      throw new Error(
        `An employee record with email "${data.email.trim()}" already exists (${existingEmp.name} - ${existingEmp.empCode}).`
      );
    }
  }

  // Handle optional User account creation
  let userId = data.userId || null;
  if (data.createLogin && data.email && data.loginPassword) {
    const existingUser = await db.orm.public.User.where({
      email: data.email.trim(),
    }).first();
    if (existingUser) {
      const assignedEmp = await db.orm.public.Employee.where({
        userId: existingUser.id,
      }).first();
      if (assignedEmp) {
        throw new Error(
          `A portal login account with email "${data.email.trim()}" is already assigned to employee "${assignedEmp.name}" (${assignedEmp.empCode}). Please use a different email or update their existing record.`
        );
      }
      userId = existingUser.id;
    } else {
      const hashedPassword = await bcrypt.hash(data.loginPassword.trim(), 10);
      const userRole =
        data.userRole ||
        (data.role?.toUpperCase() === "HR"
          ? "HR"
          : data.role?.toUpperCase() === "ADMIN"
            ? "ADMIN"
            : "EMPLOYEE");
      const newUser = await db.orm.public.User.create({
        username: data.name.trim(),
        email: data.email.trim(),
        password: hashedPassword,
        role: userRole,
      });
      userId = newUser.id;
    }
  }

  return await db.orm.public.Employee.create({
    empCode,
    name: data.name.trim(),
    email: data.email?.trim() || null,
    phone: data.phone?.trim() || null,
    role: data.role.trim(),
    department: data.department?.trim() || null,
    joiningDate: data.joiningDate || null,
    baseSalary: Number(data.baseSalary) || 0,
    appraisalDate: data.appraisalDate || null,
    lastAppraisalDate: data.lastAppraisalDate || null,
    lastAppraisalSalary:
      data.lastAppraisalSalary !== undefined
        ? Number(data.lastAppraisalSalary)
        : null,
    lastAppraisalIncrement:
      data.lastAppraisalIncrement !== undefined
        ? Number(data.lastAppraisalIncrement)
        : null,
    lastAppraisalNotes: data.lastAppraisalNotes?.trim() || null,
    status: data.status || "ACTIVE",
    bankName: data.bankName?.trim() || null,
    accountNumber: data.accountNumber?.trim() || null,
    ifscCode: data.ifscCode?.trim() || null,
    notes: data.notes?.trim() || null,
    userId,
    shiftInTime: data.shiftInTime?.trim() || "09:30",
    shiftOutTime: data.shiftOutTime?.trim() || "18:30",
    gracePeriodMinutes:
      data.gracePeriodMinutes !== undefined
        ? Number(data.gracePeriodMinutes)
        : 0,
  });
};

export const getAllEmployees = async () => {
  const employees = await db.orm.public.Employee.all();
  const salaries = await db.orm.public.SalaryPayment.all();
  const lopRecords = await db.orm.public.EmployeeLop.all();
  const users = await db.orm.public.User.all();
  const allInvoices = await db.orm.public.Invoice.all();

  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const allAttendances = await db.orm.public.EmployeeAttendance.all();
  const currentMonthAttendances = allAttendances.filter((a) =>
    a.date.startsWith(currentMonthStr),
  );

  return employees
    .map((emp) => {
      const empSalaries = salaries.filter((s) => s.employeeId === emp.id);
      const empLops = lopRecords.filter((l) => l.employeeId === emp.id);
      const empAttendances = currentMonthAttendances.filter(
        (a) => a.employeeId === emp.id,
      );

      const totalPaid = empSalaries.reduce((acc, curr) => acc + curr.amount, 0);
      const totalLopDays = empLops.reduce(
        (acc, curr) => acc + (curr.lopDays || 0),
        0,
      );

      const currentMonthLateDays = empAttendances.filter(
        (a) => a.isLate || a.status === "LATE",
      ).length;
      const penaltyCalc = calculateConsecutiveLatePenalties(
        empAttendances,
        emp.baseSalary || 0
      );
      const currentMonthLateDeduction = penaltyCalc.consecutiveLateDeduction;
      const currentMonthPresentDays = empAttendances.filter(
        (a) => a.status === "PRESENT" || a.status === "LATE",
      ).length;

      const linkedUser = emp.userId
        ? users.find((u) => u.id === emp.userId)
        : null;
      let revenueGenerated = 0;
      let invoiceCount = 0;
      if (linkedUser) {
        const userInvoices = allInvoices.filter(
          (inv) => inv.createdById === linkedUser.id,
        );
        revenueGenerated = userInvoices.reduce(
          (acc, curr) => acc + (curr.amountPaid || 0),
          0,
        );
        invoiceCount = userInvoices.length;
      }

      return {
        ...emp,
        hasLoginAccount: !!linkedUser,
        loginRole: linkedUser?.role || null,
        totalRevenueGenerated: Math.round(revenueGenerated * 100) / 100,
        invoiceCount,
        currentMonthLateDays,
        currentMonthLateDeduction:
          Math.round(currentMonthLateDeduction * 100) / 100,
        currentMonthPresentDays,
        salaryHistoryCount: empSalaries.length,
        totalSalaryPaid: Math.round(totalPaid * 100) / 100,
        totalLopDaysRecorded: totalLopDays,
        recentSalaries: empSalaries.slice(0, 5),
      };
    })
    .sort((a, b) => a.empCode.localeCompare(b.empCode));
};

export const getEmployeeById = async (id: number) => {
  const employee = await db.orm.public.Employee.where({ id }).first();
  if (!employee) {
    throw new Error("Employee not found");
  }

  const salaries = await db.orm.public.SalaryPayment.where({
    employeeId: id,
  }).all();
  const lopRecords = await db.orm.public.EmployeeLop.where({
    employeeId: id,
  }).all();

  return {
    ...employee,
    salaries: salaries.sort(
      (a, b) =>
        new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime(),
    ),
    lopRecords: lopRecords.sort((a, b) => b.year - a.year || b.month - a.month),
  };
};

export const updateEmployee = async (id: number, data: UpdateEmployeeDTO) => {
  const employee = await db.orm.public.Employee.where({ id }).first();
  if (!employee) {
    throw new Error("Employee not found");
  }

  if (data.empCode && data.empCode !== employee.empCode) {
    const existing = await db.orm.public.Employee.where({
      empCode: data.empCode,
    }).first();
    if (existing && existing.id !== id) {
      throw new Error(`Employee with ID/Code ${data.empCode} already exists`);
    }
  }

  const updateFields: any = {};
  if (data.empCode !== undefined) updateFields.empCode = data.empCode.trim();
  if (data.name !== undefined) updateFields.name = data.name.trim();
  if (data.email !== undefined)
    updateFields.email = data.email ? data.email.trim() : null;
  if (data.phone !== undefined)
    updateFields.phone = data.phone ? data.phone.trim() : null;
  if (data.role !== undefined) updateFields.role = data.role.trim();
  if (data.department !== undefined)
    updateFields.department = data.department ? data.department.trim() : null;
  if (data.joiningDate !== undefined)
    updateFields.joiningDate = data.joiningDate || null;
  if (data.baseSalary !== undefined)
    updateFields.baseSalary = Number(data.baseSalary) || 0;
  if (data.appraisalDate !== undefined)
    updateFields.appraisalDate = data.appraisalDate || null;
  if (data.lastAppraisalDate !== undefined)
    updateFields.lastAppraisalDate = data.lastAppraisalDate || null;
  if (data.lastAppraisalSalary !== undefined)
    updateFields.lastAppraisalSalary =
      data.lastAppraisalSalary !== null
        ? Number(data.lastAppraisalSalary)
        : null;
  if (data.lastAppraisalIncrement !== undefined)
    updateFields.lastAppraisalIncrement =
      data.lastAppraisalIncrement !== null
        ? Number(data.lastAppraisalIncrement)
        : null;
  if (data.lastAppraisalNotes !== undefined)
    updateFields.lastAppraisalNotes = data.lastAppraisalNotes
      ? data.lastAppraisalNotes.trim()
      : null;
  if (data.status !== undefined) updateFields.status = data.status;
  if (data.bankName !== undefined)
    updateFields.bankName = data.bankName ? data.bankName.trim() : null;
  if (data.accountNumber !== undefined)
    updateFields.accountNumber = data.accountNumber
      ? data.accountNumber.trim()
      : null;
  if (data.ifscCode !== undefined)
    updateFields.ifscCode = data.ifscCode ? data.ifscCode.trim() : null;
  if (data.notes !== undefined)
    updateFields.notes = data.notes ? data.notes.trim() : null;
  if (data.shiftInTime !== undefined)
    updateFields.shiftInTime = data.shiftInTime
      ? data.shiftInTime.trim()
      : "09:30";
  if (data.shiftOutTime !== undefined)
    updateFields.shiftOutTime = data.shiftOutTime
      ? data.shiftOutTime.trim()
      : "18:30";
  if (data.gracePeriodMinutes !== undefined)
    updateFields.gracePeriodMinutes = Number(data.gracePeriodMinutes) || 0;

  await db.orm.public.Employee.where({ id }).update(updateFields);
  return await db.orm.public.Employee.where({ id }).first();
};

export interface RecordAppraisalDTO {
  newSalary: number;
  appraisalDate: string;
  nextAppraisalDate?: string;
  rating?: string;
  notes?: string;
}

export const recordEmployeeAppraisal = async (
  id: number,
  data: RecordAppraisalDTO,
) => {
  const employee = await db.orm.public.Employee.where({ id }).first();
  if (!employee) {
    throw new Error("Employee not found");
  }

  const previousSalary = Number(employee.baseSalary) || 0;
  const newSalary = Number(data.newSalary) || 0;
  const incrementAmount = Math.round((newSalary - previousSalary) * 100) / 100;
  const incrementPercentage =
    previousSalary > 0
      ? Math.round(((newSalary - previousSalary) / previousSalary) * 10000) /
        100
      : 0;

  // Insert appraisal history record
  const appraisalRecord = await db.orm.public.EmployeeAppraisal.create({
    employeeId: id,
    previousSalary,
    newSalary,
    incrementAmount,
    incrementPercentage,
    appraisalDate: data.appraisalDate,
    nextAppraisalDate: data.nextAppraisalDate || null,
    rating: data.rating?.trim() || null,
    notes: data.notes?.trim() || null,
  });

  // Update employee with revised salary & latest appraisal timestamps
  await db.orm.public.Employee.where({ id }).update({
    baseSalary: newSalary,
    lastAppraisalDate: data.appraisalDate,
    lastAppraisalSalary: previousSalary,
    lastAppraisalIncrement: incrementAmount,
    lastAppraisalNotes: data.notes?.trim() || null,
    appraisalDate: data.nextAppraisalDate || null,
  });

  const updatedEmployee = await db.orm.public.Employee.where({ id }).first();
  return {
    employee: updatedEmployee,
    appraisal: appraisalRecord,
  };
};

export const getEmployeeAppraisals = async (id: number) => {
  const appraisals = await db.orm.public.EmployeeAppraisal.where({
    employeeId: id,
  }).all();
  return appraisals.sort(
    (a, b) =>
      new Date(b.appraisalDate).getTime() - new Date(a.appraisalDate).getTime(),
  );
};

export const deleteEmployee = async (id: number) => {
  const employee = await db.orm.public.Employee.where({ id }).first();
  if (!employee) {
    throw new Error("Employee not found");
  }

  // Instead of deleting, set status to INACTIVE to preserve financial & audit history
  await db.orm.public.Employee.where({ id }).update({ status: "INACTIVE" });
  return { success: true, message: "Employee deactivated successfully" };
};

export interface RecordSalaryDTO {
  employeeId?: number;
  employeeName: string;
  employeeEmail?: string;
  role: string;
  month: number;
  year: number;
  amount: number;
  baseSalary?: number;
  lopDays?: number;
  lopDeduction?: number;
  lateDays?: number;
  lateDeduction?: number;
  paymentMethod?: "CASH" | "UPI" | "CARD" | "NETBANKING" | "CHEQUE";
  reference?: string;
  notes?: string;
  paidById: number;
}

export const recordSalaryPayment = async (data: RecordSalaryDTO) => {
  const salary = await db.orm.public.SalaryPayment.create({
    employeeId: data.employeeId || null,
    employeeName: data.employeeName,
    employeeEmail: data.employeeEmail || null,
    role: data.role,
    month: Number(data.month),
    year: Number(data.year),
    amount: Number(data.amount),
    baseSalary: data.baseSalary !== undefined ? Number(data.baseSalary) : null,
    lopDays: Number(data.lopDays || 0),
    lopDeduction: Number(data.lopDeduction || 0),
    lateDays: Number(data.lateDays || 0),
    lateDeduction: Number(data.lateDeduction || 0),
    paymentDate: new Date().toISOString(),
    paymentMethod: data.paymentMethod || "NETBANKING",
    reference: data.reference || null,
    notes: data.notes || null,
    paidById: data.paidById,
  });

  // If employee is selected and LOP days > 0, log an EmployeeLop record
  if (data.employeeId && Number(data.lopDays) > 0) {
    try {
      await db.orm.public.EmployeeLop.create({
        employeeId: data.employeeId,
        month: Number(data.month),
        year: Number(data.year),
        lopDays: Number(data.lopDays),
        lopAmount: Number(data.lopDeduction || 0),
        reason:
          data.notes ||
          `Salary deduction of ₹${data.lopDeduction || 0} for ${data.lopDays} LOP day(s)`,
      });
    } catch (lopErr) {
      console.error("[LOP Log Error]", lopErr);
    }
  }

  return salary;
};

export const getAllSalaries = async () => {
  const salaries = await db.orm.public.SalaryPayment.all();
  const employees = await db.orm.public.Employee.all();

  return salaries
    .map((s) => {
      const emp = s.employeeId
        ? employees.find((e) => e.id === s.employeeId)
        : null;
      return {
        ...s,
        employeeCode: emp?.empCode || null,
        department: emp?.department || null,
        bankName: emp?.bankName || null,
        accountNumber: emp?.accountNumber || null,
        appraisalDate: emp?.appraisalDate || null,
      };
    })
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
};

// ==================== ATTENDANCE POLICY & TIME TRACKING ====================

export const getShiftLateDeductionRate = (
  employeeShiftInTime?: string | null,
  policy?: any,
): number => {
  if (!policy) return 100;
  const def930 =
    policy.lateDeduction930 !== null && policy.lateDeduction930 !== undefined
      ? Number(policy.lateDeduction930)
      : Number(policy.lateDeductionPerDay || 100);
  const def900 =
    policy.lateDeduction900 !== null && policy.lateDeduction900 !== undefined
      ? Number(policy.lateDeduction900)
      : def930;

  if (!employeeShiftInTime) return def930;

  const clean = String(employeeShiftInTime)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
  // Check if assigned to 09:00 AM shift
  if (clean.startsWith("09:00") || clean.startsWith("9:00")) {
    return def900;
  }
  // Otherwise 09:30 AM or standard shift
  return def930;
};

export const calculateDistanceMeters = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371e3; // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
};

export const getAttendancePolicy = async () => {
  const policies = await db.orm.public.AttendancePolicy.all();
  if (policies.length > 0) {
    const p = policies[0];
    const defPerDay = Number(p.lateDeductionPerDay || 100);
    return {
      ...p,
      geofenceEnabled: p.geofenceEnabled !== false,
      officeLatitude: Number(p.officeLatitude !== null && p.officeLatitude !== undefined ? p.officeLatitude : 13.0827),
      officeLongitude: Number(p.officeLongitude !== null && p.officeLongitude !== undefined ? p.officeLongitude : 80.2707),
      geofenceRadiusMeters: Number(p.geofenceRadiusMeters || 50),
      officeAddress: p.officeAddress || "IZEON INNOVATIVE, Tamil Nadu",
      lateDeductionPerDay: defPerDay,
      lateDeduction900:
        p.lateDeduction900 !== null && p.lateDeduction900 !== undefined
          ? Number(p.lateDeduction900)
          : defPerDay,
      lateDeduction930:
        p.lateDeduction930 !== null && p.lateDeduction930 !== undefined
          ? Number(p.lateDeduction930)
          : defPerDay,
    };
  }
  return await db.orm.public.AttendancePolicy.create({
    expectedInTime: "09:30",
    expectedOutTime: "18:30",
    gracePeriodMinutes: 0,
    lateDeductionPerDay: 100,
    lateDeduction900: 100,
    lateDeduction930: 100,
    deductionType: "FLAT",
    geofenceEnabled: true,
    officeLatitude: 13.0827,
    officeLongitude: 80.2707,
    geofenceRadiusMeters: 50,
    officeAddress: "IZEON INNOVATIVE, Tamil Nadu",
  });
};

export const updateAttendancePolicy = async (data: {
  expectedInTime?: string;
  expectedOutTime?: string;
  gracePeriodMinutes?: number;
  lateDeductionPerDay?: number;
  lateDeduction900?: number;
  lateDeduction930?: number;
  deductionType?: string;
  geofenceEnabled?: boolean;
  officeLatitude?: number;
  officeLongitude?: number;
  geofenceRadiusMeters?: number;
  officeAddress?: string;
}) => {
  const policy = await getAttendancePolicy();
  const updateData: any = {};
  if (data.expectedInTime !== undefined)
    updateData.expectedInTime = data.expectedInTime.trim();
  if (data.expectedOutTime !== undefined)
    updateData.expectedOutTime = data.expectedOutTime.trim();
  if (data.gracePeriodMinutes !== undefined)
    updateData.gracePeriodMinutes = Number(data.gracePeriodMinutes);
  if (data.lateDeduction900 !== undefined)
    updateData.lateDeduction900 = Number(data.lateDeduction900);
  if (data.lateDeduction930 !== undefined) {
    updateData.lateDeduction930 = Number(data.lateDeduction930);
    updateData.lateDeductionPerDay = Number(data.lateDeduction930);
  } else if (data.lateDeductionPerDay !== undefined) {
    updateData.lateDeductionPerDay = Number(data.lateDeductionPerDay);
    if (data.lateDeduction930 === undefined) {
      updateData.lateDeduction930 = Number(data.lateDeductionPerDay);
    }
  }
  if (data.deductionType !== undefined)
    updateData.deductionType = data.deductionType.trim();

  // Geofence settings
  if (data.geofenceEnabled !== undefined)
    updateData.geofenceEnabled = Boolean(data.geofenceEnabled);
  if (data.officeLatitude !== undefined)
    updateData.officeLatitude = Number(data.officeLatitude);
  if (data.officeLongitude !== undefined)
    updateData.officeLongitude = Number(data.officeLongitude);
  if (data.geofenceRadiusMeters !== undefined)
    updateData.geofenceRadiusMeters = Number(data.geofenceRadiusMeters);
  if (data.officeAddress !== undefined)
    updateData.officeAddress = data.officeAddress.trim();

  updateData.updatedAt = new Date().toISOString();

  await db.orm.public.AttendancePolicy.where({ id: policy.id }).update(
    updateData,
  );
  return await getAttendancePolicy();
};

export const calculateLateInfo = (
  inTimeStr: string,
  outTimeStr?: string,
  expectedInTimeStr: string = "09:30",
  graceMinutes: number = 0,
  defaultLateDeduction: number = 100,
) => {
  const parseMinutes = (timeStr: string) => {
    if (!timeStr) return null;
    const clean = timeStr.trim();
    const isPM = /pm/i.test(clean);
    const isAM = /am/i.test(clean);
    const nums = clean.replace(/[^0-9:]/g, "").split(":");
    if (nums.length < 2) return null;
    let hours = parseInt(nums[0], 10);
    const mins = parseInt(nums[1], 10);
    if (isPM && hours < 12) hours += 12;
    if (isAM && hours === 12) hours = 0;
    return hours * 60 + mins;
  };

  const inMins = parseMinutes(inTimeStr);
  const expMins = parseMinutes(expectedInTimeStr);

  let isLate = false;
  let lateMinutes = 0;
  let lateDeduction = 0;

  if (inMins !== null && expMins !== null) {
    const diff = inMins - expMins;
    if (diff > graceMinutes) {
      isLate = true;
      lateMinutes = diff;
      lateDeduction = defaultLateDeduction;
    }
  }

  let workHours = 0;
  if (outTimeStr && inMins !== null) {
    const outMins = parseMinutes(outTimeStr);
    if (outMins !== null && outMins > inMins) {
      workHours = Math.round(((outMins - inMins) / 60) * 10) / 10;
    }
  }

  return { isLate, lateMinutes, lateDeduction, workHours };
};

export interface RecordAttendanceDTO {
  employeeId: number;
  date: string;
  inTime?: string;
  outTime?: string;
  status?: string;
  notes?: string;
  lateDeduction?: number;
  isLate?: boolean;
  punchLatitude?: number;
  punchLongitude?: number;
  punchDistanceMeters?: number;
}

export const recordAttendance = async (data: RecordAttendanceDTO) => {
  const policy = await getAttendancePolicy();
  const employee = await db.orm.public.Employee.where({
    id: Number(data.employeeId),
  }).first();
  if (!employee) throw new Error("Employee not found");

  // Determine expected shift time for this individual employee
  const expectedInTime = employee.shiftInTime || policy.expectedInTime;
  const expectedOutTime = employee.shiftOutTime || policy.expectedOutTime;
  const graceMinutes =
    employee.gracePeriodMinutes !== null &&
    employee.gracePeriodMinutes !== undefined
      ? Number(employee.gracePeriodMinutes)
      : policy.gracePeriodMinutes;

  // Shift-specific late deduction rate (9:00 shift vs 9:30 shift)
  const shiftLateRate = getShiftLateDeductionRate(employee.shiftInTime, policy);

  let isLate = data.isLate ?? false;
  let lateMinutes = 0;
  let lateDeduction =
    data.lateDeduction !== undefined ? Number(data.lateDeduction) : 0;
  let workHours = 0;

  if (data.inTime && data.inTime.trim()) {
    const calc = calculateLateInfo(
      data.inTime,
      data.outTime || expectedOutTime,
      expectedInTime,
      graceMinutes,
      shiftLateRate,
    );
    if (data.isLate === undefined) {
      isLate = calc.isLate;
    }
    lateMinutes = calc.lateMinutes;
    if (data.lateDeduction !== undefined) {
      lateDeduction = Number(data.lateDeduction);
    } else if (isLate) {
      // 3 Consecutive Late Days Policy:
      // Day 1 & Day 2 late -> No deduction (₹0)
      // Only when consistently late for 3rd day -> Deduct 1 day salary (baseSalary / 30)
      const monthStart = data.date.slice(0, 7) + "-01";
      const allPrior = await db.orm.public.EmployeeAttendance.where({
        employeeId: Number(data.employeeId),
      }).all();

      const priorThisMonth = allPrior
        .filter((a) => a.date >= monthStart && a.date < data.date.trim())
        .sort((a, b) => a.date.localeCompare(b.date));

      let streakBefore = 0;
      for (const a of priorThisMonth) {
        const wasLate =
          (a.isLate || a.status === "LATE") && a.status !== "PERMISSION";
        if (wasLate) {
          streakBefore += 1;
        } else {
          streakBefore = 0;
        }
      }

      const currentStreak = streakBefore + 1;
      const isThirdConsecutive = currentStreak >= 3 && currentStreak % 3 === 0;
      const dailySalary =
        employee.baseSalary && employee.baseSalary > 0
          ? Math.round((Number(employee.baseSalary) / 30) * 100) / 100
          : 0;

      lateDeduction = isThirdConsecutive ? dailySalary : 0;
    } else {
      lateDeduction = 0;
    }
    workHours = calc.workHours;
  }

  let status =
    data.status || (isLate ? "LATE" : data.inTime ? "PRESENT" : "ABSENT");

  if (status === "PERMISSION") {
    isLate = false;
    lateMinutes = 0;
    if (data.lateDeduction === undefined) {
      lateDeduction = 0;
    }
  }

  const existing = await db.orm.public.EmployeeAttendance.where({
    employeeId: Number(data.employeeId),
    date: data.date.trim(),
  }).first();

  const punchLatitude =
    data.punchLatitude !== undefined
      ? Number(data.punchLatitude)
      : existing?.punchLatitude ?? null;
  const punchLongitude =
    data.punchLongitude !== undefined
      ? Number(data.punchLongitude)
      : existing?.punchLongitude ?? null;
  const punchDistanceMeters =
    data.punchDistanceMeters !== undefined
      ? Number(data.punchDistanceMeters)
      : existing?.punchDistanceMeters ?? null;

  if (existing) {
    await db.orm.public.EmployeeAttendance.where({ id: existing.id }).update({
      inTime: data.inTime ? data.inTime.trim() : null,
      outTime: data.outTime ? data.outTime.trim() : null,
      workHours,
      isLate,
      lateMinutes,
      lateDeduction,
      status,
      notes: data.notes ? data.notes.trim() : null,
      punchLatitude,
      punchLongitude,
      punchDistanceMeters,
      updatedAt: new Date().toISOString(),
    });
    return await db.orm.public.EmployeeAttendance.where({
      id: existing.id,
    }).first();
  } else {
    return await db.orm.public.EmployeeAttendance.create({
      employeeId: Number(data.employeeId),
      date: data.date.trim(),
      inTime: data.inTime ? data.inTime.trim() : null,
      outTime: data.outTime ? data.outTime.trim() : null,
      workHours,
      isLate,
      lateMinutes,
      lateDeduction,
      status,
      notes: data.notes ? data.notes.trim() : null,
      punchLatitude,
      punchLongitude,
      punchDistanceMeters,
    });
  }
};

export const recordBulkAttendance = async (
  date: string,
  entries: Array<{
    employeeId: number;
    inTime?: string;
    outTime?: string;
    status?: string;
    isLate?: boolean;
    lateDeduction?: number;
    notes?: string;
  }>,
) => {
  const results = [];
  for (const entry of entries) {
    try {
      const res = await recordAttendance({
        date,
        employeeId: entry.employeeId,
        inTime: entry.inTime,
        outTime: entry.outTime,
        status: entry.status,
        isLate: entry.isLate,
        lateDeduction: entry.lateDeduction,
        notes: entry.notes,
      });
      results.push(res);
    } catch (err: any) {
      console.error(
        `Bulk attendance error for emp ${entry.employeeId}:`,
        err.message,
      );
    }
  }
  return results;
};

/**
 * Calculates late statistics and automatically deducts 1 day's salary for every 3 consecutive late days
 */
export const calculateConsecutiveLatePenalties = (
  attendances: any[],
  baseSalary: number
) => {
  const sorted = [...attendances].sort((a, b) => a.date.localeCompare(b.date));

  let totalLateDays = 0;
  let currentConsecutiveLate = 0;
  let maxConsecutiveLate = 0;
  let consecutivePenaltyDays = 0;

  for (const att of sorted) {
    const isLate =
      (att.isLate || att.status === "LATE") && att.status !== "PERMISSION";

    if (isLate) {
      totalLateDays += 1;
      currentConsecutiveLate += 1;
      if (currentConsecutiveLate > maxConsecutiveLate) {
        maxConsecutiveLate = currentConsecutiveLate;
      }
      // Every 3 consecutive days late triggers a 1-day salary deduction
      if (currentConsecutiveLate % 3 === 0) {
        consecutivePenaltyDays += 1;
      }
    } else {
      // Coming on time or approved permission resets the consecutive streak
      currentConsecutiveLate = 0;
    }
  }

  const dailySalaryRate =
    baseSalary > 0 ? Math.round((baseSalary / 30) * 100) / 100 : 0;
  const consecutiveLateDeduction =
    Math.round(dailySalaryRate * consecutivePenaltyDays * 100) / 100;

  return {
    totalLateDays,
    currentConsecutiveLateDays: currentConsecutiveLate,
    maxConsecutiveLateDays: maxConsecutiveLate,
    consecutivePenaltyDays,
    dailySalaryRate,
    consecutiveLateDeduction,
    isThirdConsecutiveLate:
      currentConsecutiveLate >= 3 && currentConsecutiveLate % 3 === 0,
  };
};

export const getAttendanceByDate = async (date: string) => {
  const employees = await db.orm.public.Employee.where({
    status: "ACTIVE",
  }).all();
  const attendances = await db.orm.public.EmployeeAttendance.where({
    date,
  }).all();
  const allAttendances = await db.orm.public.EmployeeAttendance.all();
  const policy = await getAttendancePolicy();
  const monthStart = date.slice(0, 7) + "-01";

  return employees
    .map((emp) => {
      const att = attendances.find((a) => a.employeeId === emp.id);
      const expectedInTime = emp.shiftInTime || policy.expectedInTime;
      const expectedOutTime = emp.shiftOutTime || policy.expectedOutTime;
      const graceMinutes =
        emp.gracePeriodMinutes !== null && emp.gracePeriodMinutes !== undefined
          ? Number(emp.gracePeriodMinutes)
          : policy.gracePeriodMinutes;
      const employeeLateRate = getShiftLateDeductionRate(
        emp.shiftInTime,
        policy,
      );

      const isPermission = att?.status === "PERMISSION";

      // Compute employee's consecutive late streak up to this date
      const empMonthAtt = allAttendances
        .filter(
          (a) =>
            a.employeeId === emp.id &&
            a.date <= date &&
            a.date >= monthStart
        )
        .sort((a, b) => a.date.localeCompare(b.date));
      const penaltyCalc = calculateConsecutiveLatePenalties(
        empMonthAtt,
        emp.baseSalary || 0
      );

      return {
        employeeId: emp.id,
        empCode: emp.empCode,
        name: emp.name,
        role: emp.role,
        department: emp.department,
        baseSalary: emp.baseSalary,
        shiftInTime: expectedInTime,
        shiftOutTime: expectedOutTime,
        gracePeriodMinutes: graceMinutes,
        date,
        attendanceId: att?.id || null,
        inTime: att?.inTime || "",
        outTime: att?.outTime || "",
        punchLatitude: att?.punchLatitude ?? null,
        punchLongitude: att?.punchLongitude ?? null,
        punchDistanceMeters: att?.punchDistanceMeters ?? null,
        workHours: att?.workHours || 0,
        isLate: isPermission ? false : att?.isLate || false,
        lateMinutes: isPermission ? 0 : att?.lateMinutes || 0,
        lateDeduction: isPermission
          ? 0
          : penaltyCalc.isThirdConsecutiveLate
            ? (att?.lateDeduction !== undefined && att?.lateDeduction !== null && Number(att.lateDeduction) > 0
                ? Number(att.lateDeduction)
                : penaltyCalc.dailySalaryRate)
            : 0,
        status: att?.status || "NOT_MARKED",
        notes: att?.notes || "",
        policyExpectedInTime: expectedInTime,
        policyGraceMinutes: graceMinutes,
        policyLateDeduction: employeeLateRate,
        consecutiveLateDays: penaltyCalc.currentConsecutiveLateDays,
        consecutivePenaltyDays: penaltyCalc.consecutivePenaltyDays,
        consecutiveLateDeduction: penaltyCalc.consecutiveLateDeduction,
        dailySalaryRate: penaltyCalc.dailySalaryRate,
        isThirdConsecutiveLate:
          penaltyCalc.currentConsecutiveLateDays >= 3 &&
          penaltyCalc.currentConsecutiveLateDays % 3 === 0,
      };
    })
    .sort((a, b) => a.empCode.localeCompare(b.empCode));
};

export const getAttendanceRegister = async (filters?: {
  startDate?: string;
  endDate?: string;
  employeeId?: number;
  month?: string;
}) => {
  const allEmployees = await db.orm.public.Employee.all();
  let attendances = await db.orm.public.EmployeeAttendance.all();
  const policy = await getAttendancePolicy();

  if (filters?.employeeId) {
    attendances = attendances.filter(
      (a) => a.employeeId === Number(filters.employeeId)
    );
  }
  if (filters?.month) {
    attendances = attendances.filter((a) => a.date.startsWith(filters.month!));
  }
  if (filters?.startDate) {
    attendances = attendances.filter((a) => a.date >= filters.startDate!);
  }
  if (filters?.endDate) {
    attendances = attendances.filter((a) => a.date <= filters.endDate!);
  }

  // Filter entries that have timing registered or attendance marked
  const registeredEntries = attendances.filter(
    (a) =>
      (a.inTime && a.inTime.trim().length > 0) ||
      (a.outTime && a.outTime.trim().length > 0) ||
      (a.status && a.status !== "NOT_MARKED")
  );

  const register = registeredEntries.map((att) => {
    const emp = allEmployees.find((e) => e.id === att.employeeId);
    const expectedInTime = emp?.shiftInTime || policy.expectedInTime;
    const expectedOutTime = emp?.shiftOutTime || policy.expectedOutTime;
    const isPermission = att.status === "PERMISSION";

    return {
      attendanceId: att.id,
      date: att.date,
      employeeId: att.employeeId,
      empCode: emp?.empCode || `EMP-${att.employeeId}`,
      employeeName: emp?.name || "Unknown Staff",
      role: emp?.role || "Staff",
      department: emp?.department || "General",
      shiftInTime: expectedInTime,
      shiftOutTime: expectedOutTime,
      assignedShift: `${expectedInTime} - ${expectedOutTime}`,
      inTime: att.inTime || "-",
      outTime: att.outTime || "-",
      workHours: att.workHours || 0,
      status: att.status || (att.inTime ? "PRESENT" : "ABSENT"),
      isLate: isPermission ? false : att.isLate || false,
      lateMinutes: isPermission ? 0 : att.lateMinutes || 0,
      lateDeduction: isPermission ? 0 : att.lateDeduction || 0,
      punchDistanceMeters: att.punchDistanceMeters ?? null,
      notes: att.notes || "",
      createdAt: att.createdAt,
      updatedAt: att.updatedAt,
    };
  });

  return register.sort((a, b) => {
    const dateComp = b.date.localeCompare(a.date);
    if (dateComp !== 0) return dateComp;
    return a.employeeName.localeCompare(b.employeeName);
  });
};

export const getAttendanceMonthlySummary = async (
  month: number,
  year: number,
  employeeId?: number,
) => {
  const allEmployees = await db.orm.public.Employee.all();
  const allAttendances = await db.orm.public.EmployeeAttendance.all();

  const monthStr = `${year}-${String(month).padStart(2, "0")}`;
  const monthAttendances = allAttendances.filter((a) =>
    a.date.startsWith(monthStr),
  );

  const targetEmployees = employeeId
    ? allEmployees.filter((e) => e.id === Number(employeeId))
    : allEmployees;

  const result = targetEmployees.map((emp) => {
    const empAtt = monthAttendances.filter((a) => a.employeeId === emp.id);
    const penalties = calculateConsecutiveLatePenalties(
      empAtt,
      emp.baseSalary || 0,
    );

    const presentDays = empAtt.filter(
      (a) =>
        a.status === "PRESENT" ||
        a.status === "LATE" ||
        a.status === "PERMISSION",
    ).length;
    const permissionDays = empAtt.filter(
      (a) => a.status === "PERMISSION",
    ).length;
    const halfDays = empAtt.filter((a) => a.status === "HALF_DAY").length;
    const absentDays = empAtt.filter((a) => a.status === "ABSENT").length;
    const totalWorkHours = empAtt.reduce(
      (sum, a) => sum + (a.workHours || 0),
      0,
    );

    const rawAttLateDeduction = empAtt.reduce(
      (sum, a) => sum + (Number(a.lateDeduction) || 0),
      0,
    );

    const totalLateDeduction = penalties.consecutiveLateDeduction;

    return {
      employeeId: emp.id,
      empCode: emp.empCode,
      name: emp.name,
      role: emp.role,
      department: emp.department,
      baseSalary: emp.baseSalary,
      month,
      year,
      presentDays,
      permissionDays,
      lateDays: penalties.totalLateDays,
      consecutiveLatePenaltyDays: penalties.consecutivePenaltyDays,
      consecutiveLateDeduction: penalties.consecutiveLateDeduction,
      dailySalaryRate: penalties.dailySalaryRate,
      currentConsecutiveLateDays: penalties.currentConsecutiveLateDays,
      totalLateDeduction: Math.round(totalLateDeduction * 100) / 100,
      totalWorkHours: Math.round(totalWorkHours * 10) / 10,
      halfDays,
      absentDays,
      records: empAtt.sort((a, b) => a.date.localeCompare(b.date)),
    };
  });

  return employeeId ? result[0] || null : result;
};

export const getEmployeePayrollPrep = async (
  employeeId: number,
  month: number,
  year: number,
) => {
  const employee = await db.orm.public.Employee.where({
    id: Number(employeeId),
  }).first();
  if (!employee) throw new Error("Employee not found");

  const baseSalary = employee.baseSalary || 0;

  // LOP records for this employee, month & year
  const lopRecords = await db.orm.public.EmployeeLop.where({
    employeeId: Number(employeeId),
    month: Number(month),
    year: Number(year),
  }).all();

  const lopDays = lopRecords.reduce(
    (acc, curr) => acc + (curr.lopDays || 0),
    0,
  );
  let lopDeduction = lopRecords.reduce(
    (acc, curr) => acc + (curr.lopAmount || 0),
    0,
  );
  if (lopDeduction === 0 && lopDays > 0 && baseSalary > 0) {
    lopDeduction = Math.round((baseSalary / 30) * lopDays * 100) / 100;
  }

  // Attendance late records for this month
  const monthStr = `${year}-${String(month).padStart(2, "0")}`;
  const allAttendances = await db.orm.public.EmployeeAttendance.all();
  const empMonthAtt = allAttendances.filter(
    (a) => a.employeeId === Number(employeeId) && a.date.startsWith(monthStr),
  );

  const penalties = calculateConsecutiveLatePenalties(
    empMonthAtt,
    baseSalary,
  );

  const rawAttLateDeduction = empMonthAtt.reduce(
    (sum, a) => sum + (Number(a.lateDeduction) || 0),
    0,
  );

  const lateDeduction = penalties.consecutiveLateDeduction;

  const netPayable = Math.max(
    0,
    Math.round((baseSalary - lopDeduction - lateDeduction) * 100) / 100,
  );

  return {
    employeeId: employee.id,
    employeeName: employee.name,
    employeeEmail: employee.email,
    role: employee.role,
    department: employee.department,
    month: Number(month),
    year: Number(year),
    baseSalary,
    lopDays,
    lopDeduction: Math.round(lopDeduction * 100) / 100,
    lateDays: penalties.totalLateDays,
    consecutiveLatePenaltyDays: penalties.consecutivePenaltyDays,
    consecutiveLateDeduction: penalties.consecutiveLateDeduction,
    dailySalaryRate: penalties.dailySalaryRate,
    lateDeduction: Math.round(lateDeduction * 100) / 100,
    netPayable,
  };
};

// ==================== FINANCIAL REPORTS & ANALYTICS ====================
// Filter by 'day', 'week', 'month', or 'all'
export const getFinancialReport = async (
  filter: "day" | "week" | "month" | "all" = "all",
) => {
  const now = new Date();
  let startDate: Date | null = null;

  if (filter === "day") {
    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  } else if (filter === "week") {
    const dayOfWeek = now.getDay();
    startDate = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - dayOfWeek,
    );
  } else if (filter === "month") {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  }

  const allInvoices = await db.orm.public.Invoice.all();
  const allExpenses = await db.orm.public.Expense.all();
  const allSalaries = await db.orm.public.SalaryPayment.all();

  // Filter items after startDate if provided
  const invoices = startDate
    ? allInvoices.filter((i) => new Date(i.issuedAt) >= startDate!)
    : allInvoices;

  const expenses = startDate
    ? allExpenses.filter((e) => new Date(e.expenseDate) >= startDate!)
    : allExpenses;

  const salaries = startDate
    ? allSalaries.filter((s) => new Date(s.paymentDate) >= startDate!)
    : allSalaries;

  const totalRevenue = invoices.reduce((acc, curr) => acc + curr.amountPaid, 0);
  const totalTaxCollected = invoices.reduce(
    (acc, curr) => acc + (curr.cgstAmount + curr.sgstAmount),
    0,
  );
  const totalGeneralExpenses = expenses.reduce(
    (acc, curr) => acc + curr.amount,
    0,
  );
  const totalSalariesPaid = salaries.reduce(
    (acc, curr) => acc + curr.amount,
    0,
  );
  const totalOutflow = totalGeneralExpenses + totalSalariesPaid;
  const netProfit = totalRevenue - totalOutflow;

  return {
    filter,
    periodStart: startDate ? startDate.toISOString() : "Beginning",
    periodEnd: now.toISOString(),
    summary: {
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalTaxCollected: Math.round(totalTaxCollected * 100) / 100,
      totalGeneralExpenses: Math.round(totalGeneralExpenses * 100) / 100,
      totalSalariesPaid: Math.round(totalSalariesPaid * 100) / 100,
      totalExpenses: Math.round(totalOutflow * 100) / 100,
      netProfit: Math.round(netProfit * 100) / 100,
      transactionCount: invoices.length,
    },
    invoices,
    expenses,
    salaries,
  };
};
