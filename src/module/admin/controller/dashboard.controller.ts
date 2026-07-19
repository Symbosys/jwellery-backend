import prisma from "../../../config/prisma.js";
import { asyncHandler } from "../../../middleware/error.middleware.js";
import { SuccessResponse } from "../../../utils/response.utils.js";

// Helper to calculate trend change percentage
const calcTrend = (cur: number, prev: number) => {
  if (prev === 0) return cur > 0 ? 100 : 0;
  return Number((((cur - prev) / prev) * 100).toFixed(1));
};

// 1. GET /api/admin/dashboard/stats
export const getDashboardStats = asyncHandler(async (req, res, next) => {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(now.getDate() - 30);
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(now.getDate() - 60);

    const [
      totalOrders,
      pendingOrders,
      completedOrders,
      cancelledOrders,
      returnOrders,
      totalSalesRaw,
      totalProducts,
      lowStockProducts,
      // Previous 30d for trend
      prevTotalOrders,
      prevPaidSalesRaw,
      prevPendingOrders,
      prevCompletedOrders,
      prevCancelledOrders,
    ] = await Promise.all([
      // Current 30 days
      prisma.order.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      prisma.order.count({ where: { status: 'PENDING', createdAt: { gte: thirtyDaysAgo } } }),
      prisma.order.count({ where: { status: 'DELIVERED', createdAt: { gte: thirtyDaysAgo } } }),
      prisma.order.count({ where: { status: 'CANCELLED', createdAt: { gte: thirtyDaysAgo } } }),
      prisma.order.count({ where: { status: 'RETURNED', createdAt: { gte: thirtyDaysAgo } } }),
      prisma.order.aggregate({
        _sum: { totalAmount: true },
        where: { paymentStatus: 'PAID', createdAt: { gte: thirtyDaysAgo } },
      }),
      prisma.product.count(),
      prisma.product.count({ where: { quantity: { lte: 5 } } }),
      // Previous 30 days (day -60 to -30)
      prisma.order.count({ where: { createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } } }),
      prisma.order.aggregate({
        _sum: { totalAmount: true },
        where: { paymentStatus: 'PAID', createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } },
      }),
      prisma.order.count({ where: { status: 'PENDING', createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } } }),
      prisma.order.count({ where: { status: 'DELIVERED', createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } } }),
      prisma.order.count({ where: { status: 'CANCELLED', createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } } }),
    ]);

    const totalSales = Number(totalSalesRaw._sum.totalAmount ?? 0);
    const prevTotalSales = Number(prevPaidSalesRaw._sum.totalAmount ?? 0);

    const stats = {
      totalOrders: {
        value: totalOrders,
        change: calcTrend(totalOrders, prevTotalOrders),
      },
      totalSales: {
        value: totalSales,
        change: calcTrend(totalSales, prevTotalSales),
      },
      pendingOrders: {
        value: pendingOrders,
        change: calcTrend(pendingOrders, prevPendingOrders),
      },
      completedOrders: {
        value: completedOrders,
        change: calcTrend(completedOrders, prevCompletedOrders),
      },
      cancelledOrders: {
        value: cancelledOrders,
        change: calcTrend(cancelledOrders, prevCancelledOrders),
      },
      totalProducts: {
        value: totalProducts,
        change: 0,
      },
      lowStockItems: {
        value: lowStockProducts,
        change: 0,
      },
      returnRequests: {
        value: returnOrders,
        change: 0,
      },
    };

    return SuccessResponse(res, "Dashboard stats fetched successfully", stats);
  } catch (err) {
    next(err);
  }
});

// 2. GET /api/admin/dashboard/charts
export const getDashboardCharts = asyncHandler(async (req, res, next) => {
  try {
    const now = new Date();
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    
    // Fetch last 6 months of paid orders for sales overview area chart
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(now.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    const orders = await prisma.order.findMany({
      where: {
        createdAt: { gte: sixMonthsAgo },
      },
      select: {
        totalAmount: true,
        status: true,
        paymentStatus: true,
        createdAt: true,
      },
    });

    const salesData: { name: string; sales: number; orders: number }[] = [];

    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(now.getMonth() - i);
      const m = d.getMonth();
      const y = d.getFullYear();
      const monthLabel = months[m] || "";

      const monthlyOrders = orders.filter((o) => {
        const oDate = new Date(o.createdAt);
        return oDate.getFullYear() === y && oDate.getMonth() === m;
      });

      const monthlySales = monthlyOrders
        .filter((o) => o.paymentStatus === "PAID")
        .reduce((sum, o) => sum + Number(o.totalAmount), 0);

      salesData.push({
        name: monthLabel,
        sales: monthlySales,
        orders: monthlyOrders.length,
      });
    }

    // Pie chart status breakdown (all-time counts of Completed, Pending, Processing, Cancelled)
    const [completed, pending, processing, cancelled] = await Promise.all([
      prisma.order.count({ where: { status: "DELIVERED" } }),
      prisma.order.count({ where: { status: "PENDING" } }),
      prisma.order.count({ where: { status: "PROCESSING" } }),
      prisma.order.count({ where: { status: "CANCELLED" } }),
    ]);

    const breakdownData = [
      { name: "Completed", value: completed, color: "hsl(142, 76%, 36%)" },
      { name: "Pending", value: pending, color: "hsl(38, 92%, 50%)" },
      { name: "Processing", value: processing, color: "hsl(199, 89%, 48%)" },
      { name: "Cancelled", value: cancelled, color: "hsl(0, 84%, 60%)" },
    ];

    return SuccessResponse(res, "Dashboard charts data fetched successfully", {
      salesOverview: salesData,
      ordersBreakdown: breakdownData,
    });
  } catch (err) {
    next(err);
  }
});

// 3. GET /api/admin/dashboard/recent-orders
export const getDashboardRecentOrders = asyncHandler(async (req, res, next) => {
  try {
    const limit = Number(req.query.limit) || 5;

    const orders = await prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
        items: {
          include: {
            product: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    const recentOrders = orders.map((o) => {
      // Map names or items nicely
      const customerName = o.user 
        ? `${o.user.firstName || ''} ${o.user.lastName || ''}`.trim() 
        : o.shippingName || "Guest User";
      
      const mainProduct = o.items[0]?.product?.name || "Product Item";
      
      // Calculate minutes or hours relative time helper
      const diffMs = Date.now() - new Date(o.createdAt).getTime();
      const diffMins = Math.max(1, Math.floor(diffMs / 60000));
      let relativeTime = `${diffMins} min ago`;
      if (diffMins >= 60) {
        const diffHours = Math.floor(diffMins / 60);
        relativeTime = diffHours === 1 ? "1 hour ago" : `${diffHours} hours ago`;
        if (diffHours >= 24) {
          const diffDays = Math.floor(diffHours / 24);
          relativeTime = diffDays === 1 ? "1 day ago" : `${diffDays} days ago`;
        }
      }

      return {
        id: `ORD-${o.orderNumber || o.id.slice(-4).toUpperCase()}`,
        customer: customerName,
        product: mainProduct,
        amount: `₹${Number(o.totalAmount).toLocaleString()}`,
        status: o.status.toLowerCase(),
        date: relativeTime,
      };
    });

    return SuccessResponse(res, "Recent orders fetched successfully", recentOrders);
  } catch (err) {
    next(err);
  }
});

// 4. GET /api/admin/dashboard/alerts
export const getDashboardAlerts = asyncHandler(async (req, res, next) => {
  try {
    const [
      lowStockCount,
      newReviewsCount,
      pendingApprovalsCount,
      totalOrdersCount,
      lateOrdersCount,
    ] = await Promise.all([
      prisma.product.count({ where: { quantity: { lte: 5 } } }),
      prisma.review ? prisma.review.count({ where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } }) : Promise.resolve(0),
      prisma.product.count({ where: { status: "PENDING" } as any }).catch(() => 0), // fallback if status doesn't exist
      prisma.order.count(),
      prisma.order.count({ where: { status: "PROCESSING", createdAt: { lte: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) } } }),
    ]);

    const alerts = [];

    if (lowStockCount > 0) {
      alerts.push({
        id: 1,
        type: "warning",
        title: "Low Stock Alert",
        description: `${lowStockCount} products are running low on inventory`,
        action: "View Products",
      });
    }

    if (newReviewsCount > 0) {
      alerts.push({
        id: 2,
        type: "info",
        title: "New Reviews",
        description: `${newReviewsCount} new product reviews need attention`,
        action: "View Reviews",
      });
    } else {
      alerts.push({
        id: 2,
        type: "info",
        title: "Store Rating",
        description: "Customer reviews are looking good and stable",
        action: "View Reviews",
      });
    }

    if (lateOrdersCount > 0) {
      const lateRate = totalOrdersCount > 0 ? Math.round((lateOrdersCount / totalOrdersCount) * 100) : 0;
      alerts.push({
        id: 3,
        type: "error",
        title: "Dispatch Delays",
        description: `${lateOrdersCount} orders have pending dispatch exceeding 3 days (${lateRate}% of orders)`,
        action: "View Details",
      });
    } else {
      alerts.push({
        id: 3,
        type: "info",
        title: "Dispatch Health",
        description: "All orders are dispatched within the standard 48 hours",
        action: "View Details",
      });
    }

    if (pendingApprovalsCount > 0) {
      alerts.push({
        id: 4,
        type: "warning",
        title: "Pending Approvals",
        description: `${pendingApprovalsCount} products awaiting admin approval`,
        action: "Check Status",
      });
    }

    return SuccessResponse(res, "Dashboard alerts fetched successfully", alerts);
  } catch (err) {
    next(err);
  }
});
