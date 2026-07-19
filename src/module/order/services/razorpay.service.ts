import crypto from "crypto";
import Razorpay from "razorpay";
import ENV from "../../../config/env.js";

let razorpayInstance: Razorpay | null = null;

const getRazorpayInstance = () => {
  if (!razorpayInstance) {
    if (!ENV.RAZORPAY_KEY_ID || !ENV.RAZORPAY_KEY_SECRET) {
      console.warn("Razorpay credentials are missing; Razorpay payments will not be functional.");
      return null;
    }
    razorpayInstance = new Razorpay({
      key_id: ENV.RAZORPAY_KEY_ID,
      key_secret: ENV.RAZORPAY_KEY_SECRET,
    });
  }
  return razorpayInstance;
};

/**
 * Creates a Razorpay order
 * @param amount - Amount in INR (will be converted to paise)
 * @param receipt - Unique receipt order number
 */
export const createRazorpayOrder = async (amount: number, receipt: string) => {
  const instance = getRazorpayInstance();
  if (!instance) {
    throw new Error("Razorpay payment gateway is not configured.");
  }
  const options = {
    amount: Math.round(amount * 100), // convert to paise
    currency: "INR",
    receipt: receipt,
  };
  return await instance.orders.create(options);
};

/**
 * Verifies the Razorpay payment signature
 * @param razorpayOrderId - Razorpay order ID
 * @param razorpayPaymentId - Razorpay payment ID
 * @param signature - Signature from client
 */
export const verifyRazorpaySignature = (
  razorpayOrderId: string,
  razorpayPaymentId: string,
  signature: string
): boolean => {
  const text = `${razorpayOrderId}|${razorpayPaymentId}`;
  const generatedSignature = crypto
    .createHmac("sha256", ENV.RAZORPAY_KEY_SECRET)
    .update(text)
    .digest("hex");
  
  return generatedSignature === signature;
};

export default getRazorpayInstance;
