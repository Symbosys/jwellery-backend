import { uploadToCloudinary } from "../../config/cloudinary";
import prisma from "../../config/prisma";
import { asyncHandler } from "../../middleware/error.middleware";
import { SuccessResponse } from "../../utils/response.utils";
import { subCategoryValidation } from "../../user/validator/subCategory.validation";

export const subCatogaryCreate = asyncHandler(async (req, res, next) => {
  const data = subCategoryValidation.parse(req.body);
  const { name, description, categoryId } = data;

  let imageUrl = data.image || null;

  if (req.file) {
    const uploadResult = await uploadToCloudinary(
      req.file.buffer,
      "categories",
    );
    imageUrl = uploadResult.secure_url;
  }

  const subCatogary = await prisma.subCategory.create({
    data: {
      name,
      description: description || "",
      categoryId,
      image: imageUrl,
    },
  });
  return SuccessResponse(res, "create successfully", subCatogary, 201);
});

export const getAllCategory = asyncHandler(async (req, res, next) => {
  const { page = "1", limit = "10" } = req.query;
  const pageNum = Number(page);
  const limitNum = Number(limit);
  const skip = (pageNum - 1) * limitNum;

  const [subCategories, total] = await prisma.$transaction([
    prisma.subCategory.findMany({
      skip: skip,
      take: limitNum,
      orderBy: { name: "asc" },
    }),
    prisma.subCategory.count(),
  ]);
  return SuccessResponse(
    res,
    "Subcategories fetched successfully",
    {
      subCategories,
      pagination: {
        totalSubCategory: total,
        totalPages: Math.ceil(total / limitNum),
        page: pageNum,
        limit: limitNum,
      },
    },
    200,
  );
});

export const getByIdSubCategory = asyncHandler(async (req, res, next) => {
  const id = req.params.id;

  const subCategory = await prisma.subCategory.findUnique({
    where: {
      id,
    },
  });
  return SuccessResponse(
    res,
    "fetch subcategory successfully",
    subCategory,
    200,
  );
});

export const updateSubCategory = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const data = subCategoryValidation.partial().parse(req.body);

  if (req.file) {
    const uploadResult = await uploadToCloudinary(
      req.file.buffer,
      "categories",
    );
    data.image = uploadResult.secure_url;
  }

  const subCategory = await prisma.subCategory.update({
    where: { id },
    data: {
      name: data.name,
      description: data.description || undefined,
      image: data.image || undefined,
      categoryId: data.categoryId,
    },
  });

  return SuccessResponse(res, "update successfully", subCategory, 200);
});

export const deleteSubCategory = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  // Check if subcategory has products
  const productCount = await prisma.product.count({
    where: { subCategoryId: id },
  });

  if (productCount > 0) {
    res.status(400);
    throw new Error(
      "Cannot delete subcategory containing products. Please delete or reassign products first.",
    );
  }

  await prisma.subCategory.delete({
    where: { id },
  });

  return SuccessResponse(res, "deleted successfully", null, 200);
});
