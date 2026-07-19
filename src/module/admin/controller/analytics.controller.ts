import prisma from "../../../config/prisma.js";
import { asyncHandler } from "../../../middleware/error.middleware.js";
import { SuccessResponse } from "../../../utils/response.utils.js";
import { getAnalyticsQuerySchema } from "../validation/analytics.validation.js";

const getDateRange = (range: string) => {
  const now = new Date();
  let currentStart = new Date();
  let previousStart = new Date();
  
  if (range === "7d") {
    currentStart.setDate(now.getDate() - 7);
    previousStart.setDate(now.getDate() - 14);
  } else if (range === "30d") {
    currentStart.setDate(now.getDate() - 30);
    previousStart.setDate(now.getDate() - 60);
  } else if (range === "12m") {
    currentStart.setMonth(now.getMonth() - 12);
    previousStart.setMonth(now.getMonth() - 24);
  } else {
    // default/all: Unix epoch
    currentStart = new Date(0);
    previousStart = new Date(0);
  }
  
  return {
    currentStart,
    currentEnd: now,
    previousStart,
    previousEnd: currentStart,
  };
};

export const getAnalyticsOverview = asyncHandler(async (req, res, next) => {
  try {
    const { range, startDate, endDate } = getAnalyticsQuerySchema.parse(req.query);

    let currentStart: Date;
    let currentEnd: Date;
    let previousStart: Date;
    let previousEnd: Date;

    if (startDate || endDate) {
      currentStart = startDate ? new Date(startDate) : new Date(0);
      currentEnd = endDate ? new Date(endDate) : new Date();
      const durationMs = currentEnd.getTime() - currentStart.getTime();
      previousStart = new Date(currentStart.getTime() - durationMs);
      previousEnd = currentStart;
    } else {
      const dates = getDateRange(range || "30d");
      currentStart = dates.currentStart;
      currentEnd = dates.currentEnd;
      previousStart = dates.previousStart;
      previousEnd = dates.previousEnd;
    }

    // --- Query Current Period ---
    const ordersCurrent = await prisma.order.findMany({
      where: { createdAt: { gte: currentStart, lte: currentEnd } },
      select: { status: true, totalAmount: true, shippingCharge: true, tax: true }
    });

    const reviewsCurrent = await prisma.product.aggregate({
      _avg: { rating: true },
      _sum: { numReviews: true }
    });

    // --- Query Previous Period ---
    const ordersPrevious = await prisma.order.findMany({
      where: { createdAt: { gte: previousStart, lte: previousEnd } },
      select: { status: true, totalAmount: true }
    });

    const reviewsPrevious = await prisma.product.aggregate({
      _avg: { rating: true },
      _sum: { numReviews: true }
    });

    // --- Calculate Metrics ---
    const paidOrdersCurrent = await prisma.order.findMany({
      where: {
        paymentStatus: 'PAID',
        createdAt: { gte: currentStart, lte: currentEnd }
      },
      select: { totalAmount: true }
    });
    const paidOrdersPrevious = await prisma.order.findMany({
      where: {
        paymentStatus: 'PAID',
        createdAt: { gte: previousStart, lte: previousEnd }
      },
      select: { totalAmount: true }
    });

    const salesCurrent = paidOrdersCurrent.reduce((sum, o) => sum + Number(o.totalAmount), 0);
    const salesPrevious = paidOrdersPrevious.reduce((sum, o) => sum + Number(o.totalAmount), 0);

    const ordersCountCurrent = ordersCurrent.length;
    const ordersCountPrevious = ordersPrevious.length;

    const cancelledCurrent = ordersCurrent.filter(o => o.status === 'CANCELLED').length;
    const cancelledPrevious = ordersPrevious.filter(o => o.status === 'CANCELLED').length;

    const returnedCurrent = ordersCurrent.filter(o => o.status === 'RETURNED').length;
    const returnedPrevious = ordersPrevious.filter(o => o.status === 'RETURNED').length;

    const deliveredOrders = await prisma.order.findMany({
      where: {
        status: 'DELIVERED',
        createdAt: { gte: currentStart, lte: currentEnd }
      },
      select: { shippedAt: true, deliveredAt: true }
    });
    let onTimeCount = 0;
    let lateCount = 0;
    deliveredOrders.forEach(o => {
      if (o.shippedAt && o.deliveredAt) {
        const diffDays = (o.deliveredAt.getTime() - o.shippedAt.getTime()) / (1000 * 60 * 60 * 24);
        if (diffDays <= 3) onTimeCount++;
        else lateCount++;
      } else {
        onTimeCount++;
      }
    });

    const totalDelivered = deliveredOrders.length;
    const onTimeDeliveryRateCurrent = totalDelivered > 0 ? (onTimeCount / totalDelivered) * 100 : 0;
    const onTimeDeliveryRatePrevious = 0;

    const cancelRateCurrent = ordersCountCurrent > 0 ? (cancelledCurrent / ordersCountCurrent) * 100 : 0;
    const cancelRatePrevious = ordersCountPrevious > 0 ? (cancelledPrevious / ordersCountPrevious) * 100 : 0;

    const responseTimeCurrent = 0;
    const responseTimePrevious = 0;

    const ratingCurrent = reviewsCurrent._avg.rating || 0;
    const ratingPrevious = reviewsPrevious._avg.rating || 0;
    const reviewsCountCurrent = Number(reviewsCurrent._sum.numReviews) || 0;

    const getTrend = (cur: number, prev: number) => {
      if (prev === 0) return cur > 0 ? 100 : 0;
      return Number((((cur - prev) / prev) * 100).toFixed(1));
    };

    const overview = {
      sales: {
        value: salesCurrent,
        trend: getTrend(salesCurrent, salesPrevious),
        description: `Total revenue in current period`
      },
      orders: {
        value: ordersCountCurrent,
        trend: getTrend(ordersCountCurrent, ordersCountPrevious),
        description: `Total orders placed`
      },
      rating: {
        value: Number(ratingCurrent.toFixed(1)),
        trend: getTrend(ratingCurrent, ratingPrevious),
        description: `Based on ${reviewsCountCurrent} reviews`
      },
      delivery: {
        value: `${onTimeDeliveryRateCurrent.toFixed(1)}%`,
        trend: getTrend(onTimeDeliveryRateCurrent, onTimeDeliveryRatePrevious),
        description: `Target: 95%`
      },
      cancellation: {
        value: `${cancelRateCurrent.toFixed(1)}%`,
        trend: -getTrend(cancelRateCurrent, cancelRatePrevious),
        description: `Target: < 2%`
      },
      responseTime: {
        value: `${responseTimeCurrent}h`,
        trend: -getTrend(responseTimeCurrent, responseTimePrevious),
        description: `Target: < 4h`
      }
    };

    const ratingProducts = await prisma.product.findMany({
      select: { rating: true }
    });
    const breakdown: [
      { stars: number; count: number; percentage: number },
      { stars: number; count: number; percentage: number },
      { stars: number; count: number; percentage: number },
      { stars: number; count: number; percentage: number },
      { stars: number; count: number; percentage: number }
    ] = [
      { stars: 5, count: 0, percentage: 0 },
      { stars: 4, count: 0, percentage: 0 },
      { stars: 3, count: 0, percentage: 0 },
      { stars: 2, count: 0, percentage: 0 },
      { stars: 1, count: 0, percentage: 0 },
    ];
    let totalRatingsCount = 0;
    ratingProducts.forEach(p => {
      const r = Math.round(p.rating);
      if (r >= 1 && r <= 5) {
        const item = breakdown[5 - r];
        if (item) {
          item.count++;
          totalRatingsCount++;
        }
      }
    });

    breakdown.forEach(item => {
      item.percentage = totalRatingsCount > 0 ? Math.round((item.count / totalRatingsCount) * 100) : 0;
    });

    return SuccessResponse(res, "Admin Analytics overview fetched successfully", {
      metrics: overview,
      ratingBreakdown: breakdown,
      totalReviews: totalRatingsCount,
    });
  } catch (err) {
    next(err);
  }
});

export const getPerformanceChart = asyncHandler(async (req, res, next) => {
  try {
    const { range, startDate, endDate } = getAnalyticsQuerySchema.parse(req.query);

    let currentStart: Date;
    let currentEnd: Date;

    if (startDate || endDate) {
      currentStart = startDate ? new Date(startDate) : new Date(0);
      currentEnd = endDate ? new Date(endDate) : new Date();
    } else {
      const dates = getDateRange(range || "30d");
      currentStart = dates.currentStart;
      currentEnd = dates.currentEnd;
    }

    const orders = await prisma.order.findMany({
      where: { createdAt: { gte: currentStart, lte: currentEnd } },
      select: { createdAt: true, status: true }
    });

    const getGroupKey = (date: Date, type: string) => {
      if (type === "12m") {
        return date.toLocaleString('default', { month: 'short' });
      } else {
        return date.toLocaleString('default', { month: 'short', day: 'numeric' });
      }
    };

    const aggregated: Record<string, { month: string; orders: number; returns: number }> = {};

    const now = new Date();
    if (range === "7d") {
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(now.getDate() - i);
        const k = getGroupKey(d, "7d");
        aggregated[k] = { month: k, orders: 0, returns: 0 };
      }
    } else if (range === "30d") {
      for (let i = 29; i >= 0; i -= 2) {
        const d = new Date();
        d.setDate(now.getDate() - i);
        const k = getGroupKey(d, "30d");
        aggregated[k] = { month: k, orders: 0, returns: 0 };
      }
    } else if (range === "12m") {
      for (let i = 11; i >= 0; i--) {
        const d = new Date();
        d.setMonth(now.getMonth() - i);
        const k = getGroupKey(d, "12m");
        aggregated[k] = { month: k, orders: 0, returns: 0 };
      }
    }

    orders.forEach(o => {
      const key = getGroupKey(o.createdAt, range || "30d");
      let targetKey = key;
      if (!aggregated[targetKey]) {
        const keys = Object.keys(aggregated);
        const firstKey = keys[0];
        if (firstKey) {
          targetKey = firstKey;
        }
      }
      
      const existing = aggregated[targetKey];
      if (existing) {
        existing.orders++;
        if (o.status === "RETURNED") {
          existing.returns++;
        }
      } else {
        aggregated[key] = {
          month: key,
          orders: 1,
          returns: o.status === "RETURNED" ? 1 : 0
        };
      }
    });

    const chartData = Object.values(aggregated);

    return SuccessResponse(res, "Admin Analytics chart data fetched successfully", chartData);
  } catch (err) {
    next(err);
  }
});

export const getProductAnalytics = asyncHandler(async (req, res, next) => {
  try {
    const limit = Number(req.query.limit) || 10;
    const sortBy = String(req.query.sortBy) || "viewsCount";

    const products = await prisma.product.findMany({
      include: {
        analytics: true
      }
    });

    const results = products.map(p => {
      return {
        id: p.id,
        name: p.name,
        image: p.image,
        price: p.price,
        views: p.analytics?.viewsCount || 0,
        addToCarts: p.analytics?.addToCartCount || 0,
        purchases: p.analytics?.purchaseCount || 0,
        revenue: p.analytics?.revenue || 0,
      };
    });

    results.sort((a: any, b: any) => {
      const field = sortBy === "purchases" ? "purchases" : sortBy === "revenue" ? "revenue" : sortBy === "addToCarts" ? "addToCarts" : "views";
      return b[field] - a[field];
    });

    return SuccessResponse(res, "Admin Product analytics fetched successfully", results.slice(0, limit));
  } catch (err) {
    next(err);
  }
});
