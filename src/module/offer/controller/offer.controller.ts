import { asyncHandler } from "../../../middleware/error.middleware.js";
import { ErrorResponse, SuccessResponse } from "../../../utils/response.utils.js";
import { statusCode } from "../../../types/types.js";
import prisma from "../../../config/prisma.js";
import { createOfferSchema, updateOfferSchema } from "../validation/offer.validation.js";

// @desc    Get all offers
// @route   GET /api/offer
// @access  Public/Admin
export const getAllOffers = asyncHandler(async (req, res, next) => {
    const offers = await prisma.offer.findMany({
        include: {
            products: true,
        },
        orderBy: {
            createdAt: "desc",
        },
    });

    return SuccessResponse(res, "Offers fetched successfully", offers, statusCode.OK);
});

// @desc    Get single offer
// @route   GET /api/offer/:id
// @access  Public/Admin
export const getOfferById = asyncHandler(async (req, res, next) => {
    const { id } = req.params;

    const offer = await prisma.offer.findUnique({
        where: { id },
        include: {
            products: true,
        },
    });

    if (!offer) {
        throw new ErrorResponse("Offer not found", statusCode.Not_Found);
    }

    return SuccessResponse(res, "Offer fetched successfully", offer, statusCode.OK);
});

// @desc    Create new offer
// @route   POST /api/offer
// @access  Admin
export const createOffer = asyncHandler(async (req, res, next) => {
    const validData = createOfferSchema.parse(req.body);

    // Destructure productIds for relationship connecting
    const { productIds, ...offerData } = validData;

    const newOffer = await prisma.offer.create({
        data: {
            ...offerData,
            ...(productIds && productIds.length > 0 ? {
                products: {
                    connect: productIds.map(id => ({ id }))
                }
            } : {})
        },
        include: {
            products: true,
        },
    });

    return SuccessResponse(res, "Offer created successfully", newOffer, statusCode.Created);
});

// @desc    Update offer
// @route   PUT /api/offer/:id
// @access  Admin
export const updateOffer = asyncHandler(async (req, res, next) => {
    const { id } = req.params;
    const validData = updateOfferSchema.parse(req.body);

    const existingOffer = await prisma.offer.findUnique({
        where: { id },
    });

    if (!existingOffer) {
        throw new ErrorResponse("Offer not found", statusCode.Not_Found);
    }

    const { productIds, ...offerData } = validData;

    const updatedOffer = await prisma.offer.update({
        where: { id },
        data: {
            ...offerData,
            // If productIds is provided, we update the relationship. 
            // In Prisma, 'set' replaces all existing connections.
            ...(productIds !== undefined ? {
                products: {
                    set: productIds.map(pid => ({ id: pid }))
                }
            } : {})
        },
        include: {
            products: true,
        },
    });

    return SuccessResponse(res, "Offer updated successfully", updatedOffer, statusCode.OK);
});

// @desc    Delete offer
// @route   DELETE /api/offer/:id
// @access  Admin
export const deleteOffer = asyncHandler(async (req, res, next) => {
    const { id } = req.params;

    const existingOffer = await prisma.offer.findUnique({
        where: { id },
    });

    if (!existingOffer) {
        throw new ErrorResponse("Offer not found", statusCode.Not_Found);
    }

    await prisma.offer.delete({
        where: { id },
    });

    return SuccessResponse(res, "Offer deleted successfully", null, statusCode.OK);
});
