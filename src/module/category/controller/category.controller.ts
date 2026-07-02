import prisma from "../../../config/prisma";
import { asyncHandler } from "../../../middleware/error.middleware";
import { categoryValidator } from "../../../user/validator/category.validation";
import { SuccessResponse, ErrorResponse } from "../../../utils/response.utils";
import { uploadToCloudinary } from "../../../config/cloudinary";

export const categoryCreate = asyncHandler(async (req, res, next) => {
  try {
    // 1. Validate the text data
    const data = categoryValidator.parse(req.body);
    const { name, description, slug } = data;

    let imageUrl = data.image || null;

    // 2. If a file is uploaded, send the buffer to Cloudinary
    if (req.file) {
      const uploadResult = await uploadToCloudinary(
        req.file.buffer,
        "categories",
      );
      imageUrl = uploadResult.secure_url;
    }

    const finalSlug = slug || name.toLowerCase().replace(/[^a-z0-9]+/g, "-");

    const existingCategory = await prisma.category.findUnique({
      where: { slug: finalSlug }
    });

    if (existingCategory) {
      throw new ErrorResponse("A category with this name or slug already exists.", 400);
    }

    // 3. Create record in DB
    const category = await prisma.category.create({
      data: {
        name,
        description: description || null,
        slug: finalSlug,
        image: imageUrl,
      },
    });

    return SuccessResponse(res, "create successfully", category, 201);
  } catch (err) {
    console.error("Error in categoryCreate:", err);
    next(err);
  }
});

export const getAllcategory = asyncHandler(async (req, res, next) => {
  const { page = "1", limit = "10" } = req.query;
  const pageNum = Number(page);
  const limitNum = Number(limit);
  const skip = (pageNum - 1) * limitNum;

  const [categories, total] = await prisma.$transaction([
    prisma.category.findMany({
      skip: skip,
      take: limitNum,
      orderBy: { name: "asc" },
      include: {
        subCategories: true,
        _count: {
          select: { products: true },
        },
      },
    }),
    prisma.category.count(),
  ]);

  return SuccessResponse(
    res,
    "Categories fetched successfully",
    {
      categories,
      pagination: {
        totalCategory: total,
        totalPages: Math.ceil(total / limitNum),
        page: pageNum,
        limit: limitNum,
      },
    },
    200,
  );
});

export const getById = asyncHandler(async (req, res, next) => {
  const id = req.params.id;

  const category = await prisma.category.findUnique({
    where: {
      id,
    },
  });

  return SuccessResponse(res, "fetch category  successfully", category, 200);
});

export const UpdateCategory = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  // Using .partial() allows fields to be optional
  const data = categoryValidator.partial().parse(req.body);

  // If a new file is uploaded during update
  if (req.file) {
    const uploadResult = await uploadToCloudinary(
      req.file.buffer,
      "categories",
    );
    data.image = uploadResult.secure_url;
  }

  const category = await prisma.category.update({
    where: {
      id: id,
    },
    data: {
      name: data.name,
      description: data.description,
      slug: data.slug || undefined,
      image: data.image,
    },
  });

  return SuccessResponse(res, "update successfully", category, 200);
});

export const deleteCategory = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  // Check if category has products
  const productCount = await prisma.product.count({
    where: { categoryId: id },
  });

  if (productCount > 0) {
    res.status(400);
    throw new Error(
      "Cannot delete category containing products. Please delete or reassign products first.",
    );
  }

  // Delete subcategories first
  await prisma.subCategory.deleteMany({
    where: { categoryId: id },
  });

  // Delete the category itself
  await prisma.category.delete({
    where: { id },
  });

  return SuccessResponse(res, "deleted successfully", null, 200);
});
