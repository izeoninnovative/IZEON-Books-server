import { Request, Response } from "express";
import * as paymentService from "../services/payment.services.js";

export const payEmiInstallment = async (req: Request, res: Response) => {
  try {
    const { emiScheduleId, amountPaid, paymentMethod, transactionRef } = req.body;

    if (!emiScheduleId || !amountPaid || !paymentMethod) {
      return res.status(400).json({
        success: false,
        message: "emiScheduleId, amountPaid, and paymentMethod are required",
      });
    }

    const result = await paymentService.payEmiInstallment({
      emiScheduleId: Number(emiScheduleId),
      amountPaid: Number(amountPaid),
      paymentMethod,
      transactionRef,
    });

    return res.status(200).json({
      success: true,
      message: "EMI installment paid and receipt generated successfully",
      data: result,
    });
  } catch (err: any) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

export const getInvoiceById = async (req: Request, res: Response) => {
  try {
    const invoiceId = Number(req.params.id);
    const invoice = await paymentService.getInvoiceById(invoiceId);
    return res.status(200).json({ success: true, data: invoice });
  } catch (err: any) {
    return res.status(404).json({ success: false, message: err.message });
  }
};

export const getAllInvoices = async (_req: Request, res: Response) => {
  try {
    const invoices = await paymentService.getAllInvoices();
    return res.status(200).json({ success: true, data: invoices });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
};
