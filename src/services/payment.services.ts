import { db } from "../prisma/db.js";
import { generateInvoiceNo } from "./student.services.js";

export interface PayEmiDTO {
  emiScheduleId: number;
  amountPaid: number;
  paymentMethod: "CASH" | "UPI" | "CARD" | "NETBANKING" | "CHEQUE";
  transactionRef?: string;
}

export const payEmiInstallment = async (data: PayEmiDTO) => {
  const emi = await db.orm.public.EmiSchedule.where({ id: data.emiScheduleId }).first();
  if (!emi) {
    throw new Error("EMI Schedule installment not found");
  }

  if (emi.status === "PAID") {
    throw new Error("This EMI installment has already been paid");
  }

  const feePlan = await db.orm.public.FeePlan.where({ id: emi.feePlanId }).first();
  if (!feePlan) {
    throw new Error("Associated fee plan not found");
  }

  const student = await db.orm.public.Student.where({ id: feePlan.studentId }).first();
  if (!student) {
    throw new Error("Student record not found");
  }

  // 1. Mark EMI schedule as PAID
  const updatedEmi = await db.orm.public.EmiSchedule.where({ id: emi.id }).update({
    status: "PAID",
    paidDate: new Date().toISOString(),
  });

  // 2. Update FeePlan paid and balance amounts
  const newPaidAmount = feePlan.paidAmount + Number(data.amountPaid);
  const newBalanceAmount = Math.max(0, feePlan.totalAmount - newPaidAmount);

  await db.orm.public.FeePlan.where({ id: feePlan.id }).update({
    paidAmount: newPaidAmount,
    balanceAmount: newBalanceAmount,
  });

  // 3. Generate Invoice Receipt
  const invoiceNo = await generateInvoiceNo(feePlan.invoiceType);
  const isGst = feePlan.invoiceType === "GST";
  const taxableAmount = isGst ? Math.round((data.amountPaid / 1.18) * 100) / 100 : data.amountPaid;
  const gstAmount = isGst ? data.amountPaid - taxableAmount : 0;
  const halfGst = isGst ? Math.round((gstAmount / 2) * 100) / 100 : 0;

  const invoice = await db.orm.public.Invoice.create({
    invoiceNo,
    studentId: student.id,
    feePlanId: feePlan.id,
    emiScheduleId: emi.id,
    invoiceType: feePlan.invoiceType,
    paymentMethod: data.paymentMethod,
    transactionRef: data.transactionRef || null,
    amountPaid: Number(data.amountPaid),
    taxableAmount,
    cgstAmount: halfGst,
    sgstAmount: halfGst,
    totalAmount: Number(data.amountPaid),
  });

  return {
    invoice,
    updatedEmi,
    remainingBalance: newBalanceAmount,
  };
};

export const getInvoiceById = async (invoiceId: number) => {
  const invoice = await db.orm.public.Invoice.where({ id: invoiceId }).first();
  if (!invoice) {
    throw new Error("Invoice not found");
  }

  const student = await db.orm.public.Student.where({ id: invoice.studentId }).first();
  const feePlan = await db.orm.public.FeePlan.where({ id: invoice.feePlanId }).first();
  const course = student ? await db.orm.public.Course.where({ id: student.courseId }).first() : null;

  return {
    ...invoice,
    student,
    course,
    feePlan,
  };
};

export const getAllInvoices = async () => {
  const invoices = await db.orm.public.Invoice.all();
  const students = await db.orm.public.Student.all();

  return invoices.map((inv) => {
    const student = students.find((s) => s.id === inv.studentId);
    return {
      ...inv,
      studentName: student?.name || "N/A",
      studentEmail: student?.email || "N/A",
    };
  });
};
