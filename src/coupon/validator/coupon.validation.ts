import { z } from "zod";

export const couponValidator = z.object({
  code: z.string().min(1, "Code cannot be empty"),
  description: z.string().optional(),
  discountType: z.enum(["PERCENTAGE", "FIXED_AMOUNT"]),
  discountValue: z.coerce.number().positive("Discount value must be positive"),
  minOrderAmount: z.coerce.number().nonnegative().optional(),
  maxDiscount: z.coerce.number().nonnegative().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  usageLimit: z.coerce.number().int().nonnegative().optional(),
  isActive: z.union([z.boolean(), z.enum(["true", "false"])]).optional()
});
