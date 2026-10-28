import pg from "pg";
import dotenv from "dotenv";
dotenv.config();

const { Client } = pg;

const client = new Client({
  connectionString:
    process.env.DATABASE_URL ||
    "postgresql://postgres:relife@localhost:5432/izeon_books?schema=public",
});

async function runMigration() {
  await client.connect();
  console.log("Connected to PostgreSQL for Attendance Geofencing migration...");

  try {
    // 1. Add geofencing columns to AttendancePolicy
    await client.query(`
      ALTER TABLE "AttendancePolicy" ADD COLUMN IF NOT EXISTS "geofenceEnabled" BOOLEAN DEFAULT TRUE;
      ALTER TABLE "AttendancePolicy" ADD COLUMN IF NOT EXISTS "officeLatitude" DOUBLE PRECISION DEFAULT 13.0827;
      ALTER TABLE "AttendancePolicy" ADD COLUMN IF NOT EXISTS "officeLongitude" DOUBLE PRECISION DEFAULT 80.2707;
      ALTER TABLE "AttendancePolicy" ADD COLUMN IF NOT EXISTS "geofenceRadiusMeters" DOUBLE PRECISION DEFAULT 150;
      ALTER TABLE "AttendancePolicy" ADD COLUMN IF NOT EXISTS "officeAddress" VARCHAR(255) DEFAULT 'IZEON INNOVATIVE, Tamil Nadu';
    `);

    // Backfill defaults
    await client.query(`
      UPDATE "AttendancePolicy"
      SET "geofenceEnabled" = COALESCE("geofenceEnabled", TRUE),
          "officeLatitude" = COALESCE("officeLatitude", 13.0827),
          "officeLongitude" = COALESCE("officeLongitude", 80.2707),
          "geofenceRadiusMeters" = COALESCE("geofenceRadiusMeters", 150),
          "officeAddress" = COALESCE("officeAddress", 'IZEON INNOVATIVE, Tamil Nadu');
    `);

    console.log("✓ AttendancePolicy updated with geofencing configuration");

    // 2. Add punch location columns to EmployeeAttendance
    await client.query(`
      ALTER TABLE "EmployeeAttendance" ADD COLUMN IF NOT EXISTS "punchLatitude" DOUBLE PRECISION;
      ALTER TABLE "EmployeeAttendance" ADD COLUMN IF NOT EXISTS "punchLongitude" DOUBLE PRECISION;
      ALTER TABLE "EmployeeAttendance" ADD COLUMN IF NOT EXISTS "punchDistanceMeters" DOUBLE PRECISION;
    `);

    console.log("✓ EmployeeAttendance updated with punchLatitude, punchLongitude, and punchDistanceMeters");
  } catch (err) {
    console.error("Migration error:", err);
  } finally {
    await client.end();
  }
}

runMigration();
