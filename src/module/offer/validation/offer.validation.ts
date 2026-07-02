import { z } from "zod";

export const offerTypeEnum = z.enum([
  "FLAT_DISCOUNT",
  "PERCENTAGE_DISCOUNT",
  "MAKING_CHARGE_DISCOUNT",
  "FREE_GIFT",
  "CASHBACK",
  "EXCHANGE",
  "FESTIVAL",
  "BUY_ONE_GET_ONE_FREE",
  "GOLD_SAVINGS",
  "LOYALTY_REWARD"
]);

export const createOfferSchema = z.object({
  name: z.string().min(1, "Name is required").max(200, "Name is too long").trim(),
  description: z.string().max(2000, "Description is too long").trim().optional(),
  offerType: offerTypeEnum,
  discountValue: z.number().min(0, "Discount value must be non-negative").optional(),
  minPurchase: z.number().min(0, "Min purchase must be non-negative").optional(),
  giftDescription: z.string().max(500, "Gift description is too long").trim().optional(),
  cashbackDetails: z.string().max(500, "Cashback details is too long").trim().optional(),
  exchangeDetails: z.string().max(500, "Exchange details is too long").trim().optional(),
  startDate: z.string().datetime().optional().nullable(),
  endDate: z.string().datetime().optional().nullable(),
  isActive: z.boolean().default(true).optional(),
  productIds: z.array(z.string().uuid("Invalid Product ID")).optional() // Array of product UUIDs to connect
});

export const updateOfferSchema = createOfferSchema.partial();
