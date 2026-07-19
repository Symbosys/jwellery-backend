import { Cashfree, CFEnvironment } from "cashfree-pg";
import ENV from "../../../config/env.js";

// Determine Environment
const cashfreeEnv = ENV.CASHFREE_ENV === "PRODUCTION" ? CFEnvironment.PRODUCTION : CFEnvironment.SANDBOX;

// Initialize Cashfree Instance
export const cashfree = new Cashfree(
  cashfreeEnv,
  ENV.CASHFREE_CLIENT_ID,
  ENV.CASHFREE_CLIENT_SECRET
);

export interface CreateCashfreeOrderParams {
  orderId: string;
  amount: number;
  customer: {
    id: string;
    name: string;
    email: string;
    phone: string;
  };
}

/**
 * Creates a Cashfree payment gateway order session
 */
export const createCashfreeOrder = async ({ orderId, amount, customer }: CreateCashfreeOrderParams) => {
  const request = {
    order_amount: Number(amount.toFixed(2)),
    order_currency: "INR",
    order_id: orderId,
    customer_details: {
      customer_id: customer.id,
      customer_name: customer.name || "Customer",
      customer_email: customer.email || "customer@example.com",
      customer_phone: customer.phone,
    },
    order_meta: {
      return_url: `${ENV.FRONTEND_URL}/order/${orderId}`
    }
  };

  const response = await cashfree.PGCreateOrder(request);
  return response.data;
};

/**
 * Fetches order details from Cashfree to check status
 */
export const getCashfreeOrder = async (orderId: string) => {
  const response = await cashfree.PGFetchOrder(orderId);
  return response.data;
};
