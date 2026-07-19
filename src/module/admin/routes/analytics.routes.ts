import express from "express";
import { 
  getAnalyticsOverview, 
  getPerformanceChart, 
  getProductAnalytics 
} from "../controller/analytics.controller.js";
import { optionalProtect } from "../../../middleware/auth.middleware.js";

const router = express.Router();

router.get("/analytics/overview", optionalProtect, getAnalyticsOverview);
router.get("/analytics/performance", optionalProtect, getPerformanceChart);
router.get("/analytics/products", optionalProtect, getProductAnalytics);

export default router;
