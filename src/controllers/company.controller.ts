import type { Request, Response } from "express";
import { getCompanyProfile, updateCompanyProfile } from "../services/company.services.js";

export const getCompanyProfileController = async (_req: Request, res: Response) => {
  try {
    const profile = await getCompanyProfile();
    res.status(200).json({ success: true, data: profile });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || "Failed to load company profile" });
  }
};

export const updateCompanyProfileController = async (req: Request, res: Response) => {
  try {
    const { companyName, tagline, gstin, address, city, state, pincode, phone, email, website } = req.body;

    if (!companyName) {
      return res.status(400).json({ success: false, message: "Company name is required" });
    }

    const updated = await updateCompanyProfile({
      companyName,
      tagline,
      gstin: gstin ? gstin.trim().toUpperCase() : null,
      address,
      city,
      state,
      pincode,
      phone,
      email,
      website,
    });

    res.status(200).json({
      success: true,
      message: "Company profile & GSTIN successfully updated",
      data: updated,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || "Failed to update company profile" });
  }
};
