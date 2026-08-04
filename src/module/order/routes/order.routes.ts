import express from "express";
import { 
  updateOrderStatus, 
  updatePaymentStatus,
  getAllOrders,
  getOrderById,
  updateOrderAddress
} from "../controller/order.controller.js";
import {
  createUserOrder,
  verifyPayment,
  getMyOrders,
  getUserOrderById,
  cancelUserOrder,
  returnUserOrder
} from "../controller/user.order.controller.js";
import { protect } from "../../../middleware/auth.middleware.js";

const router = express.Router();

// User facing checkout/my-orders routes require authentication
router.post("/checkout", protect, createUserOrder);
router.post("/verify-payment", protect, verifyPayment);
router.get("/my-orders", protect, getMyOrders);
router.get("/my-orders/:id", protect, getUserOrderById);
router.put("/:id/cancel", protect, cancelUserOrder);
router.put("/:id/address", protect, updateOrderAddress);
router.put("/:id/return", protect, returnUserOrder);

// Vendor/Admin management routes (currently open for dashboard integration)
router.get("/", getAllOrders);
router.get("/:id", getOrderById);
router.put("/:id/status", updateOrderStatus);
router.put("/:id/payment", updatePaymentStatus);
router.put("/admin/:id/address", updateOrderAddress);
router.put("/admin/:id/return", returnUserOrder);



export default router;

