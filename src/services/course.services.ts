import { db } from "../prisma/db.js";

export interface CreateCourseDTO {
  title: string;
  code: string;
  description?: string;
  durationWeeks?: number;
  baseFee: number;
}

export const createCourse = async (data: CreateCourseDTO) => {
  const existing = await db.orm.public.Course.where({ code: data.code }).first();
  if (existing) {
    throw new Error(`Course with code ${data.code} already exists`);
  }

  return await db.orm.public.Course.create({
    title: data.title,
    code: data.code.toUpperCase(),
    description: data.description || null,
    durationWeeks: data.durationWeeks || 12,
    baseFee: Number(data.baseFee),
  });
};

export const getAllCourses = async () => {
  const courses = await db.orm.public.Course.all();
  return courses.sort((a, b) => a.title.localeCompare(b.title));
};

export const getCourseById = async (id: number) => {
  const course = await db.orm.public.Course.where({ id }).first();
  if (!course) {
    throw new Error("Course not found");
  }
  return course;
};
