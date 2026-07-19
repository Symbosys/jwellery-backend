import prisma from "../../../config/prisma.js";
import { asyncHandler } from "../../../middleware/error.middleware.js";
import { SuccessResponse } from "../../../utils/response.utils.js";

export const getPaymentsOverview = asyncHandler(async (req, res, next) => {
  try {
    // 1. Fetch PAID orders
    const paidOrders = await prisma.order.findMany({
      where: {
        paymentStatus: "PAID",
      },
      select: {
        totalAmount: true,
        status: true,
        createdAt: true,
      },
    });

    // 2. Calculate Stats
    // Total Earnings = sum of totalAmount of all PAID orders
    const totalEarnings = paidOrders.reduce((sum, o) => sum + Number(o.totalAmount), 0);

    // Completed Payouts = sum of totalAmount of paid orders that are DELIVERED
    const completedPayouts = paidOrders
      .filter((o) => o.status === "DELIVERED")
      .reduce((sum, o) => sum + Number(o.totalAmount), 0);

    // Pending Payout = totalEarnings - completedPayouts (i.e. paid but not yet delivered/settled)
    const pendingPayout = totalEarnings - completedPayouts;

    // This Month = sum of totalAmount of paid orders created in current month
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const thisMonthEarnings = paidOrders
      .filter((o) => {
        const date = new Date(o.createdAt);
        return date.getFullYear() === currentYear && date.getMonth() === currentMonth;
      })
      .reduce((sum, o) => sum + Number(o.totalAmount), 0);

    // Calculate percentage change (optional comparison to last month)
    const lastMonthEarnings = paidOrders
      .filter((o) => {
        const date = new Date(o.createdAt);
        const targetMonth = currentMonth === 0 ? 11 : currentMonth - 1;
        const targetYear = currentMonth === 0 ? currentYear - 1 : currentYear;
        return date.getFullYear() === targetYear && date.getMonth() === targetMonth;
      })
      .reduce((sum, o) => sum + Number(o.totalAmount), 0);

    const change = lastMonthEarnings > 0 
      ? Number((((thisMonthEarnings - lastMonthEarnings) / lastMonthEarnings) * 100).toFixed(1))
      : 0;

    const stats = [
      { label: "Total Earnings", value: `₹${totalEarnings.toLocaleString()}`, change: change || null },
      { label: "Pending Payout", value: `₹${pendingPayout.toLocaleString()}`, change: null },
      { label: "This Month", value: `₹${thisMonthEarnings.toLocaleString()}`, change: change || null },
      { label: "Completed Payouts", value: `₹${completedPayouts.toLocaleString()}`, change: null },
    ];

    // 3. Calculate Earnings Chart (last 6 calendar months)
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const earningsData: { month: string; earnings: number }[] = [];

    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(now.getMonth() - i);
      const m = d.getMonth();
      const y = d.getFullYear();

      const monthlySum = paidOrders
        .filter((o) => {
          const oDate = new Date(o.createdAt);
          return oDate.getFullYear() === y && oDate.getMonth() === m;
        })
        .reduce((sum, o) => sum + Number(o.totalAmount), 0);

      earningsData.push({
        month: months[m] || "",
        earnings: monthlySum,
      });
    }

    return SuccessResponse(res, "Payments overview fetched successfully", {
      stats,
      earningsData,
    });
  } catch (err) {
    next(err);
  }
});

export const getTransactions = asyncHandler(async (req, res, next) => {
  try {
    const limit = Number(req.query.limit) || 10;

    // Fetch recent orders
    const orders = await prisma.order.findMany({
      orderBy: {
        createdAt: "desc",
      },
      take: limit,
      select: {
        id: true,
        orderNumber: true,
        totalAmount: true,
        createdAt: true,
        status: true,
        paymentStatus: true,
      },
    });

    const txs: {
      id: string;
      type: "credit" | "debit";
      description: string;
      amount: number;
      date: string;
      status: "completed" | "processing" | "pending" | "failed";
    }[] = [];

    orders.forEach((o) => {
      const formattedDate = new Date(o.createdAt).toISOString().split("T")[0] || "";
      const statusMapping = 
        o.status === "DELIVERED" ? "completed" : 
        o.status === "CANCELLED" ? "failed" : "processing";

      // 1. Credit transaction for the order payment
      txs.push({
        id: `${o.id}-credit`,
        type: "credit",
        description: `Order #${o.orderNumber} Payment`,
        amount: Number(o.totalAmount),
        date: formattedDate,
        status: o.paymentStatus === "PAID" ? "completed" : statusMapping,
      });

      // 2. Debit transaction for commission (e.g. 10% platform fee)
      if (o.paymentStatus === "PAID") {
        txs.push({
          id: `${o.id}-debit`,
          type: "debit",
          description: `Platform Commission (10%) for #${o.orderNumber}`,
          amount: -Number(o.totalAmount) * 0.1,
          date: formattedDate,
          status: "completed",
        });
      }
    });

    return SuccessResponse(res, "Transactions fetched successfully", txs);
  } catch (err) {
    next(err);
  }
});
