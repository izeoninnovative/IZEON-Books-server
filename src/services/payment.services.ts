/** @format */

import { db } from "../prisma/db.js";
import { generateInvoiceNo } from "./student.services.js";
import { sendInvoiceReceiptEmail } from "./email.services.js";
import { getCompanyProfile } from "./company.services.js";
import { createInvoicePdf } from "./invoice-pdf.services.js";

export interface PayEmiDTO {
  emiScheduleId: number;
  amountPaid: number;
  paymentMethod: "CASH" | "UPI" | "CARD" | "NETBANKING" | "CHEQUE";
  transactionRef?: string;
  createdById?: number;
}

export const payEmiInstallment = async (data: PayEmiDTO) => {
  const emi = await db.orm.public.EmiSchedule.where({
    id: data.emiScheduleId,
  }).first();
  if (!emi) {
    throw new Error("EMI Schedule installment not found");
  }

  if (emi.status === "PAID") {
    throw new Error("This EMI installment has already been paid");
  }

  const feePlan = await db.orm.public.FeePlan.where({
    id: emi.feePlanId,
  }).first();
  if (!feePlan) {
    throw new Error("Associated fee plan not found");
  }

  const remainingBalance = Math.max(
    0,
    Math.round(Number(feePlan.balanceAmount) * 100) / 100,
  );

  if (remainingBalance <= 0) {
    throw new Error(
      "This student's course fee is already fully paid. No outstanding balance remains.",
    );
  }

  const amountToPay = Math.round(Number(data.amountPaid) * 100) / 100;
  if (amountToPay <= 0) {
    throw new Error("Payment amount must be greater than zero");
  }

  // Strict accounting validation: Prevent excess payment
  if (amountToPay > remainingBalance) {
    throw new Error(
      `Payment amount ₹${amountToPay.toLocaleString("en-IN")} exceeds the remaining balance of ₹${remainingBalance.toLocaleString("en-IN")}. Please collect only up to ₹${remainingBalance.toLocaleString("en-IN")}.`,
    );
  }

  const student = await db.orm.public.Student.where({
    id: feePlan.studentId,
  }).first();
  if (!student) {
    throw new Error("Student record not found");
  }

  // 1. Mark target EMI schedule as PAID
  const nowIso = new Date().toISOString();
  const updatedEmi = await db.orm.public.EmiSchedule.where({
    id: emi.id,
  }).update({
    status: "PAID",
    paidDate: nowIso,
  });

  // 2. Update FeePlan paid and balance amounts
  const newPaidAmount = Math.min(
    feePlan.totalAmount,
    Math.round((feePlan.paidAmount + amountToPay) * 100) / 100,
  );
  const newBalanceAmount = Math.max(
    0,
    Math.round((feePlan.totalAmount - newPaidAmount) * 100) / 100,
  );

  await db.orm.public.FeePlan.where({ id: feePlan.id }).update({
    paidAmount: newPaidAmount,
    balanceAmount: newBalanceAmount,
  });

  // 3. If full payment is achieved (balance is 0), automatically clear ALL remaining EMIs!
  if (newBalanceAmount <= 0) {
    const allEmis = await db.orm.public.EmiSchedule.where({
      feePlanId: feePlan.id,
    }).all();
    for (const sched of allEmis) {
      if (sched.status !== "PAID") {
        await db.orm.public.EmiSchedule.where({ id: sched.id }).update({
          status: "PAID",
          paidDate: nowIso,
        });
      }
    }
  } else if (amountToPay > emi.amount) {
    // If student paid excess that covers subsequent installments, mark them as paid too
    let surplus = amountToPay - emi.amount;
    const futurePendingEmis = await db.orm.public.EmiSchedule.where({
      feePlanId: feePlan.id,
      status: "PENDING",
    }).all();
    futurePendingEmis.sort((a, b) => a.installmentNo - b.installmentNo);

    for (const future of futurePendingEmis) {
      if (future.id === emi.id) continue;
      if (surplus >= future.amount) {
        await db.orm.public.EmiSchedule.where({ id: future.id }).update({
          status: "PAID",
          paidDate: nowIso,
        });
        surplus -= future.amount;
      }
    }
  }

  // 3. Generate Invoice Receipt
  const invoiceNo = await generateInvoiceNo(feePlan.invoiceType);
  const isGst = feePlan.invoiceType === "GST";
  const taxableAmount = isGst
    ? Math.round((data.amountPaid / 1.18) * 100) / 100
    : data.amountPaid;
  const gstAmount = isGst ? data.amountPaid - taxableAmount : 0;
  const halfGst = isGst ? Math.round((gstAmount / 2) * 100) / 100 : 0;

  const invoice = await db.orm.public.Invoice.create({
    invoiceNo,
    studentId: student.id,
    feePlanId: feePlan.id,
    emiScheduleId: emi.id,
    createdById: data.createdById || null,
    invoiceType: feePlan.invoiceType,
    paymentMethod: data.paymentMethod,
    transactionRef: data.transactionRef || null,
    amountPaid: Number(data.amountPaid),
    taxableAmount,
    cgstAmount: halfGst,
    sgstAmount: halfGst,
    totalAmount: Number(data.amountPaid),
  });

  // Automatically send receipt to student via email (runs asynchronously)
  (async () => {
    try {
      const course = student
        ? await db.orm.public.Course.where({ id: student.courseId }).first()
        : null;
      await sendInvoiceReceiptEmail({
        studentName: student.name,
        studentEmail: student.email,
        invoiceNo: invoice.invoiceNo,
        invoiceType: invoice.invoiceType,
        amountPaid: invoice.amountPaid,
        taxableAmount: invoice.taxableAmount,
        cgstAmount: invoice.cgstAmount,
        sgstAmount: invoice.sgstAmount,
        paymentMethod: invoice.paymentMethod,
        transactionRef: invoice.transactionRef,
        issuedAt: invoice.issuedAt,
        courseTitle: course?.title,
        balanceAmount: newBalanceAmount,
      });
    } catch (err) {
      console.error("[Email Error]", err);
    }
  })();

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

  const student = await db.orm.public.Student.where({
    id: invoice.studentId,
  }).first();
  const feePlan = await db.orm.public.FeePlan.where({
    id: invoice.feePlanId,
  }).first();
  const course = student
    ? await db.orm.public.Course.where({ id: student.courseId }).first()
    : null;

  return {
    ...invoice,
    student,
    course,
    feePlan,
  };
};

export const emailInvoiceById = async (invoiceId: number) => {
  const invoiceDetails = await getInvoiceById(invoiceId);
  const { student, course, feePlan } = invoiceDetails;
  if (!student?.email) {
    throw new Error("Student email address is not available");
  }

  const company = await getCompanyProfile();
  const pdf = await createInvoicePdf({
    invoiceNo: invoiceDetails.invoiceNo,
    invoiceType: invoiceDetails.invoiceType,
    issuedAt: invoiceDetails.issuedAt,
    studentName: student.name,
    studentEmail: student.email,
    courseTitle: course?.title,
    paymentMethod: invoiceDetails.paymentMethod,
    transactionRef: invoiceDetails.transactionRef,
    taxableAmount: invoiceDetails.taxableAmount,
    cgstAmount: invoiceDetails.cgstAmount,
    sgstAmount: invoiceDetails.sgstAmount,
    totalAmount: invoiceDetails.totalAmount,
    company,
  });

  const sent = await sendInvoiceReceiptEmail({
    studentName: student.name,
    studentEmail: student.email,
    invoiceNo: invoiceDetails.invoiceNo,
    invoiceType: invoiceDetails.invoiceType,
    amountPaid: invoiceDetails.amountPaid,
    taxableAmount: invoiceDetails.taxableAmount,
    cgstAmount: invoiceDetails.cgstAmount,
    sgstAmount: invoiceDetails.sgstAmount,
    paymentMethod: invoiceDetails.paymentMethod,
    transactionRef: invoiceDetails.transactionRef,
    issuedAt: invoiceDetails.issuedAt,
    courseTitle: course?.title,
    balanceAmount: feePlan?.balanceAmount,
    pdfAttachment: {
      filename: `Invoice-${invoiceDetails.invoiceNo.replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf`,
      content: pdf,
    },
  });

  return { sent, studentEmail: student.email };
};

export const getAllInvoices = async () => {
  const invoices = await db.orm.public.Invoice.all();
  const students = await db.orm.public.Student.all();
  const users = await db.orm.public.User.all();

  return invoices.map((inv) => {
    const student = students.find((s) => s.id === inv.studentId);
    const creator = users.find((u) => u.id === inv.createdById);
    return {
      ...inv,
      studentName: student?.name || "N/A",
      studentEmail: student?.email || "N/A",
      createdByName: creator?.username || "Admin",
      createdByRole: creator?.role || "ADMIN",
    };
  });
};
