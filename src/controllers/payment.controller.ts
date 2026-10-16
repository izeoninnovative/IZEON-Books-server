import { Request, Response } from "express";
import * as paymentService from "../services/payment.services.js";
import { AuthenticatedRequest } from "../middlewares/auth.middleware.js";

export const payEmiInstallment = async (req: AuthenticatedRequest, res: Response) => {
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
      createdById: req.user?.id
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

export const emailInvoice = async (req: Request, res: Response) => {
  const invoiceId = Number(req.params.id);
  if (!Number.isInteger(invoiceId) || invoiceId <= 0) {
    return res.status(400).json({ success: false, message: "Invalid invoice ID" });
  }

  try {
    const result = await paymentService.emailInvoiceById(invoiceId);
    if (!result.sent) {
      return res.status(503).json({
        success: false,
        message: "Invoice email could not be sent. Check the server SMTP configuration.",
      });
    }
    return res.status(200).json({
      success: true,
      message: `Invoice PDF sent to ${result.studentEmail}`,
    });
  } catch (err: any) {
    console.error(`[Invoice Email] Failed for invoice ${invoiceId}:`, err);
    const status = err.message === "Invoice not found" ? 404 : 500;
    return res.status(status).json({
      success: false,
      message: err.message || "Failed to send invoice email",
    });
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
