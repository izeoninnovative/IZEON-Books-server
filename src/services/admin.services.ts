import bcrypt from "bcrypt";
import { db } from "../prisma/db.js";

// ==================== HR USER MANAGEMENT ====================
export interface CreateHRDTO {
  username: string;
  email: string;
  password: string;
}

export const createHRUser = async (data: CreateHRDTO) => {
  const existing = await db.orm.public.User.where({ email: data.email }).first();
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

  const { password, ...safeUser } = hrUser;
  return safeUser;
};

export const getAllHRUsers = async () => {
  const users = await db.orm.public.User.where({ role: "HR" }).all();
  const allInvoices = await db.orm.public.Invoice.all() // get all invoices
  return users.map(({ password, ...user }) => {
    const hrInvoices = allInvoices.filter((invoice) => invoice.createdById === user.id )
    const totalRevenueGenerated = hrInvoices.reduce((acc, curr) => acc + (curr.amountPaid || 0), 0)

   return{
      ...user,
      totalRevenueGenerated: Math.round(totalRevenueGenerated * 100) / 100,
      invoiceCount: hrInvoices.length
   } 
   
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
    const emailConflict = await db.orm.public.User.where({ email: data.email }).first();
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
  category: "RENT" | "UTILITIES" | "MARKETING" | "EQUIPMENT" | "MAINTENANCE" | "SALARY" | "OTHER";
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
  return expenses.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
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
  status?: "ACTIVE" | "INACTIVE";
  bankName?: string;
  accountNumber?: string;
  ifscCode?: string;
  notes?: string;
}

export const generateEmployeeCode = async (): Promise<string> => {
  const employees = await db.orm.public.Employee.all();
  const nextNumber = employees.length + 1;
  return `EMP-${String(nextNumber).padStart(3, "0")}`;
};

export const createEmployee = async (data: CreateEmployeeDTO) => {
  const empCode = data.empCode?.trim() || (await generateEmployeeCode());
  
  // Verify code uniqueness
  const existing = await db.orm.public.Employee.where({ empCode }).first();
  if (existing) {
    throw new Error(`Employee with ID/Code ${empCode} already exists`);
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
    status: data.status || "ACTIVE",
    bankName: data.bankName?.trim() || null,
    accountNumber: data.accountNumber?.trim() || null,
    ifscCode: data.ifscCode?.trim() || null,
    notes: data.notes?.trim() || null,
  });
};

export const getAllEmployees = async () => {
  const employees = await db.orm.public.Employee.all();
  const salaries = await db.orm.public.SalaryPayment.all();
  const lopRecords = await db.orm.public.EmployeeLop.all();

  return employees
    .map((emp) => {
      const empSalaries = salaries.filter((s) => s.employeeId === emp.id);
      const empLops = lopRecords.filter((l) => l.employeeId === emp.id);
      const totalPaid = empSalaries.reduce((acc, curr) => acc + curr.amount, 0);
      const totalLopDays = empLops.reduce((acc, curr) => acc + (curr.lopDays || 0), 0);

      return {
        ...emp,
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

  const salaries = await db.orm.public.SalaryPayment.where({ employeeId: id }).all();
  const lopRecords = await db.orm.public.EmployeeLop.where({ employeeId: id }).all();

  return {
    ...employee,
    salaries: salaries.sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime()),
    lopRecords: lopRecords.sort((a, b) => b.year - a.year || b.month - a.month),
  };
};

export const updateEmployee = async (id: number, data: UpdateEmployeeDTO) => {
  const employee = await db.orm.public.Employee.where({ id }).first();
  if (!employee) {
    throw new Error("Employee not found");
  }

  if (data.empCode && data.empCode !== employee.empCode) {
    const existing = await db.orm.public.Employee.where({ empCode: data.empCode }).first();
    if (existing && existing.id !== id) {
      throw new Error(`Employee with ID/Code ${data.empCode} already exists`);
    }
  }

  const updateFields: any = {};
  if (data.empCode !== undefined) updateFields.empCode = data.empCode.trim();
  if (data.name !== undefined) updateFields.name = data.name.trim();
  if (data.email !== undefined) updateFields.email = data.email ? data.email.trim() : null;
  if (data.phone !== undefined) updateFields.phone = data.phone ? data.phone.trim() : null;
  if (data.role !== undefined) updateFields.role = data.role.trim();
  if (data.department !== undefined) updateFields.department = data.department ? data.department.trim() : null;
  if (data.joiningDate !== undefined) updateFields.joiningDate = data.joiningDate || null;
  if (data.baseSalary !== undefined) updateFields.baseSalary = Number(data.baseSalary) || 0;
  if (data.appraisalDate !== undefined) updateFields.appraisalDate = data.appraisalDate || null;
  if (data.status !== undefined) updateFields.status = data.status;
  if (data.bankName !== undefined) updateFields.bankName = data.bankName ? data.bankName.trim() : null;
  if (data.accountNumber !== undefined) updateFields.accountNumber = data.accountNumber ? data.accountNumber.trim() : null;
  if (data.ifscCode !== undefined) updateFields.ifscCode = data.ifscCode ? data.ifscCode.trim() : null;
  if (data.notes !== undefined) updateFields.notes = data.notes ? data.notes.trim() : null;

  await db.orm.public.Employee.where({ id }).update(updateFields);
  return await db.orm.public.Employee.where({ id }).first();
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
        reason: data.notes || `Salary deduction of ₹${data.lopDeduction || 0} for ${data.lopDays} LOP day(s)`,
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
      const emp = s.employeeId ? employees.find((e) => e.id === s.employeeId) : null;
      return {
        ...s,
        employeeCode: emp?.empCode || null,
        department: emp?.department || null,
        bankName: emp?.bankName || null,
        accountNumber: emp?.accountNumber || null,
        appraisalDate: emp?.appraisalDate || null,
      };
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
};

// ==================== FINANCIAL REPORTS & ANALYTICS ====================
// Filter by 'day', 'week', 'month', or 'all'
export const getFinancialReport = async (filter: "day" | "week" | "month" | "all" = "all") => {
  const now = new Date();
  let startDate: Date | null = null;

  if (filter === "day") {
    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  } else if (filter === "week") {
    const dayOfWeek = now.getDay();
    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek);
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
  const totalTaxCollected = invoices.reduce((acc, curr) => acc + (curr.cgstAmount + curr.sgstAmount), 0);
  const totalGeneralExpenses = expenses.reduce((acc, curr) => acc + curr.amount, 0);
  const totalSalariesPaid = salaries.reduce((acc, curr) => acc + curr.amount, 0);
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
