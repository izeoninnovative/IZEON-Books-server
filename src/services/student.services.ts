import { db } from "../prisma/db.js";
import { sendInvoiceReceiptEmail } from "./email.services.js";

export interface RegisterStudentDTO {
  name: string;
  email: string;
  phone: string;
  dob: string;
  address?: string;
  courseId: number;
  planType: "LUMPSUM" | "EMI";
  invoiceType: "GST" | "NON_GST";
  baseAmount?: number;
  discountAmount?: number;
  downPayment?: number;
  emiMonths?: number;
  emiDueDayOfMonth?: number; // e.g. 5 for 5th of each month
  paymentMethod?: "CASH" | "UPI" | "CARD" | "NETBANKING" | "CHEQUE";
  transactionRef?: string;
  createdById?: number;
}

// Generate unique invoice number: INV-2026-0001
export const generateInvoiceNo = async (type: "GST" | "NON_GST"): Promise<string> => {
  const prefix = type === "GST" ? "GST" : "INV";
  const year = new Date().getFullYear();
  const allInvoices = await db.orm.public.Invoice.all();
  const nextSeq = allInvoices.length + 1;
  const padded = String(nextSeq).padStart(4, "0");
  return `${prefix}-${year}-${padded}`;
};

export const registerStudentWithFees = async (data: RegisterStudentDTO) => {
  // 1. Verify email unique
  const existingStudent = await db.orm.public.Student.where({ email: data.email }).first();
  if (existingStudent) {
    throw new Error(`Student with email ${data.email} already exists`);
  }

  // 2. Fetch course to get baseFee if not provided
  const course = await db.orm.public.Course.where({ id: data.courseId }).first();
  if (!course) {
    throw new Error("Selected course does not exist");
  }

  const baseAmount = Number(data.baseAmount ?? course.baseFee);
  const discountAmount = Number(data.discountAmount ?? 0);
  const taxableAmount = Math.max(0, baseAmount - discountAmount);

  const isGst = data.invoiceType === "GST";
  const gstRate = isGst ? 18 : 0;
  const gstAmount = isGst ? Math.round((taxableAmount * 0.18) * 100) / 100 : 0;
  const totalAmount = taxableAmount + gstAmount;

  // 3. Create Student
  const student = await db.orm.public.Student.create({
    name: data.name,
    email: data.email,
    phone: data.phone,
    dob: data.dob,
    address: data.address || null,
    courseId: data.courseId,
    status: "ACTIVE",
  });

  // 4. Calculate Payments (Lumpsum vs EMI)
  const isEmi = data.planType === "EMI";
  const emiMonths = isEmi ? (data.emiMonths || 3) : 1;
  const downPayment = isEmi ? Number(data.downPayment || 0) : totalAmount;
  const paidAmount = downPayment;
  const balanceAmount = Math.max(0, totalAmount - paidAmount);

  // 5. Create FeePlan
  const feePlan = await db.orm.public.FeePlan.create({
    studentId: student.id,
    planType: data.planType,
    invoiceType: data.invoiceType,
    baseAmount,
    discountAmount,
    taxableAmount,
    gstRate,
    gstAmount,
    totalAmount,
    paidAmount,
    balanceAmount,
    totalInstallments: emiMonths,
  });

  // 6. If EMI, generate monthly installment schedules
  const emiSchedules: any[] = [];
  if (isEmi && balanceAmount > 0) {
    const monthlyInstallment = Math.round((balanceAmount / emiMonths) * 100) / 100;
    const dueDay = data.emiDueDayOfMonth || 5;
    const now = new Date();

    for (let i = 1; i <= emiMonths; i++) {
      const dueDate = new Date(now.getFullYear(), now.getMonth() + i, dueDay);
      const schedule = await db.orm.public.EmiSchedule.create({
        feePlanId: feePlan.id,
        installmentNo: i,
        amount: monthlyInstallment,
        dueDate: dueDate.toISOString(),
        paidDate: null,
        status: "PENDING",
      });
      emiSchedules.push(schedule);
    }
  }

  // 7. Generate Initial Invoice / Payment Receipt
  let initialInvoice = null;
  if (paidAmount > 0) {
    const invoiceNo = await generateInvoiceNo(data.invoiceType);
    const invoiceTaxable = isGst ? Math.round((paidAmount / 1.18) * 100) / 100 : paidAmount;
    const invoiceGst = isGst ? paidAmount - invoiceTaxable : 0;
    const halfGst = isGst ? Math.round((invoiceGst / 2) * 100) / 100 : 0;

    initialInvoice = await db.orm.public.Invoice.create({
      invoiceNo,
      studentId: student.id,
      feePlanId: feePlan.id,
      emiScheduleId: null,
      createdById: data.createdById || null,
      invoiceType: data.invoiceType,
      paymentMethod: data.paymentMethod || "UPI",
      transactionRef: data.transactionRef || null,
      amountPaid: paidAmount,
      taxableAmount: invoiceTaxable,
      cgstAmount: halfGst,
      sgstAmount: halfGst,
      totalAmount: paidAmount,
    });

    // Automatically send receipt to student via email (runs asynchronously)
    sendInvoiceReceiptEmail({
      studentName: student.name,
      studentEmail: student.email,
      invoiceNo: initialInvoice.invoiceNo,
      invoiceType: data.invoiceType,
      amountPaid: paidAmount,
      taxableAmount: invoiceTaxable,
      cgstAmount: halfGst,
      sgstAmount: halfGst,
      paymentMethod: data.paymentMethod || "UPI",
      transactionRef: data.transactionRef || null,
      issuedAt: initialInvoice.issuedAt,
      courseTitle: course.title,
      balanceAmount: balanceAmount,
    }).catch((err: any) => console.error("[Email Error]", err));
  }

  return {
    student,
    feePlan,
    emiSchedules,
    initialInvoice,
  };
};

export const getAllStudents = async () => {
  const students = await db.orm.public.Student.all();
  const feePlans = await db.orm.public.FeePlan.all();
  const courses = await db.orm.public.Course.all();

  return students.map((s) => {
    const course = courses.find((c) => c.id === s.courseId);
    const plan = feePlans.find((p) => p.studentId === s.id);
    return {
      ...s,
      courseTitle: course?.title || "N/A",
      feePlan: plan || null,
    };
  });
};

export const getStudentDetails = async (studentId: number) => {
  const student = await db.orm.public.Student.where({ id: studentId }).first();
  if (!student) {
    throw new Error("Student not found");
  }

  const course = await db.orm.public.Course.where({ id: student.courseId }).first();
  const feePlan = await db.orm.public.FeePlan.where({ studentId }).first();

  let emiSchedules: any[] = [];
  if (feePlan) {
    emiSchedules = await db.orm.public.EmiSchedule.where({ feePlanId: feePlan.id }).all();

    // If fee plan is fully cleared (balance <= 0 or paid >= total), auto-heal database consistency
    if (feePlan.balanceAmount <= 0 || feePlan.paidAmount >= feePlan.totalAmount) {
      const sanitizedPaid = Math.min(feePlan.paidAmount, feePlan.totalAmount);
      if (feePlan.balanceAmount !== 0 || feePlan.paidAmount !== sanitizedPaid) {
        await db.orm.public.FeePlan.where({ id: feePlan.id }).update({
          paidAmount: sanitizedPaid,
          balanceAmount: 0,
        });
        feePlan.paidAmount = sanitizedPaid;
        feePlan.balanceAmount = 0;
      }

      // Mark all lingering pending EMIs as PAID
      const nowIso = new Date().toISOString();
      for (const emi of emiSchedules) {
        if (emi.status !== "PAID") {
          await db.orm.public.EmiSchedule.where({ id: emi.id }).update({
            status: "PAID",
            paidDate: emi.paidDate || nowIso,
          });
          emi.status = "PAID";
          emi.paidDate = emi.paidDate || nowIso;
        }
      }
    }
  }

  const invoices = await db.orm.public.Invoice.where({ studentId }).all();

  return {
    student,
    course,
    feePlan,
    emiSchedules,
    invoices,
  };
};

export interface UpdateStudentDTO {
  name?: string;
  email?: string;
  phone?: string;
  dob?: string;
  address?: string | null;
  courseId?: number;
  status?: "ACTIVE" | "COMPLETED" | "DROPPED";
}

export const updateStudent = async (studentId: number, data: UpdateStudentDTO) => {
  const existingStudent = await db.orm.public.Student.where({ id: studentId }).first();
  if (!existingStudent) {
    throw new Error("Student not found");
  }

  // If email is changed, verify uniqueness
  if (data.email && data.email !== existingStudent.email) {
    const emailConflict = await db.orm.public.Student.where({ email: data.email }).first();
    if (emailConflict && emailConflict.id !== studentId) {
      throw new Error(`Student with email ${data.email} already exists`);
    }
  }

  // If courseId is changed, verify course exists
  if (data.courseId && data.courseId !== existingStudent.courseId) {
    const course = await db.orm.public.Course.where({ id: data.courseId }).first();
    if (!course) {
      throw new Error("Selected course does not exist");
    }
  }

  const updateFields: any = {};
  if (data.name !== undefined) updateFields.name = data.name.trim();
  if (data.email !== undefined) updateFields.email = data.email.trim();
  if (data.phone !== undefined) updateFields.phone = data.phone.trim();
  if (data.dob !== undefined) updateFields.dob = data.dob;
  if (data.address !== undefined) updateFields.address = data.address ? data.address.trim() : null;
  if (data.courseId !== undefined) updateFields.courseId = Number(data.courseId);
  if (data.status !== undefined) updateFields.status = data.status;

  await db.orm.public.Student.where({ id: studentId }).update(updateFields);

  const updatedStudent = await db.orm.public.Student.where({ id: studentId }).first();
  if (!updatedStudent) {
    throw new Error("Student update failed");
  }
  const updatedCourse = await db.orm.public.Course.where({ id: updatedStudent.courseId }).first();

  return {
    ...updatedStudent,
    courseTitle: updatedCourse?.title || "N/A",
  };
};


