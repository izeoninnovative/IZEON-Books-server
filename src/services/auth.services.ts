/** @format */

import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { db } from "../prisma/db.js";

export interface RegisterDTO {
  username: string;
  email: string;
  password: string;
  role?: "ADMIN" | "HR" | "EMPLOYEE";
}

export interface LoginDTO {
  email: string;
  password: string;
}

// 1. Register User Service
export const registerUser = async (data: RegisterDTO) => {
  // Check if email already exists
  const existingUser = await db.orm.public.User.where({
    email: data.email,
  }).first();

  if (existingUser) {
    throw new Error("Email is already registered");
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(data.password, 10);

  // Save new user in database
  const newUser = await db.orm.public.User.create({
    username: data.username,
    email: data.email,
    password: hashedPassword,
    role: data.role || "HR",
  });

  // Omit password from returned object
  const { password, ...userWithoutPassword } = newUser;
  return userWithoutPassword;
};

// 2. Login User Service
export const loginUser = async (data: LoginDTO) => {
  // Find user by email
  const user = await db.orm.public.User.where({
    email: data.email,
  }).first();

  if (!user) {
    throw new Error("Invalid email or password");
  }

  // Verify password
  const isPasswordValid = await bcrypt.compare(data.password, user.password);
  if (!isPasswordValid) {
    throw new Error("Invalid email or password");
  }

  // Generate JWT token
  const secret = process.env.JWT_SECRET || "izeon_books_secret_jwt_key_2026";
  const token = jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
    },
    secret,
    { expiresIn: "1d" },
  );

  // Check if this user is linked to an employee profile
  const employee =
    (await db.orm.public.Employee.where({ userId: user.id }).first()) ||
    (await db.orm.public.Employee.where({ email: user.email }).first());

  // Auto-link userId if matched by email
  if (employee && !employee.userId) {
    await db.orm.public.Employee.where({ id: employee.id }).update({ userId: user.id });
  }

  const { password, ...userWithoutPassword } = user;
  return {
    user: {
      ...userWithoutPassword,
      employeeId: employee?.id || null,
      empCode: employee?.empCode || null,
      designation: employee?.role || null,
      department: employee?.department || null,
    },
    token,
  };
};
