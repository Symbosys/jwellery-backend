import { z } from "zod";

export const bannerValidator = z.object({
  title: z.string().min(1, "Title cannot be empty"),
  description: z.string().optional(),
  imageUrl: z.string().optional(),
  linkUrl: z.string().optional(),
  position: z.string().optional(),
  isActive: z.union([z.boolean(), z.enum(["true", "false"])]).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional()
});
