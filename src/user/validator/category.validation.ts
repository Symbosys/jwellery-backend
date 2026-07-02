import z from "zod";

export const categoryValidator = z.object({
  name: z
    .string()
    .min(2, "Category name must be at least 2 characters")
    .max(100, "Category name must be less than 100 characters")
    .trim(),
  description: z
    .string()
    .max(500, "Description must be less than 500 characters")
    .trim()
    .optional()
    .nullable(),
  image: z
    .string()
    .url("Image must be a valid URL")
    .optional()
    .nullable(),
  slug: z
    .string()
    .min(2, "Slug must be at least 2 characters")
    .max(100, "Slug must be less than 100 characters")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug can only contain lowercase alphanumeric characters and hyphens")
    .trim()
    .optional()
    .nullable(),
});