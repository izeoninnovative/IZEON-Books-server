import { Router } from "express";
import { payEmiInstallment, getAllInvoices, getInvoiceById, emailInvoice } from "../controllers/payment.controller.js";
import { verifyToken, requireRole } from "../middlewares/auth.middleware.js";

const router = Router();

// Both ADMIN and HR can accept payments and view invoices
router.post("/pay-emi", verifyToken, requireRole(["ADMIN", "HR"]), payEmiInstallment);
router.post("/emi", verifyToken, requireRole(["ADMIN", "HR"]), payEmiInstallment);
router.get("/invoices", verifyToken, requireRole(["ADMIN", "HR"]), getAllInvoices);
router.post("/invoices/:id/email", verifyToken, requireRole(["ADMIN", "HR"]), emailInvoice);
router.get("/invoices/:id", verifyToken, requireRole(["ADMIN", "HR"]), getInvoiceById);

export default router;
