import prisma from "../../../config/prisma.js";
import { asyncHandler } from "../../../middleware/error.middleware.js";
import { ErrorResponse, SuccessResponse } from "../../../utils/response.utils.js";
import { statusCode } from "../../../types/types.js";
import { addToCartSchema, updateCartItemSchema } from "../validation/cart.validation.js";
import type { AuthenticatedRequest } from "../../../middleware/auth.middleware.js";

// Fetch the current user's cart
export const getCart = asyncHandler<AuthenticatedRequest>(async (req, res, next) => {
    const userId = req.user?.id;
    if (!userId) {
        throw new ErrorResponse("Not authorized", statusCode.Unauthorized);
    }

    let cart = await prisma.cart.findUnique({
        where: { userId },
        include: {
            items: {
                include: {
                    product: true,
                    variant: {
                        include: {
                            attributeValues: {
                                include: {
                                    attribute: true
                                }
                            }
                        }
                    }
                },
                orderBy: {
                    createdAt: "desc"
                }
            }
        }
    });

    // Create a cart for the user if they don't have one yet
    if (!cart) {
        cart = await prisma.cart.create({
            data: { userId },
            include: {
                items: {
                    include: {
                        product: true,
                        variant: {
                            include: {
                                attributeValues: {
                                    include: {
                                        attribute: true
                                    }
                                }
                            }
                        }
                    },
                    orderBy: {
                        createdAt: "desc"
                    }
                }
            }
        });
    }

    return SuccessResponse(res, "Cart fetched successfully", cart, statusCode.OK);
});

// Add an item to the cart
export const addToCart = asyncHandler<AuthenticatedRequest>(async (req, res, next) => {
    const userId = req.user?.id;
    if (!userId) {
        throw new ErrorResponse("Not authorized", statusCode.Unauthorized);
    }

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
                variant: {
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
                variant: {
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
    }

    return SuccessResponse(res, "Item added to cart successfully", cartItem, statusCode.Created);
});

// Update cart item quantity
export const updateCartItemQuantity = asyncHandler<AuthenticatedRequest>(async (req, res, next) => {
    const userId = req.user?.id;
    if (!userId) {
        throw new ErrorResponse("Not authorized", statusCode.Unauthorized);
    }

    const { itemId } = req.params;
    if (!itemId) {
        throw new ErrorResponse("Item ID is required", statusCode.Bad_Request);
    }

    const validData = updateCartItemSchema.parse(req.body);
    const { quantity } = validData;

    // Find the cart item and check ownership
    const cartItem = await prisma.cartItem.findUnique({
        where: { id: itemId },
        include: {
            cart: true,
            product: true,
            variant: true
        }
    });

    if (!cartItem) {
        throw new ErrorResponse("Cart item not found", statusCode.Not_Found);
    }

    if (cartItem.cart.userId !== userId) {
        throw new ErrorResponse("Not authorized to modify this cart item", statusCode.Forbidden);
    }

    // Check stock availability
    if (cartItem.variant) {
        if (cartItem.variant.quantity < quantity) {
            throw new ErrorResponse(
                `Only ${cartItem.variant.quantity} items are available in stock`,
                statusCode.Bad_Request
            );
        }
    } else {
        if (cartItem.product.quantity < quantity) {
            throw new ErrorResponse(
                `Only ${cartItem.product.quantity} items are available in stock`,
                statusCode.Bad_Request
            );
        }
    }

    const updatedItem = await prisma.cartItem.update({
        where: { id: itemId },
        data: { quantity },
        include: {
            product: true,
            variant: {
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

    return SuccessResponse(res, "Cart item quantity updated successfully", updatedItem, statusCode.OK);
});

// Remove an item from the cart
export const removeCartItem = asyncHandler<AuthenticatedRequest>(async (req, res, next) => {
    const userId = req.user?.id;
    if (!userId) {
        throw new ErrorResponse("Not authorized", statusCode.Unauthorized);
    }

    const { itemId } = req.params;
    if (!itemId) {
        throw new ErrorResponse("Item ID is required", statusCode.Bad_Request);
    }

    // Find the cart item and check ownership
    const cartItem = await prisma.cartItem.findUnique({
        where: { id: itemId },
        include: { cart: true }
    });

    if (!cartItem) {
        throw new ErrorResponse("Cart item not found", statusCode.Not_Found);
    }

    if (cartItem.cart.userId !== userId) {
        throw new ErrorResponse("Not authorized to modify this cart item", statusCode.Forbidden);
    }

    await prisma.cartItem.delete({
        where: { id: itemId }
    });

    return SuccessResponse(res, "Item removed from cart successfully", null, statusCode.OK);
});

// Clear all items in the user's cart
export const clearCart = asyncHandler<AuthenticatedRequest>(async (req, res, next) => {
    const userId = req.user?.id;
    if (!userId) {
        throw new ErrorResponse("Not authorized", statusCode.Unauthorized);
    }

    const cart = await prisma.cart.findUnique({
        where: { userId }
    });

    if (!cart) {
        throw new ErrorResponse("Cart not found", statusCode.Not_Found);
    }

    await prisma.cartItem.deleteMany({
        where: { cartId: cart.id }
    });

    return SuccessResponse(res, "Cart cleared successfully", null, statusCode.OK);
});
