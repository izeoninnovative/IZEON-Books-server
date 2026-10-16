import PDFDocument from "pdfkit";

interface InvoicePdfParams {
  invoiceNo: string;
  invoiceType: "GST" | "NON_GST";
  issuedAt: string;
  studentName: string;
  studentEmail: string;
  courseTitle?: string | null;
  paymentMethod: string;
  transactionRef?: string | null;
  taxableAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  totalAmount: number;
  company: {
    companyName: string;
    tagline?: string | null;
    gstin?: string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    pincode?: string | null;
    phone?: string | null;
    email?: string | null;
    website?: string | null;
  };
}

const formatAmount = (amount: number) =>
  `INR ${Number(amount).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export const createInvoicePdf = (params: InvoicePdfParams): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 48 });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const isGst = params.invoiceType === "GST";
    const companyAddress = [
      params.company.address,
      params.company.city,
      params.company.state,
      params.company.pincode,
    ]
      .filter(Boolean)
      .join(", ");
    const issuedDate = new Date(params.issuedAt).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

    doc
      .fillColor("#1656a6")
      .font("Helvetica-Bold")
      .fontSize(20)
      .text(params.company.companyName, { align: "left" });
    if (params.company.tagline) {
      doc.fillColor("#64748b").font("Helvetica").fontSize(10).text(params.company.tagline);
    }
    if (companyAddress) {
      doc.fillColor("#64748b").fontSize(9).text(companyAddress);
    }
    if (isGst && params.company.gstin) {
      doc.fillColor("#1656a6").font("Helvetica-Bold").text(`GSTIN: ${params.company.gstin}`);
    }
    const contact = [params.company.phone, params.company.email, params.company.website]
      .filter(Boolean)
      .join(" | ");
    if (contact) {
      doc.fillColor("#64748b").font("Helvetica").text(contact);
    }

    doc.moveDown(1.5);
    doc.moveTo(48, doc.y).lineTo(547, doc.y).strokeColor("#cbd5e1").stroke();
    doc.moveDown(1);

    doc
      .fillColor("#0f172a")
      .font("Helvetica-Bold")
      .fontSize(16)
      .text(isGst ? "TAX INVOICE" : "PAYMENT RECEIPT");
    doc.moveDown(0.5);
    doc.font("Helvetica").fontSize(10);
    doc.text(`Invoice Number: ${params.invoiceNo}`);
    doc.text(`Date: ${issuedDate}`);

    doc.moveDown(1);
    doc.fillColor("#475569").font("Helvetica-Bold").text("BILLED TO");
    doc.fillColor("#0f172a").font("Helvetica-Bold").text(params.studentName);
    doc.fillColor("#64748b").font("Helvetica").text(params.studentEmail);
    doc.moveDown(1.5);

    const description = params.courseTitle || "Course Fee Payment";
    const left = 48;
    const right = 547;
    const tableTop = doc.y;
    doc.rect(left, tableTop, right - left, 26).fill("#f1f5f9");
    doc.fillColor("#475569").font("Helvetica-Bold").fontSize(9);
    doc.text("DESCRIPTION", left + 10, tableTop + 8, {
      width: isGst ? 150 : 245,
    });
    doc.text("TAXABLE", isGst ? left + 176 : left + 270, tableTop + 8, {
      width: isGst ? 75 : 90,
      align: "right",
    });
    if (isGst) {
      doc.text("CGST", left + 257, tableTop + 8, { width: 65, align: "right" });
      doc.text("SGST", left + 328, tableTop + 8, { width: 65, align: "right" });
    }
    doc.text("TOTAL", right - 100, tableTop + 8, { width: 90, align: "right" });

    const rowTop = tableTop + 26;
    doc.rect(left, rowTop, right - left, 46).strokeColor("#e2e8f0").stroke();
    doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(9);
    doc.text(description, left + 10, rowTop + 9, {
      width: isGst ? 150 : 245,
    });
    doc.font("Helvetica").fontSize(9);
    doc.text(formatAmount(params.taxableAmount), isGst ? left + 176 : left + 270, rowTop + 9, {
      width: isGst ? 75 : 90,
      align: "right",
    });
    if (isGst) {
      doc.text(formatAmount(params.cgstAmount), left + 257, rowTop + 9, {
        width: 65,
        align: "right",
      });
      doc.text(formatAmount(params.sgstAmount), left + 328, rowTop + 9, {
        width: 65,
        align: "right",
      });
    }
    doc
      .font("Helvetica-Bold")
      .text(formatAmount(params.totalAmount), right - 100, rowTop + 9, {
        width: 90,
        align: "right",
      });

    doc.y = rowTop + 62;
    doc.fillColor("#64748b").font("Helvetica").fontSize(10);
    doc.text(
      `Payment Method: ${params.paymentMethod}${params.transactionRef ? ` (Ref: ${params.transactionRef})` : ""}`,
    );
    doc.moveDown(1.5);
    doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(12);
    doc.text(`Amount Paid: ${formatAmount(params.totalAmount)}`, { align: "right" });

    doc.moveDown(3);
    doc.moveTo(left, doc.y).lineTo(right, doc.y).strokeColor("#e2e8f0").stroke();
    doc.moveDown(0.75);
    doc.fillColor("#64748b").font("Helvetica").fontSize(9);
    doc.text("Thank you for learning with us. This is an electronically generated receipt.");

    doc.end();
  });
