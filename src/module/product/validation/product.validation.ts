import { z } from "zod";

export const variantSchema = z.object({
  sku: z.string().optional(),
  price: z
    .number()
    .min(0, "Price must be non-negative")
    .max(9999999999999, "Price is too large"),
  discountPrice: z
    .number()
    .min(0)
    .max(9999999999999, "Discount price is too large")
    .optional(),
  quantity: z.number().int().min(0).default(0),
  image: z.string().optional().or(z.literal("")),
  attributeValues: z
    .array(z.string().uuid("Attribute Value ID must be a valid UUID"))
    .default([]),
});

export const createProductSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(200, "Name is too long")
    .trim(),
  description: z
    .string()
    .max(2000, "Description is too long")
    .trim()
    .optional(),
  image: z.string().min(1, "Main image is required"),
  images: z.array(z.string()).max(10, "Maximum 10 images allowed").optional(),
  brandId: z
    .string()
    .uuid("Brand ID must be a valid UUID")
    .optional()
    .nullable(),
  price: z
    .number()
    .min(0, "Price must be non-negative")
    .max(9999999999999, "Price is too large"),
  discountPrice: z
    .number()
    .min(0)
    .max(9999999999999, "Discount price is too large")
    .optional(),
  quantity: z.number().int().min(0).default(0),
  sku: z.string().optional(),
  cost: z.number().min(0).max(9999999999999, "Cost is too large").optional(),
  lowStockThreshold: z.number().int().min(0).default(10),
  weight: z
    .number()
    .min(0)
    .max(9999999999999, "Weight is too large")
    .optional(),
  weightUnit: z.string().default("kg"),
  status: z.string().default("active"),
  taxable: z.boolean().default(true),
  shippingRequired: z.boolean().default(true),
  seoTitle: z.string().max(200).optional(),
  seoDescription: z.string().max(2000).optional(),
  seoKeywords: z.string().max(500).optional(),
  sizes: z
    .array(z.string().max(50).trim())
    .max(20, "Too many sizes")
    .optional(),
  colors: z
    .array(z.string().max(50).trim())
    .max(20, "Too many colors")
    .optional(),
  countryOfOrigin: z.string().optional().default("India"),
  idealFor: z.string().optional(),
  material: z.string().optional(),
  packOf: z.number().int().min(1).optional().default(1),
  productType: z.string().optional(),
  categoryId: z.string().uuid("Category ID must be a valid UUID"),
  subCategoryId: z
    .string()
    .uuid("SubCategory ID must be a valid UUID")
    .optional()
    .nullable(),
  variants: z.array(variantSchema).optional(),
});

export const updateProductSchema = createProductSchema.partial();
