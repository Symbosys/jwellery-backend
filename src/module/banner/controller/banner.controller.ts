import prisma from "../../../config/prisma";
import { asyncHandler } from "../../../middleware/error.middleware";
import { bannerValidator } from "../validator/banner.validation";
import { SuccessResponse, ErrorResponse } from "../../../utils/response.utils";
import { uploadToCloudinary } from "../../../config/cloudinary";

export const createBanner = asyncHandler(async (req, res, next) => {
  const data = bannerValidator.parse(req.body);
  
  let imageUrl = data.imageUrl || "";

  if (req.file) {
    const uploadResult = await uploadToCloudinary(req.file.buffer, "banners");
    imageUrl = uploadResult.secure_url;
  }

  if (!imageUrl) {
    throw new ErrorResponse("Image is required for banner", 400);
  }

  const banner = await prisma.banner.create({
    data: {
      title: data.title,
      description: data.description || null,
      imageUrl: imageUrl,
      linkUrl: data.linkUrl || null,
      position: data.position || null,
      isActive: data.isActive !== undefined ? (data.isActive === "true" || data.isActive === true) : true,
      startDate: data.startDate ? new Date(data.startDate) : null,
      endDate: data.endDate ? new Date(data.endDate) : null,
    }
  });

  return SuccessResponse(res, "Banner created successfully", banner, 201);
});

export const getAllBanners = asyncHandler(async (req, res, next) => {
  const banners = await prisma.banner.findMany({
    orderBy: { createdAt: "desc" }
  });
  return SuccessResponse(res, "Banners fetched successfully", banners, 200);
});

export const getBannerById = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const banner = await prisma.banner.findUnique({ where: { id } });
  
  if (!banner) {
    throw new ErrorResponse("Banner not found", 404);
  }
  
  return SuccessResponse(res, "Banner fetched successfully", banner, 200);
});

export const updateBanner = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const data = bannerValidator.partial().parse(req.body);

  const existingBanner = await prisma.banner.findUnique({ where: { id } });
  if (!existingBanner) {
    throw new ErrorResponse("Banner not found", 404);
  }

  let imageUrl = data.imageUrl !== undefined ? data.imageUrl : existingBanner.imageUrl;
  if (req.file) {
    const uploadResult = await uploadToCloudinary(req.file.buffer, "banners");
    imageUrl = uploadResult.secure_url;
  }

  const banner = await prisma.banner.update({
    where: { id },
    data: {
      title: data.title !== undefined ? data.title : existingBanner.title,
      description: data.description !== undefined ? data.description : existingBanner.description,
      imageUrl: imageUrl,
      linkUrl: data.linkUrl !== undefined ? data.linkUrl : existingBanner.linkUrl,
      position: data.position !== undefined ? data.position : existingBanner.position,
      isActive: data.isActive !== undefined ? (data.isActive === "true" || data.isActive === true) : existingBanner.isActive,
      startDate: data.startDate ? new Date(data.startDate) : existingBanner.startDate,
      endDate: data.endDate ? new Date(data.endDate) : existingBanner.endDate,
    }
  });

  return SuccessResponse(res, "Banner updated successfully", banner, 200);
});

export const deleteBanner = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  
  const existingBanner = await prisma.banner.findUnique({ where: { id } });
  if (!existingBanner) {
    throw new ErrorResponse("Banner not found", 404);
  }

  await prisma.banner.delete({ where: { id } });
  return SuccessResponse(res, "Banner deleted successfully", null, 200);
});
