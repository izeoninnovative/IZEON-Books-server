/** @format */

import { Response } from "express";
import { AuthenticatedRequest } from "../middlewares/auth.middleware.js";
import * as employeeService from "../services/employee.services.js";

/**
 * Get profile of logged-in employee
 */
export const getMyProfile = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    const profile = await employeeService.getEmployeeProfileByUserId(
      req.user.id,
      req.user.email
    );
    return res.status(200).json({ success: true, data: profile });
  } catch (err: any) {
    return res.status(404).json({ success: false, message: err.message });
  }
};

/**
 * Get attendance records and monthly summary for logged-in employee
 */
export const getMyAttendance = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    const profile = await employeeService.getEmployeeProfileByUserId(
      req.user.id,
      req.user.email
    );
    const month = req.query.month ? Number(req.query.month) : undefined;
    const year = req.query.year ? Number(req.query.year) : undefined;

    const data = await employeeService.getMyAttendance(profile.id, month, year);
    return res.status(200).json({ success: true, data });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Get salary payments and payslips for logged-in employee
 */
export const getMySalaries = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    const profile = await employeeService.getEmployeeProfileByUserId(
      req.user.id,
      req.user.email
    );
    const data = await employeeService.getMySalaries(profile.id);
    return res.status(200).json({ success: true, data });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Get appraisals for logged-in employee
 */
export const getMyAppraisals = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    const profile = await employeeService.getEmployeeProfileByUserId(
      req.user.id,
      req.user.email
    );
    const data = await employeeService.getMyAppraisals(profile.id);
    return res.status(200).json({ success: true, data });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Record / Clock in or out for logged-in employee
 */
export const punchAttendance = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    const record = await employeeService.punchAttendance(
      req.user.id,
      req.user.email,
      req.body
    );
    return res.status(200).json({
      success: true,
      message: "Attendance entry recorded successfully",
      data: record,
    });
  } catch (err: any) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

/**
 * Get today's attendance status for logged-in employee
 */
export const getTodayAttendance = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    const data = await employeeService.getTodayAttendance(
      req.user.id,
      req.user.email
    );
    return res.status(200).json({ success: true, data });
  } catch (err: any) {
    return res.status(400).json({ success: false, message: err.message });
  }
};
