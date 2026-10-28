/** @format */

import { db } from "../prisma/db.js";
import { calculateConsecutiveLatePenalties } from "./admin.services.js";

/**
 * Get profile for the authenticated employee user
 */
export const getEmployeeProfileByUserId = async (userId: number, userEmail?: string) => {
  let employee = await db.orm.public.Employee.where({ userId }).first();

  if (!employee && userEmail) {
    employee = await db.orm.public.Employee.where({ email: userEmail.trim() }).first();
    if (!employee) {
      // Case-insensitive fallback lookup
      const allEmps: any[] = await db.orm.public.Employee.all();
      employee = allEmps.find(
        (e) => e.email && e.email.trim().toLowerCase() === userEmail.trim().toLowerCase()
      );
    }
    // Auto-link userId if matched by email
    if (employee && !employee.userId) {
      await db.orm.public.Employee.where({ id: employee.id }).update({ userId });
    }
  }

  // If still not linked and user is HR or ADMIN, auto-provision employee record so punching never fails
  if (!employee) {
    const user = await db.orm.public.User.where({ id: userId }).first();
    if (user && (user.role === "HR" || user.role === "ADMIN")) {
      const { generateEmployeeCode } = await import("./admin.services.js");
      const empCode = await generateEmployeeCode();
      employee = await db.orm.public.Employee.create({
        empCode,
        name: user.username,
        email: user.email,
        phone: null,
        role: user.role === "HR" ? "HR" : "Administrator",
        department: user.role === "HR" ? "Human Resources" : "Administration",
        userId: user.id,
        baseSalary: 0,
        status: "ACTIVE",
        shiftInTime: "09:30",
        shiftOutTime: "18:30",
        gracePeriodMinutes: 15,
        joiningDate: new Date().toISOString().split("T")[0],
      });
    }
  }

  if (!employee) {
    throw new Error("Employee profile not found for this account");
  }

  return employee;
};

/**
 * Get employee attendance logs with consecutive late calculations
 */
export const getMyAttendance = async (
  employeeId: number,
  month?: number,
  year?: number
) => {
  const employee = await db.orm.public.Employee.where({ id: employeeId }).first();
  if (!employee) throw new Error("Employee not found");

  const curMonth = month || new Date().getMonth() + 1;
  const curYear = year || new Date().getFullYear();
  const monthStr = `${curYear}-${String(curMonth).padStart(2, "0")}`;

  const allAttendances: any[] = await db.orm.public.EmployeeAttendance.where({
    employeeId,
  }).all();

  const monthAttendances = allAttendances
    .filter((a: any) => a.date.startsWith(monthStr))
    .sort((a: any, b: any) => a.date.localeCompare(b.date));

  const penalties = calculateConsecutiveLatePenalties(
    monthAttendances,
    employee.baseSalary || 0
  );

  const presentDays = monthAttendances.filter(
    (a: any) =>
      a.status === "PRESENT" ||
      a.status === "LATE" ||
      a.status === "PERMISSION"
  ).length;
  const permissionDays = monthAttendances.filter(
    (a: any) => a.status === "PERMISSION"
  ).length;
  const halfDays = monthAttendances.filter((a: any) => a.status === "HALF_DAY").length;
  const absentDays = monthAttendances.filter((a: any) => a.status === "ABSENT").length;
  const totalWorkHours = monthAttendances.reduce(
    (sum: number, a: any) => sum + (Number(a.workHours) || 0),
    0
  );

  return {
    employeeId,
    month: curMonth,
    year: curYear,
    shiftInTime: employee.shiftInTime || "09:30",
    shiftOutTime: employee.shiftOutTime || "18:30",
    gracePeriodMinutes: employee.gracePeriodMinutes || 0,
    baseSalary: employee.baseSalary,
    presentDays,
    permissionDays,
    halfDays,
    absentDays,
    totalWorkHours: Math.round(totalWorkHours * 10) / 10,
    ...penalties,
    records: monthAttendances,
  };
};

/**
 * Get employee salary payment history and payslips
 */
export const getMySalaries = async (employeeId: number) => {
  const salaries: any[] = await db.orm.public.SalaryPayment.where({ employeeId }).all();
  return salaries.sort(
    (a: any, b: any) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime()
  );
};

/**
 * Get employee appraisal records
 */
export const getMyAppraisals = async (employeeId: number) => {
  const appraisals: any[] = await db.orm.public.EmployeeAppraisal.where({ employeeId }).all();
  return appraisals.sort(
    (a: any, b: any) => new Date(b.appraisalDate).getTime() - new Date(a.appraisalDate).getTime()
  );
};

export interface PunchAttendanceDTO {
  type: "IN" | "OUT" | "MANUAL";
  date?: string;
  inTime?: string;
  outTime?: string;
  status?: string;
  notes?: string;
  latitude?: number;
  longitude?: number;
}

/**
 * Clock in / Clock out / Record attendance entry by employee themselves
 */
export const punchAttendance = async (
  userId: number,
  userEmail: string | undefined,
  data: PunchAttendanceDTO
) => {
  const employee = await getEmployeeProfileByUserId(userId, userEmail);
  const now = new Date();

  // Local date formatting YYYY-MM-DD
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const todayStr = data.date?.trim() || `${year}-${month}-${day}`;

  const currentHours = String(now.getHours()).padStart(2, "0");
  const currentMins = String(now.getMinutes()).padStart(2, "0");
  const currentTime = `${currentHours}:${currentMins}`;

  const { getAttendancePolicy, calculateDistanceMeters, recordAttendance } =
    await import("./admin.services.js");
  const policy = await getAttendancePolicy();

  let punchDistanceMeters: number | undefined = undefined;

  // Strict Geofence Location Verification
  if (policy.geofenceEnabled) {
    if (
      data.latitude === undefined ||
      data.longitude === undefined ||
      data.latitude === null ||
      data.longitude === null ||
      isNaN(Number(data.latitude)) ||
      isNaN(Number(data.longitude))
    ) {
      throw new Error(
        "Location Required: You must enable GPS location permissions to clock in or out. Attendance punching is strictly restricted to office premises."
      );
    }

    const userLat = Number(data.latitude);
    const userLon = Number(data.longitude);
    const officeLat = Number(policy.officeLatitude || 13.0827);
    const officeLon = Number(policy.officeLongitude || 80.2707);
    const allowedRadius = Number(policy.geofenceRadiusMeters || 50);

    punchDistanceMeters = calculateDistanceMeters(
      userLat,
      userLon,
      officeLat,
      officeLon
    );

    if (punchDistanceMeters > allowedRadius) {
      const officeTitle = policy.officeAddress || "IZEON Office";
      throw new Error(
        `Geofence Verification Failed: You are outside the office (${punchDistanceMeters}m away). Attendance punch is only permitted within ${allowedRadius}m of ${officeTitle}.`
      );
    }
  }

  const existing = await db.orm.public.EmployeeAttendance.where({
    employeeId: employee.id,
    date: todayStr,
  }).first();

  let inTime = existing?.inTime || null;
  let outTime = existing?.outTime || null;
  let status = data.status || existing?.status || undefined;
  let notes = data.notes !== undefined ? data.notes : (existing?.notes || null);

  if (data.type === "IN") {
    // Strictly live server time to eliminate timing forgery
    inTime = existing?.inTime || currentTime;
    if (status !== "PERMISSION" && status !== "HALF_DAY") {
      status = undefined;
    }
  } else if (data.type === "OUT") {
    // Strictly live server time to eliminate timing forgery
    outTime = currentTime;
    if (!inTime) {
      inTime = employee.shiftInTime || "09:30";
    }
  } else if (data.type === "MANUAL") {
    // Staff/HR cannot arbitrarily alter their clocked in/out hours
    // If not clocked in yet and saving a note/permission, stamp current live time
    if (!inTime) {
      inTime = currentTime;
    }
  }

  const record = await recordAttendance({
    employeeId: employee.id,
    date: todayStr,
    inTime: inTime || undefined,
    outTime: outTime || undefined,
    status,
    notes: notes || undefined,
    punchLatitude: data.latitude !== undefined ? Number(data.latitude) : undefined,
    punchLongitude: data.longitude !== undefined ? Number(data.longitude) : undefined,
    punchDistanceMeters,
  });

  return {
    ...record,
    punchDistanceMeters,
  };
};

/**
 * Get today's attendance entry for logged-in employee
 */
export const getTodayAttendance = async (userId: number, userEmail?: string) => {
  const employee = await getEmployeeProfileByUserId(userId, userEmail);
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const todayStr = `${year}-${month}-${day}`;

  const { getAttendancePolicy } = await import("./admin.services.js");
  const policy = await getAttendancePolicy();

  const existing = await db.orm.public.EmployeeAttendance.where({
    employeeId: employee.id,
    date: todayStr,
  }).first();

  return {
    today: todayStr,
    record: existing || null,
    employee,
    policy: {
      geofenceEnabled: policy.geofenceEnabled !== false,
      officeLatitude: policy.officeLatitude,
      officeLongitude: policy.officeLongitude,
      geofenceRadiusMeters: policy.geofenceRadiusMeters,
      officeAddress: policy.officeAddress,
    },
  };
};
