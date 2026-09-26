import dotenv from "dotenv";
import prisma from "../src/config/prisma.js";

dotenv.config();

// Shiprocket Credentials
const SHIPROCKET_EMAIL = (process.env.SHIPROCKET_EMAIL || "anita.y.sravano@gmail.com").trim();
const SHIPROCKET_PASSWORD = (process.env.SHIPROCKET_PASSWORD || "Dn!1CJvhNxdTqcw7CnR^#SBs2IV*x!y4").trim();
const SHIPROCKET_PICKUP_LOCATION = (process.env.SHIPROCKET_PICKUP_LOCATION || "Primary").trim();

// Token cache in memory
interface TokenCache {
  token: string;
  expiresAt: number;
}

let tokenCache: TokenCache | null = null;

export interface ShiprocketOrderItem {
  name: string;
  sku: string;
  units: number;
  selling_price: number;
  discount: number | string;
  tax: number | string;
  hsn: number | string;
}

export interface ShiprocketAdhocPayload {
  order_id: string;
  order_date: string;
  pickup_location: string;
  comment?: string;
  billing_customer_name: string;
  billing_last_name: string;
  billing_address: string;
  billing_address_2?: string;
  billing_city: string;
  billing_pincode: number;
  billing_state: string;
  billing_country: string;
  billing_email: string;
  billing_phone: number;
  shipping_is_billing: boolean;
  shipping_customer_name?: string;
  shipping_last_name?: string;
  shipping_address?: string;
  shipping_address_2?: string;
  shipping_city?: string;
  shipping_pincode?: string | number;
  shipping_country?: string;
  shipping_state?: string;
  shipping_email?: string;
  shipping_phone?: string | number;
  order_items: ShiprocketOrderItem[];
  payment_method: "Prepaid" | "COD";
  shipping_charges: number;
  giftwrap_charges: number;
  transaction_charges: number;
  total_discount: number;
  sub_total: number;
  length: number;
  breadth: number;
  height: number;
  weight: number;
}

/**
 * 1. Authenticate with Shiprocket API and retrieve Bearer token
 */
export const getShiprocketToken = async (forceRefresh = false): Promise<string> => {
  const now = Date.now();

  if (!forceRefresh && tokenCache && tokenCache.expiresAt > now) {
    return tokenCache.token;
  }

  const email = SHIPROCKET_EMAIL;
  const password = SHIPROCKET_PASSWORD;

  if (!email || !password) {
    throw new Error("Shiprocket credentials (SHIPROCKET_EMAIL & SHIPROCKET_PASSWORD) are required.");
  }

  console.log(`[Shiprocket] Authenticating with email: ${email}...`);

  const response = await fetch("https://apiv2.shiprocket.in/v1/external/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  const data = (await response.json()) as any;

  if (!response.ok || !data.token) {
    const errorMsg = data.message || data.error || JSON.stringify(data);
    console.error("[Shiprocket] Authentication failed:", errorMsg);
    throw new Error(`Shiprocket Auth Failed: ${errorMsg}`);
  }

  // Token is typically valid for 10 days; cache for 7 days
  tokenCache = {
    token: data.token,
    expiresAt: now + 7 * 24 * 60 * 60 * 1000,
  };

  console.log("[Shiprocket] Authentication successful. Token obtained.");
  return data.token;
};

/**
 * 2. Ensure seller pickup location exists in Shiprocket
 */
export const ensurePickupLocationExists = async (token: string): Promise<boolean> => {
  try {
    const pickupLocName = SHIPROCKET_PICKUP_LOCATION || "Primary";
    console.log(`[Shiprocket] Verifying/creating pickup location '${pickupLocName}'...`);

    const res = await fetch("https://apiv2.shiprocket.in/v1/external/settings/company/addpickup", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        pickup_location: pickupLocName,
        name: "Sakhio",
        email: "sakhio.business@gmail.com",
        phone: "9288579382, 9431104323",
        address: "Flat no- 105, Rash Bihari Apartment, Nivaranpur, Near Tapowan Mandir, Doranda Ranchi- 834002 Jharkhand",
        address_2: "Flat no- 101, Rash Bihari Apartment, Nivaranpur, Near Tapowan Mandir, Doranda Ranchi- 834002 Jharkhand",
        city: "Ranchi",
        state: "Jharkhand",
        country: "India",
        pin_code: "834002",
      }),
    });

    const data = (await res.json()) as any;
    if (data.success || data.pickup_id) {
      console.log(`[Shiprocket] Pickup location '${pickupLocName}' verified/created.`);
      return true;
    }
    return false;
  } catch (err) {
    console.error("[Shiprocket] Failed to verify/add pickup location:", err);
    return false;
  }
};

/**
 * Helper to split full name into first and last name
 */
const splitFullName = (fullName: string): { firstName: string; lastName: string } => {
  const trimmed = (fullName || "").trim();
  if (!trimmed) return { firstName: "Customer", lastName: "" };

  const parts = trimmed.split(/\s+/);
  const firstName = parts[0] || "Customer";
  const lastName = parts.slice(1).join(" ") || "";
  return { firstName, lastName };
};

/**
 * Helper to format date into "YYYY-MM-DD HH:mm" for Shiprocket
 */
const formatShiprocketDate = (dateVal: Date | string): string => {
  const d = new Date(dateVal);
  const pad = (num: number) => String(num).padStart(2, "0");
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());

  return `${year}-${month}-${day} ${hours}:${minutes}`;
};

/**
 * 3. Build Shiprocket Adhoc Payload from order object
 */
export const buildShiprocketPayload = (order: any, userEmail?: string): ShiprocketAdhocPayload => {
  const { firstName, lastName } = splitFullName(order.shippingName);

  const rawAddress = (order.shippingAddress || "").trim();
  let billingAddress = rawAddress;
  let billingAddress2 = "";

  if (rawAddress.length > 80) {
    billingAddress = rawAddress.substring(0, 80);
    billingAddress2 = rawAddress.substring(80, 160);
  }

  // Phone number numeric cleaning (last 10 digits)
  const phoneCleanStr = String(order.shippingPhone || "").replace(/\D/g, "").slice(-10);
  const phoneNum = parseInt(phoneCleanStr, 10) || 9876543210;

  // Pincode numeric cleaning
  const pincodeCleanStr = String(order.shippingPincode || "").replace(/\D/g, "");
  const pincodeNum = parseInt(pincodeCleanStr, 10) || 110002;

  // Customer email
  const customerEmail = (userEmail || order.user?.email || "customer@example.com").trim();

  // Map Items
  const orderItems: ShiprocketOrderItem[] = (order.items || []).map((item: any) => {
    const rawSku = item.variant?.sku || item.product?.sku || `SKU-${(item.productId || item.id || "PROD").slice(0, 8)}`;
    return {
      name: item.productName || item.product?.name || "Product Item",
      sku: rawSku,
      units: Number(item.quantity || 1),
      selling_price: Number(item.unitPrice || 0),
      discount: 0,
      tax: 0,
      hsn: 441122,
    };
  });

  // Calculate total estimated weight in kg
  let totalWeight = 0.5;
  if (order.items && Array.isArray(order.items)) {
    const calcWeight = order.items.reduce((acc: number, item: any) => {
      const w = item.product?.weight ? Number(item.product.weight) : 0.5;
      return acc + w * Number(item.quantity || 1);
    }, 0);
    if (calcWeight > 0) totalWeight = Number(calcWeight.toFixed(2));
  }

  const pickupLocation = SHIPROCKET_PICKUP_LOCATION || "Primary";

  return {
    order_id: order.orderNumber || `ORD-${order.id ? order.id.slice(0, 8) : Date.now()}`,
    order_date: formatShiprocketDate(order.createdAt || new Date()),
    pickup_location: pickupLocation,
    comment: order.note || "Order placed via online store",
    billing_customer_name: firstName,
    billing_last_name: lastName,
    billing_address: billingAddress || "Address line 1",
    billing_address_2: billingAddress2,
    billing_city: order.shippingCity || "New Delhi",
    billing_pincode: pincodeNum,
    billing_state: order.shippingState || "Delhi",
    billing_country: "India",
    billing_email: customerEmail,
    billing_phone: phoneNum,
    shipping_is_billing: true,
    shipping_customer_name: "",
    shipping_last_name: "",
    shipping_address: "",
    shipping_address_2: "",
    shipping_city: "",
    shipping_pincode: "",
    shipping_country: "",
    shipping_state: "",
    shipping_email: "",
    shipping_phone: "",
    order_items: orderItems,
    payment_method: order.paymentMethod === "COD" ? "COD" : "Prepaid",
    shipping_charges: Number(order.shippingCharge || 0),
    giftwrap_charges: 0,
    transaction_charges: 0,
    total_discount: Number(order.discount || 0),
    sub_total: Number(order.subtotal || order.totalAmount || 0),
    length: 10,
    breadth: 15,
    height: 20,
    weight: totalWeight,
  };
};

/**
 * 4. Main Function: Call this function when an order is completed/confirmed.
 * Can accept either an order object OR an order ID string.
 *
 * Automatically:
 * 1. Authenticates with Shiprocket
 * 2. Formats order payload
 * 3. Creates the order in Shiprocket
 * 4. Updates shiprocketOrderId & shiprocketShipmentId in the database
 */
export const handleOrderCompletionShiprocket = async (
  orderOrId: string | any,
  userEmail?: string
): Promise<{ success: boolean; data?: any; error?: string }> => {
  try {
    let order = orderOrId;

    // If order ID string is passed, fetch complete order details from database
    if (typeof orderOrId === "string") {
      const dbOrder = await prisma.order.findUnique({
        where: { id: orderOrId },
        include: {
          items: {
            include: {
              product: true,
              variant: true,
            },
          },
          user: true,
          address: true,
        },
      });

      if (!dbOrder) {
        throw new Error(`Order with ID '${orderOrId}' not found in database.`);
      }
      order = dbOrder;
      if (!userEmail && dbOrder.user?.email) {
        userEmail = dbOrder.user.email;
      }
    }

    let token = await getShiprocketToken();
    const payload = buildShiprocketPayload(order, userEmail);

    console.log(`[Shiprocket] Submitting completed order ${payload.order_id} to Shiprocket...`);

    let response = await fetch("https://apiv2.shiprocket.in/v1/external/orders/create/adhoc", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    // Handle 401 Token Expiry & Retry
    if (response.status === 401) {
      console.warn("[Shiprocket] Token expired (401). Refreshing token and retrying...");
      token = await getShiprocketToken(true);
      response = await fetch("https://apiv2.shiprocket.in/v1/external/orders/create/adhoc", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
    }

    let data = (await response.json()) as any;

    // Handle missing pickup location error
    if (data.message && data.message.includes("billing/shipping address first")) {
      console.warn("[Shiprocket] Pickup address missing. Auto-creating pickup location and retrying...");
      await ensurePickupLocationExists(token);
      response = await fetch("https://apiv2.shiprocket.in/v1/external/orders/create/adhoc", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      data = (await response.json()) as any;
    }

    if (!response.ok || data.status_code === 0) {
      const errorDetail = data.message || (data.errors ? JSON.stringify(data.errors) : JSON.stringify(data));
      console.error(`[Shiprocket] Failed to create order ${payload.order_id}:`, errorDetail);
      return { success: false, error: errorDetail, data };
    }

    console.log(`[Shiprocket] Order ${payload.order_id} successfully created on Shiprocket!`, {
      shiprocket_order_id: data.order_id,
      shipment_id: data.shipment_id,
      status: data.status,
    });

    // Update DB with Shiprocket Order & Shipment IDs
    try {
      const srOrderId = data.order_id ? String(data.order_id) : null;
      const srShipmentId = data.shipment_id ? String(data.shipment_id) : null;

      if ((srOrderId || srShipmentId) && order.id) {
        await prisma.order.update({
          where: { id: order.id },
          data: {
            shiprocketOrderId: srOrderId,
            shiprocketShipmentId: srShipmentId,
          },
        });
        console.log(`[Shiprocket] DB order ${order.id} updated with Shiprocket IDs.`);
      }
    } catch (dbErr) {
      console.error("[Shiprocket] Error updating order with Shiprocket IDs in DB:", dbErr);
    }

    return { success: true, data };
  } catch (error: any) {
    const message = error?.message || String(error);
    console.error("[Shiprocket] Exception while placing order on Shiprocket:", message);
    return { success: false, error: message };
  }
};

// Aliased export for convenience
export const createShiprocketOrder = handleOrderCompletionShiprocket;

export default {
  getShiprocketToken,
  ensurePickupLocationExists,
  buildShiprocketPayload,
  handleOrderCompletionShiprocket,
  createShiprocketOrder,
};
