import { Request, Response } from "express";
import * as studentService from "../services/student.services.js";

export const registerStudent = async (req: Request, res: Response) => {
  try {
    const {
      name,
      email,
      phone,
      dob,
      address,
      courseId,
      planType,
      invoiceType,
      baseAmount,
      discountAmount,
      downPayment,
      emiMonths,
      emiDueDayOfMonth,
      paymentMethod,
      transactionRef,
    } = req.body;

    if (!name || !email || !phone || !dob || !courseId || !planType || !invoiceType) {
      return res.status(400).json({
        success: false,
        message: "Name, email, phone, dob, courseId, planType (LUMPSUM/EMI), and invoiceType (GST/NON_GST) are required",
      });
    }

    const result = await studentService.registerStudentWithFees({
      name,
      email,
      phone,
      dob,
      address,
      courseId: Number(courseId),
      planType,
      invoiceType,
      baseAmount: baseAmount ? Number(baseAmount) : undefined,
      discountAmount: discountAmount ? Number(discountAmount) : 0,
      downPayment: downPayment ? Number(downPayment) : 0,
      emiMonths: emiMonths ? Number(emiMonths) : 3,
      emiDueDayOfMonth: emiDueDayOfMonth ? Number(emiDueDayOfMonth) : 5,
      paymentMethod,
      transactionRef,
    });

    return res.status(201).json({
      success: true,
      message: "Student enrolled and fee plan created successfully",
      data: result,
    });
  } catch (err: any) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

export const getAllStudents = async (_req: Request, res: Response) => {
  try {
    const students = await studentService.getAllStudents();
    return res.status(200).json({ success: true, data: students });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const getStudentDetails = async (req: Request, res: Response) => {
  try {
    const studentId = Number(req.params.id);
    const details = await studentService.getStudentDetails(studentId);
    return res.status(200).json({ success: true, data: details });
  } catch (err: any) {
    return res.status(404).json({ success: false, message: err.message });
  }
};
