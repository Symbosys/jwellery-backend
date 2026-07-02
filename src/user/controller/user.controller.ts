import { parse } from "zod";
import type { Prisma } from "../../../generated/prisma";
import prisma from "../../config/prisma";
import { asyncHandler } from "../../middleware/error.middleware";
import { ErrorResponse, SuccessResponse } from "../../utils/response.utils";
import { updateUsers } from "../validator/user.validation";

export const getAlluser = asyncHandler(async (req, res, next) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;
  const search = String(req.query.search || "");
  const skip = (page - 1) * limit;

  const where: Prisma.UserWhereInput = {};

  if (search) {
    where.OR = [
      { firstName: { contains: search } },
      { lastName: { contains: search } },
      { phoneNumber: { contains: search } },
    ];
  }

  const users = await prisma.user.findMany({
    where,
    skip: skip, // Inserted
    take: limit, // Inserted
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phoneNumber: true,
      dateOfBirth: true,
      gender: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  const totalUsers = await prisma.user.count({ where });

  // Added response return so the request completes
  return SuccessResponse(res, "Users fetched successfully", {
    users,
    totalUsers,
    pagination: {
      totalPage: Math.ceil(totalUsers / limit),
      currentPage: page,
      count: users.length,
    },
  });
});

export const getById = asyncHandler(async (req, res, next) => {
  const id = req.params.id;

  const users = await prisma.user.findUnique({
    where: { id },
  });
  if (!users) {
    return next(new ErrorResponse(" user not found", 400));
  }
  return SuccessResponse(res, "user fetch successfully", users, 200);
});
export const updateUser = asyncHandler(async (req, res, next) => {
  const parsedata = updateUsers.partial().parse(req.body);
  const id = req.params.id;

  const existingUser = await prisma.user.findUnique({
    where: { id },
  });

  if (!existingUser) {
    return next(new ErrorResponse("User not found", 404));
  }

  // 3. Handle Phone Number uniqueness check (if being updated)
  if (
    parsedata.phoneNumber &&
    parsedata.phoneNumber !== existingUser.phoneNumber
  ) {
    const phoneExists = await prisma.user.findUnique({
      where: { phoneNumber: parsedata.phoneNumber },
    });

    if (phoneExists) {
      return next(new ErrorResponse("Phone number already in use", 400));
    }
  }

  // 4. Perform the update
  const updatedUser = await prisma.user.update({
    where: { id },
    data: parsedata,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phoneNumber: true,
      dateOfBirth: true,
      gender: true,
      updatedAt: true,
    },
  });

  return SuccessResponse(res, "User updated successfully", updatedUser, 200);
});
