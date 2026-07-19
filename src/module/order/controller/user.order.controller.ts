import prisma from "../../../config/prisma.js";
import { asyncHandler } from "../../../middleware/error.middleware.js";
import { ErrorResponse, SuccessResponse } from "../../../utils/response.utils.js";
import { statusCode } from "../../../types/types.js";
import { createOrderSchema, verifyPaymentSchema } from "../validation/order.validation.js";
import type { AuthenticatedRequest } from "../../../middleware/auth.middleware.js";
import { createRazorpayOrder, verifyRazorpaySignature } from "../services/razorpay.service.js";
import { createCashfreeOrder, getCashfreeOrder } from "../services/cashfree.service.js";

// Helper to generate unique order number
const generateOrderNumber = (): string => {
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.floor(1000 + Math.random() * 9000).toString();
  return `ORD-${timestamp}-${random}`;
};

/**
 * 1. Create a new user order (Checkout from Cart)
 * Supports Cash on Delivery (COD) and Razorpay
 */
export const createUserOrder = asyncHandler<AuthenticatedRequest>(async (req, res, next) => {
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
  const stockUpdates: Array<{ type: "product" | "variant"; id: string; originalQty: number; newQty: number }> = [];

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
        originalQty: variant.quantity,
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
        originalQty: product.quantity,
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

  // Calculate fees (simple logic matching order.controller.ts)
  const shippingCharge = subtotal > 1500 ? 0 : 100;
  const tax = Number((subtotal * 0.05).toFixed(2)); // 5% tax
  const discount = 0; // standard 0 discount
  const totalAmount = subtotal + shippingCharge + tax - discount;

  const orderNumber = generateOrderNumber();

  // Create order, update stock, and clear cart inside database transaction
  const order = await prisma.$transaction(async (tx) => {
    // 1. Create order record (initially PENDING / UNPAID)
    const newOrder = await tx.order.create({
      data: {
        orderNumber,
        userId,
        addressId,
        status: "PENDING",
        paymentStatus: "UNPAID",
        paymentMethod: paymentMethod === "CASHFREE" ? "CASHFREE" : paymentMethod === "RAZORPAY" ? "RAZORPAY" : "COD",
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

    // Update User's firstName and lastName if they are not set yet
    const userObj = await tx.user.findUnique({
      where: { id: userId }
    });
    if (userObj && (!userObj.firstName || !userObj.firstName.trim())) {
      const nameParts = shippingName.trim().split(/\s+/);
      const fName = nameParts[0] || "";
      const lName = nameParts.slice(1).join(" ") || "";
      await tx.user.update({
        where: { id: userId },
        data: {
          firstName: fName,
          lastName: lName
        }
      });
    }

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

    // 3. Clear user's cart items
    await tx.cartItem.deleteMany({
      where: { cartId: cart.id }
    });

    return newOrder;
  });

  // Razorpay integration handling
  if (paymentMethod === "RAZORPAY") {
    try {
      const razorpayOrder = await createRazorpayOrder(totalAmount, orderNumber);
      
      // Update database order with Razorpay order ID link
      const updatedOrder = await prisma.order.update({
        where: { id: order.id },
        data: { razorpayOrderId: razorpayOrder.id },
        include: { items: true }
      });

      return SuccessResponse(
        res,
        "Order initiated. Please complete Razorpay payment.",
        {
          order: updatedOrder,
          razorpayOrder: {
            id: razorpayOrder.id,
            amount: razorpayOrder.amount,
            currency: razorpayOrder.currency,
            key: process.env.RAZORPAY_KEY_ID
          }
        },
        statusCode.Created
      );
    } catch (error) {
      console.error("Razorpay Order initiation failed:", error);
      
      const errorMessage = 
        (error as any).error?.description ||
        (error as any).description ||
        (error as any).message ||
        (typeof error === 'object' ? JSON.stringify(error) : String(error));

      // If Razorpay API call fails, roll back database order and restore stocks to avoid locking inventory
      await prisma.$transaction(async (tx) => {
        // Delete or cancel the order
        await tx.order.update({
          where: { id: order.id },
          data: {
            status: "CANCELLED",
            paymentStatus: "FAILED",
            cancelledAt: new Date(),
            note: `Auto-cancelled: Razorpay initiation failed: ${errorMessage}`
          }
        });

        // Restore stocks
        for (const update of stockUpdates) {
          if (update.type === "variant") {
            await tx.productVariant.update({
              where: { id: update.id },
              data: { quantity: update.originalQty }
            });
          } else {
            await tx.product.update({
              where: { id: update.id },
              data: { quantity: update.originalQty }
            });
          }
        }
      });

      throw new ErrorResponse(
        `Failed to initiate payment gateway order: ${errorMessage}`,
        statusCode.Internal_Server_Error
      );
    }
  }

  // Cashfree integration handling
  if (paymentMethod === "CASHFREE") {
    try {
      const customerUser = await prisma.user.findUnique({
        where: { id: userId }
      });

      const cashfreeOrder = await createCashfreeOrder({
        orderId: orderNumber,
        amount: totalAmount,
        customer: {
          id: userId,
          name: shippingName,
          email: customerUser?.email || "customer@example.com",
          phone: shippingPhone
        }
      });

      // Update database order with Cashfree order ID link
      const updatedOrder = await prisma.order.update({
        where: { id: order.id },
        data: { cashfreeOrderId: cashfreeOrder.cf_order_id },
        include: { items: true }
      });

      return SuccessResponse(
        res,
        "Order initiated. Please complete Cashfree payment.",
        {
          order: updatedOrder,
          cashfreeOrder: {
            paymentSessionId: cashfreeOrder.payment_session_id,
            cfOrderId: cashfreeOrder.cf_order_id,
            orderId: cashfreeOrder.order_id,
            orderAmount: cashfreeOrder.order_amount,
            orderCurrency: cashfreeOrder.order_currency,
            sandbox: process.env.CASHFREE_ENV !== "PRODUCTION"
          }
        },
        statusCode.Created
      );
    } catch (error) {
      console.error("Cashfree Order initiation failed:", error);
      const errorMessage = (error as any).message || String(error);

      // Rollback database order and restore stocks
      await prisma.$transaction(async (tx) => {
        await tx.order.update({
          where: { id: order.id },
          data: {
            status: "CANCELLED",
            paymentStatus: "FAILED",
            cancelledAt: new Date(),
            note: `Auto-cancelled: Cashfree initiation failed: ${errorMessage}`
          }
        });

        for (const update of stockUpdates) {
          if (update.type === "variant") {
            await tx.productVariant.update({
              where: { id: update.id },
              data: { quantity: update.originalQty }
            });
          } else {
            await tx.product.update({
              where: { id: update.id },
              data: { quantity: update.originalQty }
            });
          }
        }
      });

      throw new ErrorResponse(
        `Failed to initiate payment gateway order: ${errorMessage}`,
        statusCode.Internal_Server_Error
      );
    }
  }

  // Cash on Delivery (COD) Success Response
  return SuccessResponse(res, "Order placed successfully (Cash on Delivery)", order, statusCode.Created);
});

/**
 * 2. Verify Razorpay Payment Signature
 * Confirms order and sets status to paid upon signature verification success
 */
export const verifyPayment = asyncHandler<AuthenticatedRequest>(async (req, res, next) => {
  const userId = req.user?.id;
  if (!userId) {
    throw new ErrorResponse("Not authorized", statusCode.Unauthorized);
  }

  const validData = verifyPaymentSchema.parse(req.body);
  const { orderId, razorpayOrderId, razorpayPaymentId, razorpaySignature, cashfreeOrderId } = validData;

  let order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true }
  });

  if (!order) {
    throw new ErrorResponse("Order not found", statusCode.Not_Found);
  }

  if (order.userId !== userId) {
    throw new ErrorResponse("Not authorized to verify this payment", statusCode.Forbidden);
  }

  // Cashfree Verification
  if (order.paymentMethod === "CASHFREE" || cashfreeOrderId) {
    try {
      const cfOrder = await getCashfreeOrder(order.orderNumber);
      if (!cfOrder || cfOrder.order_status !== "PAID") {
        await prisma.order.update({
          where: { id: orderId },
          data: {
            paymentStatus: "FAILED"
          }
        });
        throw new ErrorResponse("Cashfree payment verification failed: Order is unpaid", statusCode.Bad_Request);
      }

      const confirmedOrder = await prisma.order.update({
        where: { id: orderId },
        data: {
          status: "CONFIRMED",
          paymentStatus: "PAID",
          cashfreeOrderId: cfOrder.cf_order_id
        },
        include: {
          items: true
        }
      });

      return SuccessResponse(res, "Payment verified and order confirmed successfully", confirmedOrder, statusCode.OK);
    } catch (err: any) {
      console.error("Cashfree verification error:", err);
      throw new ErrorResponse(err.message || "Payment verification failed", statusCode.Bad_Request);
    }
  }

  // Razorpay Verification (Fallback / Legacy)
  if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
    throw new ErrorResponse("Razorpay payment details are required", statusCode.Bad_Request);
  }

  const isSignatureValid = verifyRazorpaySignature(razorpayOrderId, razorpayPaymentId, razorpaySignature);

  if (!isSignatureValid) {
    await prisma.order.update({
      where: { id: orderId },
      data: {
        paymentStatus: "FAILED",
        razorpayOrderId,
        razorpayPaymentId
      }
    });

    throw new ErrorResponse("Payment signature verification failed", statusCode.Bad_Request);
  }

  // Signature is valid. Confirm order payment.
  const confirmedOrder = await prisma.order.update({
    where: { id: orderId },
    data: {
      status: "CONFIRMED",
      paymentStatus: "PAID",
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature
    },
    include: {
      items: true
    }
  });

  return SuccessResponse(res, "Payment verified and order confirmed successfully", confirmedOrder, statusCode.OK);
});

/**
 * 3. Fetch all orders for the current logged-in user
 */
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

/**
 * 4. Fetch details of a single user order by ID
 */
export const getUserOrderById = asyncHandler<AuthenticatedRequest>(async (req, res, next) => {
  const userId = req.user?.id;
  if (!userId) {
    throw new ErrorResponse("Not authorized", statusCode.Unauthorized);
  }

  const { id } = req.params;
  if (!id) {
    throw new ErrorResponse("Order ID is required", statusCode.Bad_Request);
  }

  let order = await prisma.order.findUnique({
    where: { id },
    include: {
      items: true,
      address: true
    }
  });

  if (!order) {
    throw new ErrorResponse("Order not found", statusCode.Not_Found);
  }

  if (order.userId !== userId) {
    throw new ErrorResponse("Not authorized to view this order", statusCode.Forbidden);
  }

  // Auto-verify Cashfree order if UNPAID
  if (order.paymentMethod === "CASHFREE" && order.paymentStatus === "UNPAID") {
    try {
      const cfOrder = await getCashfreeOrder(order.orderNumber);
      if (cfOrder && cfOrder.order_status === "PAID") {
        order = await prisma.order.update({
          where: { id },
          data: {
            status: "CONFIRMED",
            paymentStatus: "PAID",
            cashfreeOrderId: cfOrder.cf_order_id
          },
          include: {
            items: true,
            address: true
          }
        });
      } else if (cfOrder && cfOrder.order_status === "FAILED") {
        order = await prisma.order.update({
          where: { id },
          data: {
            paymentStatus: "FAILED"
          },
          include: {
            items: true,
            address: true
          }
        });
      }
    } catch (err) {
      console.error("Auto-verification of Cashfree order failed in details fetch:", err);
    }
  }

  return SuccessResponse(res, "Order details retrieved successfully", order, statusCode.OK);
});

/**
 * 5. Cancel order by user (only if PENDING or CONFIRMED)
 */
export const cancelUserOrder = asyncHandler<AuthenticatedRequest>(async (req, res, next) => {
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

  // Cancel order & restore stock quantities
  const cancelledOrder = await prisma.$transaction(async (tx) => {
    // Update order status
    const updatedOrder = await tx.order.update({
      where: { id },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date()
      }
    });

    // Restore stock quantities
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

    return updatedOrder;
  });

  return SuccessResponse(res, "Order cancelled successfully", cancelledOrder, statusCode.OK);
});
