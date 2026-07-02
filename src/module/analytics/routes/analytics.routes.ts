import express from "express";
import { 
  getAnalyticsOverview, 
  getPerformanceChart, 
  getProductAnalytics, 
  trackEvent 
} from "../controller/analytics.controller.js";
import { protect, optionalProtect } from "../../../middleware/auth.middleware.js";

const router = express.Router();

// Analytics overview (KPI cards + rating breakdown)
router.get("/overview", optionalProtect, getAnalyticsOverview);

// Time-series performance chart (Orders vs Returns)
router.get("/performance", optionalProtect, getPerformanceChart);

// Product leaderboard / metrics table
router.get("/products", optionalProtect, getProductAnalytics);

// Event telemetry tracking (Unprotected so we can track customer events from frontend checkout/product page)
router.post("/track", trackEvent);

export default router;
