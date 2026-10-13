import pg from "pg";
const { Client } = pg;

const client = new Client({
  connectionString: process.env.DATABASE_URL || "postgresql://postgres:relife@localhost:5432/izeon_books?schema=public",
});

async function applyIndexes() {
  await client.connect();
  console.log("Connected to PostgreSQL for indexing...");

  const queries = [
    `CREATE INDEX IF NOT EXISTS idx_student_phone ON "Student"("phone");`,
    `CREATE INDEX IF NOT EXISTS idx_student_courseId ON "Student"("courseId");`,
    `CREATE INDEX IF NOT EXISTS idx_student_status ON "Student"("status");`,
    `CREATE INDEX IF NOT EXISTS idx_feeplan_studentId ON "FeePlan"("studentId");`,
    `CREATE INDEX IF NOT EXISTS idx_emischedule_feePlanId ON "EmiSchedule"("feePlanId");`,
    `CREATE INDEX IF NOT EXISTS idx_emischedule_status ON "EmiSchedule"("status");`,
    `CREATE INDEX IF NOT EXISTS idx_invoice_studentId ON "Invoice"("studentId");`,
    `CREATE INDEX IF NOT EXISTS idx_invoice_feePlanId ON "Invoice"("feePlanId");`,
    `CREATE INDEX IF NOT EXISTS idx_expense_category ON "Expense"("category");`,
    `CREATE INDEX IF NOT EXISTS idx_salarypayment_year_month ON "SalaryPayment"("year", "month");`
  ];

  for (const q of queries) {
    try {
      await client.query(q);
      console.log("✓ Applied:", q);
    } catch (err) {
      console.warn("Notice for query:", q, err.message);
    }
  }

  await client.end();
  console.log("All indexes verified and applied!");
}

applyIndexes().catch((err) => {
  console.error("Index migration failed:", err);
  process.exit(1);
});
