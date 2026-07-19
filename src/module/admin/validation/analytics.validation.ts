import { z } from "zod";

export const getAnalyticsQuerySchema = z.object({
  range: z.enum(["7d", "30d", "12m", "all"]).optional().default("30d"),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});
