import z from "zod";

export const subCategoryValidation = z.object({
  name: z
    .string()
    .min(2, "SubCategory name must be at least 2 characters")
    .max(100, "SubCategory name must be less than 100 characters")
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
  categoryId: z
    .string()
    .min(1, "CategoryId cannot be empty"),
});