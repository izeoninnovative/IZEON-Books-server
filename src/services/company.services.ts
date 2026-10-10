import { db } from "../prisma/db.js";

export interface UpdateCompanyProfileDTO {
  companyName: string;
  tagline?: string;
  gstin?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  phone?: string;
  email?: string;
  website?: string;
}

export const getCompanyProfile = async () => {
  const profile = await db.orm.public.CompanyProfile.first();
  if (profile) return profile;

  // Create default fallback if table is empty
  return await db.orm.public.CompanyProfile.create({
    companyName: "IZEON INNOVATIVE",
    tagline: "Academy of Computer Software Training",
    gstin: "33AAACI1234F1Z5",
    address: "Tamil Nadu, India",
    city: "Chennai",
    state: "Tamil Nadu",
    pincode: "600001",
    phone: "+91 9876543210",
    email: "accounts@izeon.com",
    website: "https://izeoninnovative.com",
  });
};

export const updateCompanyProfile = async (data: UpdateCompanyProfileDTO) => {
  const existing = await db.orm.public.CompanyProfile.first();

  if (existing) {
    return await db.orm.public.CompanyProfile.where({ id: existing.id }).update({
      companyName: data.companyName,
      tagline: data.tagline ?? existing.tagline,
      gstin: data.gstin ?? existing.gstin,
      address: data.address ?? existing.address,
      city: data.city ?? existing.city,
      state: data.state ?? existing.state,
      pincode: data.pincode ?? existing.pincode,
      phone: data.phone ?? existing.phone,
      email: data.email ?? existing.email,
      website: data.website ?? existing.website,
      updatedAt: new Date().toISOString(),
    });
  }

  return await db.orm.public.CompanyProfile.create({
    companyName: data.companyName,
    tagline: data.tagline || "Academy of Computer Software Training",
    gstin: data.gstin || null,
    address: data.address || null,
    city: data.city || null,
    state: data.state || "Tamil Nadu",
    pincode: data.pincode || null,
    phone: data.phone || null,
    email: data.email || null,
    website: data.website || null,
  });
};
