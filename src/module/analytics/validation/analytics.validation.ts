import { z } from "zod";

export const getAnalyticsQuerySchema = z.object({
  range: z.enum(["7d", "30d", "12m", "all"]).optional().default("30d"),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export const trackEventSchema = z.object({
  productId: z.string().uuid("Invalid product ID"),
  eventType: z.enum(["VIEW", "ADD_TO_CART", "PURCHASE"]),
  quantity: z.number().int().positive().optional().default(1),
  amount: z.number().positive().optional(),
});
