import { asyncHandler } from "../../../middleware/error.middleware.js";
import { ErrorResponse, SuccessResponse } from "../../../utils/response.utils.js";
import { statusCode } from "../../../types/types.js";
import prisma from "../../../config/prisma.js";
import {
    createAttributeSchema,
    addAttributeValuesSchema,
    updateAttributeValueSchema,
} from "../validation/attribute.validation.js";
import { processBase64Image } from "../../../utils/image.utils.js";

export const getAllAttributes = asyncHandler(async (req, res, next) => {
    const attributes = await prisma.attribute.findMany({
        include: {
            values: true,
        },
        orderBy: {
            name: "asc",
        },
    });

    return SuccessResponse(res, "Attributes fetched successfully", attributes, statusCode.OK);
});

export const createAttribute = asyncHandler(async (req, res, next) => {
    const validData = createAttributeSchema.parse(req.body);

    const existing = await prisma.attribute.findUnique({
        where: { name: validData.name }
    });

    if (existing) {
        throw new ErrorResponse("Attribute with this name already exists", statusCode.Bad_Request);
    }

    let valuesToCreate: Array<{ value: string; image?: string | null }> = [];
    if (validData.values && validData.values.length > 0) {
        valuesToCreate = await Promise.all(
            validData.values.map(async (item) => {
                if (typeof item === "string") {
                    return { value: item, image: null };
                }
                const imageUrl = item.image ? await processBase64Image(item.image, "attributes/values") : null;
                return { value: item.value, image: imageUrl };
            })
        );
    }

    const attribute = await prisma.attribute.create({
        data: {
            name: validData.name,
            values: valuesToCreate.length > 0 ? {
                create: valuesToCreate
            } : undefined
        },
        include: {
            values: true
        }
    });

    return SuccessResponse(res, "Attribute created successfully", attribute, statusCode.Created);
});

export const addAttributeValues = asyncHandler(async (req, res, next) => {
    const { id } = req.params;
    if (!id) {
        throw new ErrorResponse("Attribute ID is required", statusCode.Bad_Request);
    }
    const validData = addAttributeValuesSchema.parse(req.body);

    const attribute = await prisma.attribute.findUnique({
        where: { id }
    });

    if (!attribute) {
        throw new ErrorResponse("Attribute not found", statusCode.Not_Found);
    }

    // Upsert values to avoid duplicates
    const createdValues = await Promise.all(
        validData.values.map(async (item) => {
            const valStr = typeof item === "string" ? item : item.value;
            const rawImg = typeof item === "string" ? null : item.image;
            const imageUrl = rawImg ? await processBase64Image(rawImg, "attributes/values") : null;

            return prisma.attributeValue.upsert({
                where: {
                    attributeId_value: {
                        attributeId: id,
                        value: valStr
                    }
                },
                update: imageUrl !== null ? { image: imageUrl } : {},
                create: {
                    attributeId: id,
                    value: valStr,
                    image: imageUrl
                }
            });
        })
    );

    return SuccessResponse(res, "Attribute values added successfully", createdValues, statusCode.Created);
});

export const updateAttributeValue = asyncHandler(async (req, res, next) => {
    const { valueId } = req.params;
    if (!valueId) {
        throw new ErrorResponse("Attribute value ID is required", statusCode.Bad_Request);
    }

    const validData = updateAttributeValueSchema.parse(req.body);

    const existingValue = await prisma.attributeValue.findUnique({
        where: { id: valueId }
    });

    if (!existingValue) {
        throw new ErrorResponse("Attribute value not found", statusCode.Not_Found);
    }

    let imageUrl: string | null | undefined = undefined;
    if (validData.image !== undefined) {
        imageUrl = validData.image ? await processBase64Image(validData.image, "attributes/values") : null;
    }

    const updatedValue = await prisma.attributeValue.update({
        where: { id: valueId },
        data: {
            ...(validData.value ? { value: validData.value } : {}),
            ...(imageUrl !== undefined ? { image: imageUrl } : {}),
        }
    });

    return SuccessResponse(res, "Attribute value updated successfully", updatedValue, statusCode.OK);
});

export const deleteAttribute = asyncHandler(async (req, res, next) => {
    const { id } = req.params;
    if (!id) {
        throw new ErrorResponse("Attribute ID is required", statusCode.Bad_Request);
    }

    const attribute = await prisma.attribute.findUnique({
        where: { id }
    });

    if (!attribute) {
        throw new ErrorResponse("Attribute not found", statusCode.Not_Found);
    }

    await prisma.attribute.delete({
        where: { id }
    });

    return SuccessResponse(res, "Attribute deleted successfully", null, statusCode.OK);
});

export const deleteAttributeValue = asyncHandler(async (req, res, next) => {
    const { valueId } = req.params;
    if (!valueId) {
        throw new ErrorResponse("Attribute value ID is required", statusCode.Bad_Request);
    }

    const val = await prisma.attributeValue.findUnique({
        where: { id: valueId }
    });

    if (!val) {
        throw new ErrorResponse("Attribute value not found", statusCode.Not_Found);
    }

    await prisma.attributeValue.delete({
        where: { id: valueId }
    });

    return SuccessResponse(res, "Attribute value deleted successfully", null, statusCode.OK);
});

