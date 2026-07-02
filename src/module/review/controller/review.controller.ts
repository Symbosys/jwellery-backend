import type { Prisma } from "../../../../generated/prisma";
import prisma from "../../../config/prisma";
import { asyncHandler } from "../../../middleware/error.middleware";
import { ErrorResponse, SuccessResponse } from "../../../utils/response.utils";
import { CreateReviewValidator, ReplyReviewValidator } from "../validator/review.validator";

import type { AuthenticatedRequest } from "../../../middleware/auth.middleware";

export const getAllReviews = asyncHandler<AuthenticatedRequest>(async (req, res, next) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;
  const search = String(req.query.search || "");
  const rating = req.query.rating ? Number(req.query.rating) : undefined;
  const status = req.query.status as "REPLIED" | "UNREPLIED" | undefined;
  
  const skip = (page - 1) * limit;

  const where: Prisma.ReviewWhereInput = {};

  if (search) {
    where.OR = [
      { comment: { contains: search } },
      { user: { firstName: { contains: search } } },
      { user: { lastName: { contains: search } } },
      { product: { name: { contains: search } } }
    ];
  }

  if (rating) {
    where.rating = rating;
  }

  if (status) {
    where.status = status;
  }

  const reviews = await prisma.review.findMany({
    where,
    skip,
    take: limit,
    include: {
      user: {
        select: {
          firstName: true,
          lastName: true,
        }
      },
      product: {
        select: {
          name: true,
        }
      }
    },
    orderBy: {
      createdAt: "desc"
    }
  });

  const totalReviews = await prisma.review.count({ where });

  // Map to match frontend structure
  const formattedReviews = reviews.map(r => ({
    id: r.id,
    customerName: `${r.user.firstName || ""} ${r.user.lastName || ""}`.trim() || "Anonymous",
    productName: r.product.name,
    rating: r.rating,
    comment: r.comment,
    date: r.createdAt.toISOString(),
    reply: r.reply,
    status: r.status,
  }));

  return SuccessResponse(res, "Reviews fetched successfully", {
    reviews: formattedReviews,
    totalReviews,
    pagination: {
      totalPage: Math.ceil(totalReviews / limit),
      currentPage: page,
      count: reviews.length,
    }
  });
});

export const createReview = asyncHandler<AuthenticatedRequest>(async (req, res, next) => {
  const validData = CreateReviewValidator.parse(req.body);
  const userId = req.user?.id; // Assuming user is attached by protect middleware

  if (!userId) {
    return next(new ErrorResponse("Unauthorized", 401));
  }

  const existingReview = await prisma.review.findFirst({
    where: {
      userId,
      productId: validData.productId
    }
  });

  if (existingReview) {
    return next(new ErrorResponse("You have already reviewed this product", 400));
  }

  const review = await prisma.review.create({
    data: {
      rating: validData.rating,
      comment: validData.comment,
      userId,
      productId: validData.productId
    }
  });

  // Update product average rating
  const productReviews = await prisma.review.findMany({
    where: { productId: validData.productId },
    select: { rating: true }
  });
  
  const avgRating = productReviews.reduce((acc, r) => acc + r.rating, 0) / productReviews.length;

  await prisma.product.update({
    where: { id: validData.productId },
    data: {
      rating: avgRating,
      numReviews: productReviews.length
    }
  });

  return SuccessResponse(res, "Review submitted successfully", review, 201);
});

export const replyToReview = asyncHandler<AuthenticatedRequest>(async (req, res, next) => {
  const validData = ReplyReviewValidator.parse(req.body);
  const id = req.params.id;

  const review = await prisma.review.findUnique({
    where: { id }
  });

  if (!review) {
    return next(new ErrorResponse("Review not found", 404));
  }

  const updatedReview = await prisma.review.update({
    where: { id },
    data: {
      reply: validData.reply,
      status: "REPLIED"
    }
  });

  return SuccessResponse(res, "Reply posted successfully", updatedReview, 200);
});
