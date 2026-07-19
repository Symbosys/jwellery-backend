import prisma from "../../../config/prisma.js";
import { asyncHandler } from "../../../middleware/error.middleware.js";
import { ErrorResponse, SuccessResponse } from "../../../utils/response.utils.js";
import { statusCode } from "../../../types/types.js";
import { createOrderSchema, updateOrderStatusSchema, updatePaymentStatusSchema } from "../validation/order.validation.js";
import type { AuthenticatedRequest } from "../../../middleware/auth.middleware.js";

// Helper to generate unique order number
const generateOrderNumber = (): string => {
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.floor(1000 + Math.random() * 9000).toString();
  return `ORD-${timestamp}-${random}`;
};

// 1. Create a new order (Checkout from Cart)
export const createOrder = asyncHandler<AuthenticatedRequest>(async (req, res, next) => {
  const userId = req.user?.id;
  if (!userId) {
    throw new ErrorResponse("Not authorized", statusCode.Unauthorized);
  }

  // Validate request body
  const validData = createOrderSchema.parse(req.body);
  const {
    shippingName,
    shippingPhone,
    shippingAddress,
    shippingCity,
    shippingState,
    shippingPincode,
    paymentMethod,
    note,
    addressId
  } = validData;

  // Fetch user's cart and items
  const cart = await prisma.cart.findUnique({
    where: { userId },
    include: {
      items: {
        include: {
          product: true,
          variant: true
        }
      }
    }
  });

  if (!cart || cart.items.length === 0) {
    throw new ErrorResponse("Your cart is empty", statusCode.Bad_Request);
  }

  // Pre-calculate totals and validate stocks
  let subtotal = 0;
  const itemsToCreate: any[] = [];
  const stockUpdates: Array<{ type: "product" | "variant"; id: string; newQty: number }> = [];

  for (const item of cart.items) {
    const product = item.product;
    const variant = item.variant;

    if (!product) {
      throw new ErrorResponse("One of the products in your cart no longer exists", statusCode.Not_Found);
    }

    // Determine unit price (discountPrice if available, otherwise regular price)
    let unitPrice: number;
    if (variant) {
      unitPrice = variant.discountPrice ? Number(variant.discountPrice) : Number(variant.price);
      
      // Stock validation for variant
      if (variant.quantity < item.quantity) {
        throw new ErrorResponse(
          `Insufficient stock for ${product.name} (${item.size || ""} / ${item.color || ""}). Available: ${variant.quantity}`,
          statusCode.Bad_Request
        );
      }
      stockUpdates.push({
        type: "variant",
        id: variant.id,
        newQty: variant.quantity - item.quantity
      });
    } else {
      unitPrice = product.discountPrice ? Number(product.discountPrice) : Number(product.price);

      // Stock validation for main product
      if (product.quantity < item.quantity) {
        throw new ErrorResponse(
          `Insufficient stock for ${product.name}. Available: ${product.quantity}`,
          statusCode.Bad_Request
        );
      }
      stockUpdates.push({
        type: "product",
        id: product.id,
        newQty: product.quantity - item.quantity
      });
    }

    const itemTotalPrice = unitPrice * item.quantity;
    subtotal += itemTotalPrice;

    itemsToCreate.push({
      productId: item.productId,
      variantId: item.variantId,
      productName: product.name,
      productImage: variant?.image || product.image,
      size: item.size,
      color: item.color,
      quantity: item.quantity,
      unitPrice: unitPrice,
      totalPrice: itemTotalPrice
    });
  }

  // Calculate fees (simple logic)
  const shippingCharge = subtotal > 1500 ? 0 : 100;
  const tax = Number((subtotal * 0.05).toFixed(2)); // 5% tax
  const discount = 0; // standard 0 discount
  const totalAmount = subtotal + shippingCharge + tax - discount;

  const orderNumber = generateOrderNumber();

  // Perform checkout transaction: Create Order, create OrderItems, update stocks, clear cart
  const order = await prisma.$transaction(async (tx) => {
    // 1. Create order record
    const newOrder = await tx.order.create({
      data: {
        orderNumber,
        userId,
        addressId,
        status: "PENDING",
        paymentStatus: paymentMethod === "COD" ? "UNPAID" : "UNPAID", // Default to unpaid
        paymentMethod,
        subtotal,
        discount,
        shippingCharge,
        tax,
        totalAmount,
        shippingName,
        shippingPhone,
        shippingAddress,
        shippingCity,
        shippingState,
        shippingPincode,
        note,
        items: {
          create: itemsToCreate.map(item => ({
            productId: item.productId,
            variantId: item.variantId,
            productName: item.productName,
            productImage: item.productImage,
            size: item.size,
            color: item.color,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice
          }))
        }
      },
      include: {
        items: true
      }
    });

    // 2. Update stock quantities
    for (const update of stockUpdates) {
      if (update.type === "variant") {
        await tx.productVariant.update({
          where: { id: update.id },
          data: { quantity: update.newQty }
        });
      } else {
        await tx.product.update({
          where: { id: update.id },
          data: { quantity: update.newQty }
        });
      }
    }

    // 3. Clear user's cart
    await tx.cartItem.deleteMany({
      where: { cartId: cart.id }
    });

    return newOrder;
  });

  return SuccessResponse(res, "Order placed successfully", order, statusCode.Created);
});

// 2. Fetch all orders for the current logged-in user
export const getMyOrders = asyncHandler<AuthenticatedRequest>(async (req, res, next) => {
  const userId = req.user?.id;
  if (!userId) {
    throw new ErrorResponse("Not authorized", statusCode.Unauthorized);
  }

  const orders = await prisma.order.findMany({
    where: { userId },
    include: {
      items: true
    },
    orderBy: {
      createdAt: "desc"
    }
  });

  return SuccessResponse(res, "Orders retrieved successfully", orders, statusCode.OK);
});

// 3. Fetch details of a single order by ID
export const getOrderById = asyncHandler<AuthenticatedRequest>(async (req, res, next) => {
  const userId = req.user?.id;

  const { id } = req.params;
  if (!id) {
    throw new ErrorResponse("Order ID is required", statusCode.Bad_Request);
  }

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      items: true,
      address: true
    }
  });

  if (!order) {
    throw new ErrorResponse("Order not found", statusCode.Not_Found);
  }

  // Verify ownership only if userId is provided (meaning it went through the protect middleware)
  if (userId && order.userId !== userId) {
    throw new ErrorResponse("Not authorized to view this order", statusCode.Forbidden);
  }

  return SuccessResponse(res, "Order details retrieved successfully", order, statusCode.OK);
});

// 4. Cancel order by user
export const cancelOrder = asyncHandler<AuthenticatedRequest>(async (req, res, next) => {
  const userId = req.user?.id;
  if (!userId) {
    throw new ErrorResponse("Not authorized", statusCode.Unauthorized);
  }

  const { id } = req.params;
  if (!id) {
    throw new ErrorResponse("Order ID is required", statusCode.Bad_Request);
  }

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      items: {
        include: {
          product: true,
          variant: true
        }
      }
    }
  });

  if (!order) {
    throw new ErrorResponse("Order not found", statusCode.Not_Found);
  }

  // Verify ownership
  if (order.userId !== userId) {
    throw new ErrorResponse("Not authorized to cancel this order", statusCode.Forbidden);
  }

  // Only allow cancellation in PENDING or CONFIRMED state
  if (order.status !== "PENDING" && order.status !== "CONFIRMED") {
    throw new ErrorResponse(
      `Cannot cancel order because it is already ${order.status.toLowerCase()}`,
      statusCode.Bad_Request
    );
  }

  // Process cancellation transaction: Update order status, restore stock
  const updatedOrder = await prisma.$transaction(async (tx) => {
    // 1. Update order status
    const cancelledOrder = await tx.order.update({
      where: { id },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date()
      }
    });

    // 2. Restore stock quantities
    for (const item of order.items) {
      if (item.variantId && item.variant) {
        await tx.productVariant.update({
          where: { id: item.variantId },
          data: {
            quantity: item.variant.quantity + item.quantity
          }
        });
      } else if (item.product) {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            quantity: item.product.quantity + item.quantity
          }
        });
      }
    }

    return cancelledOrder;
  });

  return SuccessResponse(res, "Order cancelled successfully", updatedOrder, statusCode.OK);
});

// 5. Update order status (Admin/Vendor function)
export const updateOrderStatus = asyncHandler<AuthenticatedRequest>(async (req, res, next) => {
  const { id } = req.params;
  if (!id) {
    throw new ErrorResponse("Order ID is required", statusCode.Bad_Request);
  }

  const validData = updateOrderStatusSchema.parse(req.body);
  const { status } = validData;

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      items: {
        include: {
          product: true,
          variant: true
        }
      }
    }
  });

  if (!order) {
    throw new ErrorResponse("Order not found", statusCode.Not_Found);
  }

  // If status is the same, no-op
  if (order.status === status) {
    return SuccessResponse(res, "Order status updated successfully", order, statusCode.OK);
  }

  const statusUpdateData: any = { status };

  // Set timestamps based on status transitions
  if (status === "SHIPPED") {
    statusUpdateData.shippedAt = new Date();
  } else if (status === "DELIVERED") {
    statusUpdateData.deliveredAt = new Date();
    // Auto mark as paid if it's delivered (e.g. cash on delivery payment completed)
    if (order.paymentMethod === "COD") {
      statusUpdateData.paymentStatus = "PAID";
    }
  } else if (status === "CANCELLED") {
    statusUpdateData.cancelledAt = new Date();
  }

  // Handle transaction if transition is to CANCELLED (must restore stock)
  let updatedOrder;
  if (status === "CANCELLED" && order.status !== "CANCELLED") {
    updatedOrder = await prisma.$transaction(async (tx) => {
      // 1. Update order
      const resOrder = await tx.order.update({
        where: { id },
        data: statusUpdateData
      });

      // 2. Restore stocks
      for (const item of order.items) {
        if (item.variantId && item.variant) {
          await tx.productVariant.update({
            where: { id: item.variantId },
            data: {
              quantity: item.variant.quantity + item.quantity
            }
          });
        } else if (item.product) {
          await tx.product.update({
            where: { id: item.productId },
            data: {
              quantity: item.product.quantity + item.quantity
            }
          });
        }
      }

      return resOrder;
    });
  } else {
    // Standard update
    updatedOrder = await prisma.order.update({
      where: { id },
      data: statusUpdateData
    });
  }

  return SuccessResponse(res, "Order status updated successfully", updatedOrder, statusCode.OK);
});

// 6. Update payment status (Admin/Vendor function)
export const updatePaymentStatus = asyncHandler<AuthenticatedRequest>(async (req, res, next) => {
  const { id } = req.params;
  if (!id) {
    throw new ErrorResponse("Order ID is required", statusCode.Bad_Request);
  }

  const validData = updatePaymentStatusSchema.parse(req.body);
  const { paymentStatus } = validData;

  const order = await prisma.order.findUnique({
    where: { id }
  });

  if (!order) {
    throw new ErrorResponse("Order not found", statusCode.Not_Found);
  }

  const updatedOrder = await prisma.order.update({
    where: { id },
    data: { paymentStatus }
  });

  return SuccessResponse(res, "Payment status updated successfully", updatedOrder, statusCode.OK);
});

// 7. Get all orders (Admin/Vendor function)
export const getAllOrders = asyncHandler<AuthenticatedRequest>(async (req, res, next) => {
  const orders = await prisma.order.findMany({
    include: {
      items: true
    },
    orderBy: {
      createdAt: "desc"
    }
  });

  return SuccessResponse(res, "All orders retrieved successfully", orders, statusCode.OK);
});
