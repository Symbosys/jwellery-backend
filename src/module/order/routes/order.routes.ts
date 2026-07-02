import express from "express";
import { 
  createOrder, 
  getMyOrders, 
  getOrderById, 
  cancelOrder, 
  updateOrderStatus, 
  updatePaymentStatus,
  getAllOrders
} from "../controller/order.controller.js";
import { protect } from "../../../middleware/auth.middleware.js";

const router = express.Router();

// User facing checkout/my-orders routes require authentication
router.post("/checkout", protect, createOrder);
router.get("/my-orders", protect, getMyOrders);
router.put("/:id/cancel", protect, cancelOrder);

// Vendor/Admin management routes (currently open for dashboard integration)
router.get("/", getAllOrders);
router.get("/:id", getOrderById);
router.put("/:id/status", updateOrderStatus);
router.put("/:id/payment", updatePaymentStatus);

export default router;
