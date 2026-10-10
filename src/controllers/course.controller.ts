import { Request, Response } from "express";
import * as courseService from "../services/course.services.js";

export const createCourse = async (req: Request, res: Response) => {
  try {
    const { title, code, description, durationWeeks, baseFee } = req.body;
    if (!title || !code || !baseFee) {
      return res.status(400).json({ success: false, message: "Title, code, and baseFee are required" });
    }

    const course = await courseService.createCourse({
      title,
      code,
      description,
      durationWeeks: Number(durationWeeks) || 12,
      baseFee: Number(baseFee),
    });

    return res.status(201).json({ success: true, message: "Course created successfully", data: course });
  } catch (err: any) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

export const getAllCourses = async (_req: Request, res: Response) => {
  try {
    const courses = await courseService.getAllCourses();
    return res.status(200).json({ success: true, data: courses });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
};
