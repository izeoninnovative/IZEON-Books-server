import nodemailer from "nodemailer";

export interface SendInvoiceEmailParams {
  studentName: string;
  studentEmail: string;
  invoiceNo: string;
  invoiceType: "GST" | "NON_GST";
  amountPaid: number;
  taxableAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  paymentMethod: string;
  transactionRef?: string | null;
  issuedAt: string;
  courseTitle?: string;
  balanceAmount?: number;
  pdfAttachment?: {
    filename: string;
    content: Buffer;
  };
}

// Create reusable transporter object using SMTP transport
const createTransporter = () => {
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = Number(process.env.SMTP_PORT) || 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // true for 465, false for other ports (587)
    auth: {
      user,
      pass,
    },
    // Optional timeout settings
    connectionTimeout: 10000,
    greetingTimeout: 10000,
  });
};

/**
 * Send an official branded payment receipt email to the student
 */
export const sendInvoiceReceiptEmail = async (params: SendInvoiceEmailParams) => {
  // If SMTP credentials are dummy or missing, log info and skip without failing the transaction
  if (!process.env.SMTP_USER || process.env.SMTP_USER.includes("your-email@gmail.com")) {
    console.warn(
      `[Email Service] SMTP credentials not configured in .env. Skipping email dispatch to ${params.studentEmail}. Set SMTP_USER & SMTP_PASS in .env to enable live delivery.`
    );
    return false;
  }

  try {
    const transporter = createTransporter();
    const isGst = params.invoiceType === "GST";
    const dateFormatted = new Date(params.issuedAt).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

    const formattedAmount = `₹${params.amountPaid.toLocaleString("en-IN")}`;
    const formattedBalance = params.balanceAmount !== undefined ? `₹${params.balanceAmount.toLocaleString("en-IN")}` : null;

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Payment Receipt - ${params.invoiceNo}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px; color: #1e293b; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
    .header { background: linear-gradient(135deg, #1656a6, #103b6f); padding: 32px 24px; text-align: center; color: #ffffff; }
    .header h1 { margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px; }
    .header p { margin: 6px 0 0; font-size: 13px; color: #bfdbfe; }
    .badge { display: inline-block; background: rgba(255, 255, 255, 0.15); border: 1px solid rgba(255,255,255,0.25); border-radius: 20px; padding: 4px 12px; font-size: 11px; font-weight: 600; text-transform: uppercase; margin-top: 10px; }
    .content { padding: 28px 24px; }
    .greeting { font-size: 16px; margin-bottom: 20px; }
    .greeting strong { color: #0f172a; }
    .receipt-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; margin-bottom: 24px; }
    .row { display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 13px; }
    .row:last-child { margin-bottom: 0; }
    .label { color: #64748b; font-weight: 500; }
    .value { font-weight: 700; color: #0f172a; text-align: right; }
    .table-container { margin: 24px 0; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { background: #f1f5f9; padding: 12px; text-align: left; font-size: 11px; text-transform: uppercase; color: #475569; font-weight: 700; }
    td { padding: 12px; border-top: 1px solid #e2e8f0; color: #1e293b; }
    .amount-highlight { font-size: 22px; font-weight: 800; color: #059669; }
    .status-paid { display: inline-block; padding: 4px 10px; background: #ecfdf5; color: #059669; border: 1px solid #a7f3d0; border-radius: 8px; font-weight: 700; font-size: 12px; }
    .balance-box { background: #fffbeb; border: 1px solid #fde68a; border-radius: 10px; padding: 12px 16px; margin-top: 20px; display: flex; justify-content: space-between; align-items: center; font-size: 13px; }
    .footer { background: #f8fafc; padding: 20px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; }
    .footer a { color: #1656a6; text-decoration: none; font-weight: 600; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>IZEON INNOVATIVE</h1>
      <p>Academy of Computer Software Training</p>
      <div class="badge">Official Fee Payment Receipt</div>
    </div>

    <div class="content">
      <div class="greeting">
        Dear <strong>${params.studentName}</strong>,<br>
        Thank you for your payment. Your receipt has been successfully generated and recorded.
      </div>

      <div class="receipt-box">
        <div class="row">
          <span class="label">Invoice Number:</span>
          <span class="value" style="font-family: monospace; color: #1656a6;">${params.invoiceNo}</span>
        </div>
        <div class="row">
          <span class="label">Date of Payment:</span>
          <span class="value">${dateFormatted}</span>
        </div>
        <div class="row">
          <span class="label">Payment Mode:</span>
          <span class="value">${params.paymentMethod}${params.transactionRef ? ` (${params.transactionRef})` : ""}</span>
        </div>
        <div class="row">
          <span class="label">Invoice Category:</span>
          <span class="value">${params.invoiceType === "GST" ? "GST Tax Invoice (18%)" : "Non-GST Receipt"}</span>
        </div>
      </div>

      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Description / Course</th>
              <th style="text-align: right;">Amount Paid</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <strong>${params.courseTitle || "Professional IT Training Program"}</strong>
                ${isGst ? `<div style="font-size: 11px; color: #64748b; margin-top: 4px;">Taxable: ₹${params.taxableAmount.toLocaleString("en-IN")} | CGST (9%): ₹${params.cgstAmount.toLocaleString("en-IN")} | SGST (9%): ₹${params.sgstAmount.toLocaleString("en-IN")}</div>` : ""}
              </td>
              <td style="text-align: right;" class="amount-highlight">
                ${formattedAmount}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      ${
        params.balanceAmount !== undefined
          ? params.balanceAmount > 0
            ? `<div class="balance-box">
                 <span style="color: #92400e; font-weight: 600;">Remaining Balance Outstanding:</span>
                 <strong style="color: #b45309; font-size: 15px;">${formattedBalance}</strong>
               </div>`
            : `<div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 12px 16px; margin-top: 20px; text-align: center; color: #166534; font-weight: 700; font-size: 13px;">
                 🎉 Course fee is fully paid. No outstanding balance remaining!
               </div>`
          : ""
      }
    </div>

    <div class="footer">
      <p style="margin: 0 0 6px;">This is an electronically generated receipt for your academy records.</p>
      <p style="margin: 0;">IZEON INNOVATIVE • Tamil Nadu, India • <a href="http://localhost:5173">Portal Login</a></p>
    </div>
  </div>
</body>
</html>
    `;

    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || `"IZEON Books" <${process.env.SMTP_USER}>`,
      to: params.studentEmail,
      subject: `Payment Receipt: ${params.invoiceNo} - IZEON Innovative`,
      html: htmlContent,
      ...(params.pdfAttachment
        ? {
            attachments: [
              {
                filename: params.pdfAttachment.filename,
                content: params.pdfAttachment.content,
                contentType: "application/pdf",
              },
            ],
          }
        : {}),
    });

    console.log(`[Email Service] Receipt sent to ${params.studentEmail} [ID: ${info.messageId}]`);
    return true;
  } catch (err: any) {
    console.error(`[Email Service] Failed to send invoice email to ${params.studentEmail}:`, err.message);
    return false;
  }
};
