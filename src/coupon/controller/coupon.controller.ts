import prisma from "../../config/prisma";
import { asyncHandler } from "../../middleware/error.middleware";
import { couponValidator } from "../validator/coupon.validation";
import { SuccessResponse, ErrorResponse } from "../../utils/response.utils";

export const createCoupon = asyncHandler(async (req, res, next) => {
  const data = couponValidator.parse(req.body);

  const existingCoupon = await prisma.coupon.findUnique({
    where: { code: data.code }
  });

  if (existingCoupon) {
    throw new ErrorResponse("Coupon with this code already exists", 400);
  }

  const coupon = await prisma.coupon.create({
    data: {
      code: data.code,
      description: data.description || null,
      discountType: data.discountType,
      discountValue: data.discountValue,
      minOrderAmount: data.minOrderAmount || null,
      maxDiscount: data.maxDiscount || null,
      startDate: data.startDate ? new Date(data.startDate) : null,
      endDate: data.endDate ? new Date(data.endDate) : null,
      usageLimit: data.usageLimit || null,
      isActive: data.isActive !== undefined ? (data.isActive === "true" || data.isActive === true) : true,
    }
  });

  return SuccessResponse(res, "Coupon created successfully", coupon, 201);
});

export const getAllCoupons = asyncHandler(async (req, res, next) => {
  const coupons = await prisma.coupon.findMany({
    orderBy: { createdAt: "desc" }
  });
  return SuccessResponse(res, "Coupons fetched successfully", coupons, 200);
});

export const getCouponById = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const coupon = await prisma.coupon.findUnique({ where: { id } });

  if (!coupon) {
    throw new ErrorResponse("Coupon not found", 404);
  }

  return SuccessResponse(res, "Coupon fetched successfully", coupon, 200);
});

export const updateCoupon = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const data = couponValidator.partial().parse(req.body);

  const existingCoupon = await prisma.coupon.findUnique({ where: { id } });
  if (!existingCoupon) {
    throw new ErrorResponse("Coupon not found", 404);
  }

  // Ensure code uniqueness if updating code
  if (data.code && data.code !== existingCoupon.code) {
    const codeExists = await prisma.coupon.findUnique({ where: { code: data.code } });
    if (codeExists) {
      throw new ErrorResponse("Coupon with this code already exists", 400);
    }
  }

  const coupon = await prisma.coupon.update({
    where: { id },
    data: {
      code: data.code !== undefined ? data.code : existingCoupon.code,
      description: data.description !== undefined ? data.description : existingCoupon.description,
      discountType: data.discountType !== undefined ? data.discountType : existingCoupon.discountType,
      discountValue: data.discountValue !== undefined ? data.discountValue : existingCoupon.discountValue,
      minOrderAmount: data.minOrderAmount !== undefined ? data.minOrderAmount : existingCoupon.minOrderAmount,
      maxDiscount: data.maxDiscount !== undefined ? data.maxDiscount : existingCoupon.maxDiscount,
      startDate: data.startDate !== undefined ? (data.startDate ? new Date(data.startDate) : null) : existingCoupon.startDate,
      endDate: data.endDate !== undefined ? (data.endDate ? new Date(data.endDate) : null) : existingCoupon.endDate,
      usageLimit: data.usageLimit !== undefined ? data.usageLimit : existingCoupon.usageLimit,
      isActive: data.isActive !== undefined ? (data.isActive === "true" || data.isActive === true) : existingCoupon.isActive,
    }
  });

  return SuccessResponse(res, "Coupon updated successfully", coupon, 200);
});

export const deleteCoupon = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  const existingCoupon = await prisma.coupon.findUnique({ where: { id } });
  if (!existingCoupon) {
    throw new ErrorResponse("Coupon not found", 404);
  }

  await prisma.coupon.delete({ where: { id } });
  return SuccessResponse(res, "Coupon deleted successfully", null, 200);
});
