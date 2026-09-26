import { z } from "zod";
import { OrderStatus, PaymentStatus, PaymentMethod } from "../../../../generated/prisma/index.js";

export const createOrderSchema = z.object({
  shippingName: z.string({ message: "Shipping name is required" }).min(2, "Name must be at least 2 characters").trim(),
  shippingPhone: z.string({ message: "Shipping phone is required" }).min(10, "Phone number must be at least 10 digits").trim(),
  shippingAddress: z.string({ message: "Shipping address is required" }).min(5, "Address must be at least 5 characters").trim(),
  shippingCity: z.string({ message: "Shipping city is required" }).min(2, "City must be at least 2 characters").trim(),
  shippingState: z.string({ message: "Shipping state is required" }).min(2, "State must be at least 2 characters").trim(),
  shippingPincode: z.string({ message: "Shipping pincode is required" }).min(5, "Pincode must be at least 5 characters").trim(),
  paymentMethod: z.nativeEnum(PaymentMethod).optional().default("COD"),
  note: z.string().max(500, "Note cannot exceed 500 characters").optional(),
  addressId: z.string().optional(),
});

export const updateOrderStatusSchema = z.object({
  status: z.nativeEnum(OrderStatus, {
    message: "Invalid order status"
  }),
});

export const updatePaymentStatusSchema = z.object({
  paymentStatus: z.nativeEnum(PaymentStatus, {
    message: "Invalid payment status"
  }),
});

export const verifyPaymentSchema = z.object({
  orderId: z.string({ message: "Order ID is required" }).trim(),
  razorpayOrderId: z.string().trim().optional(),
  razorpayPaymentId: z.string().trim().optional(),
  razorpaySignature: z.string().trim().optional(),
});

export const updateOrderAddressSchema = z.object({
  shippingName: z.string({ message: "Shipping name is required" }).min(2, "Name must be at least 2 characters").trim(),
  shippingPhone: z.string({ message: "Shipping phone is required" }).min(10, "Phone number must be at least 10 digits").trim(),
  shippingAddress: z.string({ message: "Shipping address is required" }).min(5, "Address must be at least 5 characters").trim(),
  shippingAddress2: z.string().optional(),
  shippingCity: z.string({ message: "Shipping city is required" }).min(2, "City must be at least 2 characters").trim(),
  shippingState: z.string({ message: "Shipping state is required" }).min(2, "State must be at least 2 characters").trim(),
  shippingCountry: z.string().optional().default("India"),
  shippingPincode: z.string({ message: "Shipping pincode is required" }).min(5, "Pincode must be at least 5 characters").trim(),
});

export const processRefundSchema = z.object({
  amount: z.union([z.number(), z.string()]).transform((val) => Number(val)),
  reason: z.string({ message: "Reason is required" }).min(2, "Reason must be at least 2 characters").trim(),
  refundMethod: z.enum(["ORIGINAL_PAYMENT_METHOD", "BANK_TRANSFER", "UPI", "WALLET", "STORE_CREDIT"]).optional().default("ORIGINAL_PAYMENT_METHOD"),
  adminNote: z.string().optional(),
  accountHolderName: z.string().optional(),
  bankName: z.string().optional(),
  accountNumber: z.string().optional(),
  ifscCode: z.string().optional(),
  upiId: z.string().optional(),
  transactionId: z.string().optional(),
});




