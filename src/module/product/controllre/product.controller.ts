import { asyncHandler } from "../../../middleware/error.middleware.js";
import {
  ErrorResponse,
  SuccessResponse,
} from "../../../utils/response.utils.js";
import { statusCode } from "../../../types/types.js";
import prisma from "../../../config/prisma.js";
import {
  createProductSchema,
  updateProductSchema,
} from "../validation/product.validation.js";
import { processBase64Image } from "../../../utils/image.utils.js";
import { addToCartSchema } from "../../cart/validation/cart.validation.js";
import type { AuthenticatedRequest } from "../../../middleware/auth.middleware.js";

export function formatProductWithResolvedVariantImages<T extends { variants?: any[] }>(product: T): T {
  if (!product || !Array.isArray(product.variants)) {
    return product;
  }
  const formattedVariants = product.variants.map((v) => {
    let resolvedImage = v.image || null;
    if (!resolvedImage && Array.isArray(v.attributeValues)) {
      const attrWithImg = v.attributeValues.find((av: any) => av.image);
      if (attrWithImg) {
        resolvedImage = attrWithImg.image;
      }
    }
    return {
      ...v,
      resolvedImage,
    };
  });
  return {
    ...product,
    variants: formattedVariants,
  };
}

export const createProduct = asyncHandler(async (req, res, next) => {
  const validData = createProductSchema.parse(req.body);
  let { variants, image, images, ...productData } = validData;

  const uploadedMainImage = await processBase64Image(image, "products");
  image = uploadedMainImage || image;

  let processedImages: string[] = [];
  if (images && images.length > 0) {
    const uploadedImages = await Promise.all(
      images.map((img) => processBase64Image(img, "products")),
    );
    processedImages = uploadedImages.filter((img): img is string => Boolean(img));
  }

  if (variants) {
    for (const v of variants) {
      if (v.image) {
        v.image = await processBase64Image(v.image, "products/variants");
      }
    }
  }

  // Filter valid attributeValue IDs and sanitize variant SKUs
  let validVariants = variants;
  if (variants && variants.length > 0) {
    const allAttrValueIds = Array.from(
      new Set(variants.flatMap((v) => v.attributeValues || [])),
    );
    const existingAttrValues = await prisma.attributeValue.findMany({
      where: { id: { in: allAttrValueIds } },
      select: { id: true },
    });
    const validAttrValIdSet = new Set(existingAttrValues.map((av) => av.id));
    const usedSkus = new Set<string>();

    validVariants = variants.map((v) => {
      let cleanSku = v.sku?.trim() || undefined;
      if (cleanSku) {
        if (usedSkus.has(cleanSku)) {
          cleanSku = undefined;
        } else {
          usedSkus.add(cleanSku);
        }
      }

      return {
        ...v,
        sku: cleanSku,
        attributeValues: (v.attributeValues || []).filter((id) =>
          validAttrValIdSet.has(id),
        ),
      };
    });
  }

  const product = await prisma.product.create({
    data: {
      ...productData,
      image,
      images: processedImages.length > 0 ? processedImages : undefined,
      variants: validVariants && validVariants.length > 0
        ? {
            create: validVariants.map((variant) => ({
              sku: variant.sku || undefined,
              price: variant.price,
              discountPrice: variant.discountPrice,
              quantity: variant.quantity,
              image: variant.image,
              attributeValues: {
                connect: variant.attributeValues.map((id) => ({ id })),
              },
            })),
          }
        : undefined,
    },
    include: {
      category: true,
      subCategory: true,
      variants: {
        include: {
          attributeValues: {
            include: {
              attribute: true,
            },
          },
        },
      },
    },
  });

  return SuccessResponse(
    res,
    "Product created successfully",
    formatProductWithResolvedVariantImages(product),
    statusCode.Created,
  );
});

export const getAllProducts = asyncHandler(async (req, res, next) => {
  const {
    categoryId,
    subCategoryId,
    minPrice,
    maxPrice,
    search,
    brandId,
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
  if (brandId) {
    where.brandId = brandId as string;
  }

  // Search across name, description, brand, and category name
  if (search) {
    const searchStr = search as string;
    where.OR = [
      { name: { contains: searchStr } },
      { description: { contains: searchStr } },
      { brand: { name: { contains: searchStr } } },
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
    select: { name: true },
  });

  const attributeMap = new Map(
    activeAttributes.map((attr) => [attr.name.toLowerCase(), attr.name]),
  );
  const andConditions: any[] = [];

  for (const [key, value] of Object.entries(variantFiltersQuery)) {
    const exactAttrName = attributeMap.get(key.toLowerCase());
    if (exactAttrName && value) {
      let valuesList: string[] = [];
      if (typeof value === "string") {
        valuesList = value.split(",").map((v) => v.trim());
      } else if (Array.isArray(value)) {
        valuesList = (value as string[]).map((v) => String(v).trim());
      }

      if (valuesList.length > 0) {
        andConditions.push({
          attributeValues: {
            some: {
              value: { in: valuesList },
              attribute: {
                name: exactAttrName,
              },
            },
          },
        });
      }
    }
  }

  if (andConditions.length > 0) {
    where.variants = {
      some: {
        AND: andConditions,
      },
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
                attribute: true,
              },
            },
          },
        },
      },
      orderBy,
      skip,
      take: limitNum,
    }),
    prisma.product.count({ where }),
  ]);

  return SuccessResponse(
    res,
    "Products fetched successfully",
    {
      products: products.map(formatProductWithResolvedVariantImages),
      pagination: {
        total,
        totalPages: Math.ceil(total / limitNum),
        page: pageNum,
        limit: limitNum,
      },
    },
    statusCode.OK,
  );
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
              attribute: true,
            },
          },
        },
      },
      reviews: {
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      },
    },
  });

  if (!product) {
    throw new ErrorResponse("Product not found", statusCode.Not_Found);
  }

  return SuccessResponse(
    res,
    "Product fetched successfully",
    formatProductWithResolvedVariantImages(product),
    statusCode.OK,
  );
});

export const updateProduct = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const validData = updateProductSchema.parse(req.body);
  let { variants, image, images, ...productData } = validData;

  if (image) {
    const uploadedImage = await processBase64Image(image, "products");
    image = uploadedImage || image;
  }

  let processedImages: string[] | undefined = undefined;
  if (images !== undefined) {
    if (images.length > 0) {
      const uploadedImages = await Promise.all(
        images.map((img) => processBase64Image(img, "products")),
      );
      processedImages = uploadedImages.filter((img): img is string => Boolean(img));
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

  // Sanitize variant SKUs and verify AttributeValue IDs exist in database
  let validVariants = variants;
  if (variants && variants.length > 0) {
    const allAttrValueIds = Array.from(
      new Set(variants.flatMap((v) => v.attributeValues || [])),
    );

    const existingAttrValues = await prisma.attributeValue.findMany({
      where: { id: { in: allAttrValueIds } },
      select: { id: true },
    });
    const validAttrValIdSet = new Set(existingAttrValues.map((av) => av.id));
    const usedSkus = new Set<string>();

    validVariants = variants.map((v) => {
      let cleanSku = v.sku?.trim() || undefined;
      if (cleanSku) {
        if (usedSkus.has(cleanSku)) {
          cleanSku = undefined;
        } else {
          usedSkus.add(cleanSku);
        }
      }

      return {
        ...v,
        sku: cleanSku,
        attributeValues: (v.attributeValues || []).filter((id) =>
          validAttrValIdSet.has(id),
        ),
      };
    });
  }

  const updatedProduct = await prisma.$transaction(async (tx) => {
    if (validVariants !== undefined) {
      // 1. Delete existing variants
      await tx.productVariant.deleteMany({
        where: { productId: id },
      });
    }

    // 2. Update main product properties
    await tx.product.update({
      where: { id },
      data: {
        ...productData,
        ...(image ? { image } : {}),
        ...(processedImages !== undefined ? { images: processedImages } : {}),
      },
    });

    // 3. Create new variants
    if (validVariants && validVariants.length > 0) {
      for (const variant of validVariants) {
        await tx.productVariant.create({
          data: {
            product: { connect: { id } },
            sku: variant.sku || null,
            price: variant.price,
            discountPrice: variant.discountPrice,
            quantity: variant.quantity,
            image: variant.image || null,
            attributeValues: {
              connect: variant.attributeValues.map((avId) => ({ id: avId })),
            },
          },
        });
      }
    }

    // 4. Return updated product with full relation includes
    return tx.product.findUnique({
      where: { id },
      include: {
        category: true,
        subCategory: true,
        variants: {
          include: {
            attributeValues: {
              include: {
                attribute: true,
              },
            },
          },
        },
      },
    });
  });

  if (!updatedProduct) {
    throw new ErrorResponse("Failed to update product", statusCode.Internal_Server_Error);
  }

  return SuccessResponse(
    res,
    "Product updated successfully",
    formatProductWithResolvedVariantImages(updatedProduct),
    statusCode.OK,
  );
});

export const deleteProduct = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  const existingProduct = await prisma.product.findUnique({ where: { id } });
  if (!existingProduct) {
    throw new ErrorResponse("Product not found", statusCode.Not_Found);
  }

  await prisma.product.delete({ where: { id } });

  return SuccessResponse(
    res,
    "Product deleted successfully",
    null,
    statusCode.OK,
  );
});

export const addToBag = asyncHandler<AuthenticatedRequest>(
  async (req, res, next) => {
    const userId = req.user?.id;
    if (!userId) {
      throw new ErrorResponse("Not authorized", statusCode.Unauthorized);
    }

    // Use existing cart validation schema
    const validData = addToCartSchema.parse(req.body);
    const { productId, variantId, quantity, size, color } = validData;

    // 1. Verify product exists
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new ErrorResponse("Product not found", statusCode.Not_Found);
    }

    // 2. Verify variant if provided
    let variant = null;
    if (variantId) {
      variant = await prisma.productVariant.findFirst({
        where: { id: variantId, productId },
      });
      if (!variant) {
        throw new ErrorResponse(
          "Product variant not found",
          statusCode.Not_Found,
        );
      }
    }

    // 3. Find or create user's cart
    let cart = await prisma.cart.findUnique({
      where: { userId },
    });

    if (!cart) {
      cart = await prisma.cart.create({
        data: { userId },
      });
    }

    // 4. Check if the exact item already exists in the cart (same product, variant, size, color)
    const existingItem = await prisma.cartItem.findFirst({
      where: {
        cartId: cart.id,
        productId,
        variantId: variantId || null,
        size: size || null,
        color: color || null,
      },
    });

    const newQuantity = existingItem
      ? existingItem.quantity + quantity
      : quantity;

    // 5. Check stock availability
    if (variant) {
      if (variant.quantity < newQuantity) {
        throw new ErrorResponse(
          `Only ${variant.quantity} items of this variant are in stock (requested total: ${newQuantity})`,
          statusCode.Bad_Request,
        );
      }
    } else {
      if (product.quantity < newQuantity) {
        throw new ErrorResponse(
          `Only ${product.quantity} items of this product are in stock (requested total: ${newQuantity})`,
          statusCode.Bad_Request,
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
          variant: true,
        },
      });
    } else {
      cartItem = await prisma.cartItem.create({
        data: {
          cartId: cart.id,
          productId,
          variantId: variantId || null,
          quantity,
          size: size || null,
          color: color || null,
        },
        include: {
          product: true,
          variant: true,
        },
      });
    }

    return SuccessResponse(
      res,
      "Item added to bag successfully",
      cartItem,
      statusCode.Created,
    );
  },
);
