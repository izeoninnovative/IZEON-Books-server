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

// ==================== PAYROLL & SALARY ====================
export interface RecordSalaryDTO {
  employeeName: string;
  employeeEmail?: string;
  role: string;
  month: number;
  year: number;
  amount: number;
  paymentMethod?: "CASH" | "UPI" | "CARD" | "NETBANKING" | "CHEQUE";
  reference?: string;
  notes?: string;
  paidById: number;
}

export const recordSalaryPayment = async (data: RecordSalaryDTO) => {
  return await db.orm.public.SalaryPayment.create({
    employeeName: data.employeeName,
    employeeEmail: data.employeeEmail || null,
    role: data.role,
    month: Number(data.month),
    year: Number(data.year),
    amount: Number(data.amount),
    paymentDate: new Date().toISOString(),
    paymentMethod: data.paymentMethod || "NETBANKING",
    reference: data.reference || null,
    notes: data.notes || null,
    paidById: data.paidById,
  });
};

export const getAllSalaries = async () => {
  const salaries = await db.orm.public.SalaryPayment.all();
  return salaries.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
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
