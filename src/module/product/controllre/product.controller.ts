import { asyncHandler } from "../../../middleware/error.middleware.js";
import { ErrorResponse, SuccessResponse } from "../../../utils/response.utils.js";
import { statusCode } from "../../../types/types.js";
import prisma from "../../../config/prisma.js";
import { createProductSchema, updateProductSchema } from "../validation/product.validation.js";
import { uploadToCloudinary } from "../../../config/cloudinary.js";
import { addToCartSchema } from "../../cart/validation/cart.validation.js";
import type { AuthenticatedRequest } from "../../../middleware/auth.middleware.js";

async function processBase64Image(base64String: string, folder: string): Promise<string> {
    if (!base64String || !base64String.startsWith('data:image')) {
        return base64String; 
    }
    const matches = base64String.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3 || !matches[2]) {
        return base64String;
    }
    const imageBuffer = Buffer.from(matches[2] as string, 'base64');
    const result = await uploadToCloudinary(imageBuffer, folder);
    return result.secure_url;
}

export const createProduct = asyncHandler(async (req, res, next) => {
    const validData = createProductSchema.parse(req.body);
    let { variants, image, images, ...productData } = validData;

    image = await processBase64Image(image, "products");
    
    let processedImages: string[] = [];
    if (images && images.length > 0) {
        processedImages = await Promise.all(images.map(img => processBase64Image(img, "products")));
    }
    
    if (variants) {
        for (const v of variants) {
            if (v.image) {
                v.image = await processBase64Image(v.image, "products/variants");
            }
        }
    }

    const product = await prisma.product.create({
        data: {
            ...productData,
            image,
            images: processedImages.length > 0 ? processedImages : undefined,
            variants: variants ? {
                create: variants.map(variant => ({
                    sku: variant.sku || undefined,
                    price: variant.price,
                    discountPrice: variant.discountPrice,
                    quantity: variant.quantity,
                    image: variant.image,
                    attributeValues: {
                        connect: variant.attributeValues.map(id => ({ id }))
                    }
                }))
            } : undefined
        },
        include: {
            category: true,
            subCategory: true,
            variants: {
                include: {
                    attributeValues: {
                        include: {
                            attribute: true
                        }
                    }
                }
            }
        }
    });

    return SuccessResponse(res, "Product created successfully", product, statusCode.Created);
});

export const getAllProducts = asyncHandler(async (req, res, next) => {
    const {
        categoryId,
        subCategoryId,
        minPrice,
        maxPrice,
        search,
        brand,
        page = "1",
        limit = "20",
        sort = "newest",
        ...variantFiltersQuery
    } = req.query;

    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(100, Math.max(1, Number(limit)));
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};

    // Category filter
    if (categoryId) {
        where.categoryId = categoryId as string;
    }

    // SubCategory filter
    if (subCategoryId) {
        where.subCategoryId = subCategoryId as string;
    }

    // Brand filter
    if (brand) {
        where.brand = brand as string;
    }

    // Search across name, description, brand, and category name
    if (search) {
        const searchStr = search as string;
        where.OR = [
            { name: { contains: searchStr } },
            { description: { contains: searchStr } },
            { brand: { contains: searchStr } },
            { category: { name: { contains: searchStr } } },
        ];
    }

    // Price range filtering
    if (minPrice || maxPrice) {
        where.price = {};
        if (minPrice) {
            where.price.gte = parseFloat(minPrice as string);
        }
        if (maxPrice) {
            where.price.lte = parseFloat(maxPrice as string);
        }
    }

    // Dynamic attribute/variant filtering
    const activeAttributes = await prisma.attribute.findMany({
        select: { name: true }
    });

    const attributeMap = new Map(activeAttributes.map(attr => [attr.name.toLowerCase(), attr.name]));
    const andConditions: any[] = [];

    for (const [key, value] of Object.entries(variantFiltersQuery)) {
        const exactAttrName = attributeMap.get(key.toLowerCase());
        if (exactAttrName && value) {
            let valuesList: string[] = [];
            if (typeof value === 'string') {
                valuesList = value.split(',').map(v => v.trim());
            } else if (Array.isArray(value)) {
                valuesList = (value as string[]).map(v => String(v).trim());
            }

            if (valuesList.length > 0) {
                andConditions.push({
                    attributeValues: {
                        some: {
                            value: { in: valuesList },
                            attribute: {
                                name: exactAttrName
                            }
                        }
                    }
                });
            }
        }
    }

    if (andConditions.length > 0) {
        where.variants = {
            some: {
                AND: andConditions
            }
        };
    }

    // Sorting
    let orderBy: any;
    switch (sort) {
        case "price-asc":
            orderBy = { price: "asc" };
            break;
        case "price-desc":
            orderBy = { price: "desc" };
            break;
        case "rating":
            orderBy = { rating: "desc" };
            break;
        case "name-asc":
            orderBy = { name: "asc" };
            break;
        case "name-desc":
            orderBy = { name: "desc" };
            break;
        case "newest":
        default:
            orderBy = { createdAt: "desc" };
            break;
    }

    // Fetch products and total count in parallel
    const [products, total] = await prisma.$transaction([
        prisma.product.findMany({
            where,
            include: {
                category: true,
                subCategory: true,
                variants: {
                    include: {
                        attributeValues: {
                            include: {
                                attribute: true
                            }
                        }
                    }
                }
            },
            orderBy,
            skip,
            take: limitNum
        }),
        prisma.product.count({ where })
    ]);

    return SuccessResponse(res, "Products fetched successfully", {
        products,
        pagination: {
            total,
            totalPages: Math.ceil(total / limitNum),
            page: pageNum,
            limit: limitNum
        }
    }, statusCode.OK);
});

export const getProductById = asyncHandler(async (req, res, next) => {
    const { id } = req.params;
    const product = await prisma.product.findUnique({
        where: { id },
        include: {
            category: true,
            subCategory: true,
            variants: {
                include: {
                    attributeValues: {
                        include: {
                            attribute: true
                        }
                    }
                }
            }
        },
    });

    if (!product) {
        throw new ErrorResponse("Product not found", statusCode.Not_Found);
    }

    return SuccessResponse(res, "Product fetched successfully", product, statusCode.OK);
});

export const updateProduct = asyncHandler(async (req, res, next) => {
    const { id } = req.params;
    const validData = updateProductSchema.parse(req.body);
    let { variants, image, images, ...productData } = validData;

    if (image) {
        image = await processBase64Image(image, "products");
    }
    
    let processedImages: string[] | undefined = undefined;
    if (images !== undefined) {
        if (images.length > 0) {
            processedImages = await Promise.all(images.map(img => processBase64Image(img, "products")));
        } else {
            processedImages = [];
        }
    }
    
    if (variants) {
        for (const v of variants) {
            if (v.image) {
                v.image = await processBase64Image(v.image, "products/variants");
            }
        }
    }

    const existingProduct = await prisma.product.findUnique({ where: { id } });
    if (!existingProduct) {
        throw new ErrorResponse("Product not found", statusCode.Not_Found);
    }

    const updatedProduct = await prisma.$transaction(async (tx) => {
        if (variants !== undefined) {
            // Delete existing variants
            await tx.productVariant.deleteMany({
                where: { productId: id }
            });
        }

        const updated = await tx.product.update({
            where: { id },
            data: {
                ...productData,
                ...(image ? { image } : {}),
                ...(processedImages !== undefined ? { images: processedImages } : {}),
                variants: (variants && variants.length > 0) ? {
                    create: variants.map(variant => ({
                        sku: variant.sku || undefined,
                        price: variant.price,
                        discountPrice: variant.discountPrice,
                        quantity: variant.quantity,
                        image: variant.image,
                        attributeValues: {
                            connect: variant.attributeValues.map(id => ({ id }))
                        }
                    }))
                } : undefined
            },
            include: {
                category: true,
                subCategory: true,
                variants: {
                    include: {
                        attributeValues: {
                            include: {
                                attribute: true
                            }
                        }
                    }
                }
            }
        });
        return updated;
    });

    return SuccessResponse(res, "Product updated successfully", updatedProduct, statusCode.OK);
});

export const deleteProduct = asyncHandler(async (req, res, next) => {
    const { id } = req.params;

    const existingProduct = await prisma.product.findUnique({ where: { id } });
    if (!existingProduct) {
        throw new ErrorResponse("Product not found", statusCode.Not_Found);
    }

    await prisma.product.delete({ where: { id } });

    return SuccessResponse(res, "Product deleted successfully", null, statusCode.OK);
});

export const addToBag = asyncHandler<AuthenticatedRequest>(async (req, res, next) => {
    const userId = req.user?.id;
    if (!userId) {
        throw new ErrorResponse("Not authorized", statusCode.Unauthorized);
    }

    // Use existing cart validation schema
    const validData = addToCartSchema.parse(req.body);
    const { productId, variantId, quantity, size, color } = validData;

    // 1. Verify product exists
    const product = await prisma.product.findUnique({
        where: { id: productId }
    });

    if (!product) {
        throw new ErrorResponse("Product not found", statusCode.Not_Found);
    }

    // 2. Verify variant if provided
    let variant = null;
    if (variantId) {
        variant = await prisma.productVariant.findFirst({
            where: { id: variantId, productId }
        });
        if (!variant) {
            throw new ErrorResponse("Product variant not found", statusCode.Not_Found);
        }
    }

    // 3. Find or create user's cart
    let cart = await prisma.cart.findUnique({
        where: { userId }
    });

    if (!cart) {
        cart = await prisma.cart.create({
            data: { userId }
        });
    }

    // 4. Check if the exact item already exists in the cart (same product, variant, size, color)
    const existingItem = await prisma.cartItem.findFirst({
        where: {
            cartId: cart.id,
            productId,
            variantId: variantId || null,
            size: size || null,
            color: color || null
        }
    });

    const newQuantity = existingItem ? existingItem.quantity + quantity : quantity;

    // 5. Check stock availability
    if (variant) {
        if (variant.quantity < newQuantity) {
            throw new ErrorResponse(
                `Only ${variant.quantity} items of this variant are in stock (requested total: ${newQuantity})`,
                statusCode.Bad_Request
            );
        }
    } else {
        if (product.quantity < newQuantity) {
            throw new ErrorResponse(
                `Only ${product.quantity} items of this product are in stock (requested total: ${newQuantity})`,
                statusCode.Bad_Request
            );
        }
    }

    // 6. Update existing item quantity or create new cart item
    let cartItem;
    if (existingItem) {
        cartItem = await prisma.cartItem.update({
            where: { id: existingItem.id },
            data: { quantity: newQuantity },
            include: {
                product: true,
                variant: true
            }
        });
    } else {
        cartItem = await prisma.cartItem.create({
            data: {
                cartId: cart.id,
                productId,
                variantId: variantId || null,
                quantity,
                size: size || null,
                color: color || null
            },
            include: {
                product: true,
                variant: true
            }
        });
    }

    return SuccessResponse(res, "Item added to bag successfully", cartItem, statusCode.Created);
});
