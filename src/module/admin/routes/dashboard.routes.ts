import express from "express";
import {
  getDashboardStats,
  getDashboardCharts,
  getDashboardRecentOrders,
  getDashboardAlerts
} from "../controller/dashboard.controller.js";
import { optionalProtect } from "../../../middleware/auth.middleware.js";

const router = express.Router();

router.get("/stats", optionalProtect, getDashboardStats);
router.get("/charts", optionalProtect, getDashboardCharts);
router.get("/recent-orders", optionalProtect, getDashboardRecentOrders);
router.get("/alerts", optionalProtect, getDashboardAlerts);

export default router;
