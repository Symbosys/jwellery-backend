import ENV from "../../../config/env.js";
import prisma from "../../../config/prisma.js";

// In-memory token cache for Shiprocket API
interface TokenCache {
  token: string;
  expiresAt: number;
}

let tokenCache: TokenCache | null = null;

/**
 * Shiprocket Order Item Interface
 */
export interface ShiprocketOrderItem {
  name: string;
  sku: string;
  units: number;
  selling_price: number;
  discount: number | string;
  tax: number | string;
  hsn: number | string;
}

/**
 * Shiprocket Adhoc Order Request Payload Interface
 */
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
 * 1. Authenticate with Shiprocket API and return Bearer token
 * Automatically caches token in memory and handles refresh
 */
export const getShiprocketToken = async (forceRefresh = false): Promise<string> => {
  const now = Date.now();

  // Return cached token if valid and forceRefresh is false
  if (!forceRefresh && tokenCache && tokenCache.expiresAt > now) {
    return tokenCache.token;
  }

  const email = ENV.SHIPROCKET_EMAIL;
  const password = ENV.SHIPROCKET_PASSWORD;

  if (!email || !password) {
    throw new Error("Shiprocket credentials (SHIPROCKET_EMAIL & SHIPROCKET_PASSWORD) are not set in environment.");
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

  // Token expires in ~10 days. Cache for 7 days
  tokenCache = {
    token: data.token,
    expiresAt: now + 7 * 24 * 60 * 60 * 1000,
  };

  console.log("[Shiprocket] Authentication successful. Token obtained.");
  return data.token;
};

/**
 * Ensures that a valid seller pickup location exists in Shiprocket
 */
export const ensurePickupLocationExists = async (token: string): Promise<boolean> => {
  try {
    const pickupLocName = ENV.SHIPROCKET_PICKUP_LOCATION || "Primary";
    console.log(`[Shiprocket] Ensuring pickup location '${pickupLocName}' exists...`);

    const res = await fetch("https://apiv2.shiprocket.in/v1/external/settings/company/addpickup", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        pickup_location: pickupLocName,
        name: "Anita Singh",
        email: "anita.y.sravano@gmail.com",
        phone: "9876543210",
        address: "Plot 123, Main Store",
        address_2: "Phase 1",
        city: "New Delhi",
        state: "Delhi",
        country: "India",
        pin_code: "110002",
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
 * 2. Build Shiprocket Adhoc Payload from local Order object
 */
export const buildShiprocketPayload = (order: any, userEmail?: string): ShiprocketAdhocPayload => {
  const { firstName, lastName } = splitFullName(order.shippingName);

  // Address handling
  const rawAddress = (order.shippingAddress || "").trim();
  let billingAddress = rawAddress;
  let billingAddress2 = "";

  if (rawAddress.length > 80) {
    billingAddress = rawAddress.substring(0, 80);
    billingAddress2 = rawAddress.substring(80, 160);
  }

  // Phone number numeric cleaning (keep last 10 digits)
  const phoneCleanStr = String(order.shippingPhone || "").replace(/\D/g, "").slice(-10);
  const phoneNum = parseInt(phoneCleanStr, 10) || 9876543210;

  // Pincode numeric cleaning
  const pincodeCleanStr = String(order.shippingPincode || "").replace(/\D/g, "");
  const pincodeNum = parseInt(pincodeCleanStr, 10) || 110002;

  // Email fallback
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

  // Calculate total estimated weight in kg (default 0.5kg per order if unknown)
  let totalWeight = 0.5;
  if (order.items && Array.isArray(order.items)) {
    const calcWeight = order.items.reduce((acc: number, item: any) => {
      const w = item.product?.weight ? Number(item.product.weight) : 0.5;
      return acc + w * item.quantity;
    }, 0);
    if (calcWeight > 0) totalWeight = Number(calcWeight.toFixed(2));
  }

  const pickupLocation = ENV.SHIPROCKET_PICKUP_LOCATION || "Primary";

  return {
    order_id: order.orderNumber || `ORD-${order.id.slice(0, 8)}`,
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
 * 3. Send order to Shiprocket Adhoc Order Creation Endpoint
 * POST https://apiv2.shiprocket.in/v1/external/orders/create/adhoc
 */
export const createShiprocketOrder = async (
  order: any,
  userEmail?: string
): Promise<{ success: boolean; data?: any; error?: string }> => {
  try {
    let token = await getShiprocketToken();
    const payload = buildShiprocketPayload(order, userEmail);

    console.log(`[Shiprocket] Submitting order ${payload.order_id} to Shiprocket...`);

    let response = await fetch("https://apiv2.shiprocket.in/v1/external/orders/create/adhoc", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    // Handle 401 Token Expiration
    if (response.status === 401) {
      console.warn("[Shiprocket] Token unauthorized (401). Retrying with fresh token...");
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

    // Handle missing pickup location error ("Please add billing/shipping address first")
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

    console.log(`[Shiprocket] Order ${payload.order_id} successfully created in Shiprocket!`, {
      shiprocket_order_id: data.order_id,
      shipment_id: data.shipment_id,
      status: data.status,
    });

    // Safely update database Order record with Shiprocket IDs if real order exists in DB
    try {
      const srOrderId = data.order_id ? String(data.order_id) : null;
      const srShipmentId = data.shipment_id ? String(data.shipment_id) : null;

      if ((srOrderId || srShipmentId) && order.id) {
        const existingDbOrder = await prisma.order.findUnique({ where: { id: order.id } });
        if (existingDbOrder) {
          await prisma.order.update({
            where: { id: order.id },
            data: {
              shiprocketOrderId: srOrderId,
              shiprocketShipmentId: srShipmentId,
            },
          });
        }
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

/**
 * Shiprocket Update Address Request Payload Interface
 */
export interface ShiprocketUpdateAddressPayload {
  order_id: number | string;
  shipping_customer_name: string;
  shipping_phone: string | number;
  shipping_address: string;
  shipping_address_2?: string;
  shipping_city: string;
  shipping_state: string;
  shipping_country?: string;
  shipping_pincode: number | string;
}

/**
 * 4. Update delivery address for an existing order in Shiprocket
 * POST https://apiv2.shiprocket.in/v1/external/orders/address/update
 */
export const updateShiprocketOrderAddress = async (
  payload: ShiprocketUpdateAddressPayload
): Promise<{ success: boolean; data?: any; error?: string }> => {
  try {
    let token = await getShiprocketToken();

    const numericOrderId = parseInt(String(payload.order_id), 10) || payload.order_id;
    const cleanPhone = String(payload.shipping_phone || "").replace(/\D/g, "").slice(-10);
    const pincodeVal = parseInt(String(payload.shipping_pincode || "").replace(/\D/g, ""), 10) || payload.shipping_pincode;

    const reqPayload = {
      order_id: numericOrderId,
      shipping_customer_name: payload.shipping_customer_name,
      shipping_phone: cleanPhone,
      shipping_address: payload.shipping_address,
      shipping_address_2: payload.shipping_address_2 || "",
      shipping_city: payload.shipping_city,
      shipping_state: payload.shipping_state,
      shipping_country: payload.shipping_country || "India",
      shipping_pincode: pincodeVal,
    };

    console.log(`[Shiprocket] Updating address for Shiprocket Order ID: ${numericOrderId}...`, reqPayload);

    let response = await fetch("https://apiv2.shiprocket.in/v1/external/orders/address/update", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(reqPayload),
    });

    // Handle 401 Token Expiration
    if (response.status === 401) {
      console.warn("[Shiprocket] Token unauthorized (401). Retrying with fresh token...");
      token = await getShiprocketToken(true);
      response = await fetch("https://apiv2.shiprocket.in/v1/external/orders/address/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(reqPayload),
      });
    }

    const responseText = await response.text();
    let data: any = null;
    if (responseText && responseText.trim()) {
      try {
        data = JSON.parse(responseText);
      } catch (parseErr) {
        data = { message: responseText };
      }
    }

    console.log(`[Shiprocket] Address update response (HTTP ${response.status}):`, data || responseText);

    if (!response.ok || (data && typeof data === "object" && data?.status_code === 0)) {
      const errorDetail =
        (data && typeof data === "object" && (data?.message || (data?.errors ? JSON.stringify(data.errors) : JSON.stringify(data)))) ||
        responseText ||
        `HTTP Error ${response.status}`;
      console.error(`[Shiprocket] Address update failed for order ${numericOrderId}:`, errorDetail);
      return { success: false, error: errorDetail, data };
    }

    console.log(`[Shiprocket] Address updated successfully for order ${numericOrderId}:`, data || responseText);
    return { success: true, data: data || { message: "Address updated successfully" } };
  } catch (error: any) {
    const message = error?.message || String(error);
    console.error("[Shiprocket] Exception updating order address on Shiprocket:", message);
    return { success: false, error: message };
  }
};


/**
 * 5. Cancel order(s) in Shiprocket
 * POST https://apiv2.shiprocket.in/v1/external/orders/cancel
 */
export const cancelShiprocketOrder = async (
  shiprocketOrderIds: Array<number | string>
): Promise<{ success: boolean; data?: any; error?: string }> => {
  try {
    if (!shiprocketOrderIds || shiprocketOrderIds.length === 0) {
      return { success: true, data: { message: "No Shiprocket order IDs provided" } };
    }

    const numericIds = shiprocketOrderIds.map((id) => parseInt(String(id), 10) || id);
    let token = await getShiprocketToken();

    console.log(`[Shiprocket] Cancelling Shiprocket Order IDs: ${JSON.stringify(numericIds)}...`);

    let response = await fetch("https://apiv2.shiprocket.in/v1/external/orders/cancel", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ ids: numericIds }),
    });

    // Handle 401 Token Expiration
    if (response.status === 401) {
      console.warn("[Shiprocket] Token unauthorized (401). Retrying with fresh token...");
      token = await getShiprocketToken(true);
      response = await fetch("https://apiv2.shiprocket.in/v1/external/orders/cancel", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ids: numericIds }),
      });
    }

    const responseText = await response.text();
    let data: any = null;
    if (responseText && responseText.trim()) {
      try {
        data = JSON.parse(responseText);
      } catch (parseErr) {
        data = { message: responseText };
      }
    }

    console.log(`[Shiprocket] Order cancellation response (HTTP ${response.status}):`, data || responseText);

    if (!response.ok || (data && typeof data === "object" && data?.status_code === 0)) {
      const errorDetail =
        (data && typeof data === "object" && (data?.message || (data?.errors ? JSON.stringify(data.errors) : JSON.stringify(data)))) ||
        responseText ||
        `HTTP Error ${response.status}`;
      console.error(`[Shiprocket] Order cancellation failed for IDs ${JSON.stringify(numericIds)}:`, errorDetail);
      return { success: false, error: errorDetail, data };
    }

    console.log(`[Shiprocket] Orders ${JSON.stringify(numericIds)} successfully cancelled in Shiprocket!`, data || responseText);
    return { success: true, data: data || { message: "Orders cancelled successfully" } };
  } catch (error: any) {
    const message = error?.message || String(error);
    console.error("[Shiprocket] Exception cancelling orders on Shiprocket:", message);
    return { success: false, error: message };
  }
};

export const createShiprocketReturnOrder = async (
  order: any,
  userEmail?: string,
  reason?: string
): Promise<{ success: boolean; data?: any; error?: string }> => {
  try {
    let token = await getShiprocketToken();

    const { firstName, lastName } = splitFullName(order.shippingName);
    const rawAddress = (order.shippingAddress || "").trim();
    let pickupAddress = rawAddress;
    let pickupAddress2 = "";
    if (rawAddress.length > 80) {
      pickupAddress = rawAddress.substring(0, 80);
      pickupAddress2 = rawAddress.substring(80, 160);
    }

    const phoneCleanStr = String(order.shippingPhone || "").replace(/\D/g, "").slice(-10);
    const pincodeCleanStr = String(order.shippingPincode || "").replace(/\D/g, "");
    const pincodeNum = parseInt(pincodeCleanStr, 10) || 110002;

    const customerEmail = (userEmail || order.user?.email || "customer@example.com").trim();
    const orderDateStr = formatShiprocketDate(order.createdAt || new Date()).split(" ")[0] || "2026-08-04";

    const returnItems = (order.items || []).map((item: any) => {
      const rawSku = item.variant?.sku || item.product?.sku || `SKU-${(item.productId || item.id || "PROD").slice(0, 8)}`;
      return {
        name: item.productName || item.product?.name || "Product Item",
        qc_enable: false,
        qc_product_name: item.productName || item.product?.name || "Product Item",
        sku: rawSku,
        units: Number(item.quantity || 1),
        selling_price: Number(item.unitPrice || 0),
        discount: 0,
        qc_product_image: item.productImage || item.product?.image || "",
      };
    });

    let totalWeight = 0.5;
    if (order.items && Array.isArray(order.items)) {
      const calcWeight = order.items.reduce((acc: number, item: any) => {
        const w = item.product?.weight ? Number(item.product.weight) : 0.5;
        return acc + w * item.quantity;
      }, 0);
      if (calcWeight > 0) totalWeight = Number(calcWeight.toFixed(2));
    }

    const returnPayload = {
      order_id: `RET-${order.orderNumber || order.id.slice(0, 8)}`,
      order_date: orderDateStr,
      pickup_customer_name: firstName,
      pickup_last_name: lastName,
      company_name: "Customer Return",
      pickup_address: pickupAddress || "Address line 1",
      pickup_address_2: pickupAddress2,
      pickup_city: order.shippingCity || "New Delhi",
      pickup_state: order.shippingState || "Delhi",
      pickup_country: "India",
      pickup_pincode: pincodeNum,
      pickup_email: customerEmail,
      pickup_phone: phoneCleanStr,
      pickup_isd_code: "91",
      shipping_customer_name: "Anita Singh",
      shipping_last_name: "",
      shipping_address: "Plot 123, Main Store",
      shipping_address_2: "Phase 1",
      shipping_city: "New Delhi",
      shipping_country: "India",
      shipping_pincode: 110002,
      shipping_state: "Delhi",
      shipping_email: "anita.y.sravano@gmail.com",
      shipping_isd_code: "91",
      shipping_phone: 9876543210,
      order_items: returnItems,
      payment_method: order.paymentMethod === "COD" ? "COD" : "PREPAID",
      total_discount: "0",
      sub_total: Number(order.subtotal || order.totalAmount || 0),
      length: 10,
      breadth: 10,
      height: 10,
      weight: totalWeight,
    };

    console.log(`[Shiprocket] Creating return order in Shiprocket for ${returnPayload.order_id}...`, returnPayload);

    let response = await fetch("https://apiv2.shiprocket.in/v1/external/orders/create/return", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(returnPayload),
    });

    if (response.status === 401) {
      console.warn("[Shiprocket] Token unauthorized (401). Retrying with fresh token...");
      token = await getShiprocketToken(true);
      response = await fetch("https://apiv2.shiprocket.in/v1/external/orders/create/return", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(returnPayload),
      });
    }

    const responseText = await response.text();
    let data: any = null;
    if (responseText && responseText.trim()) {
      try {
        data = JSON.parse(responseText);
      } catch (parseErr) {
        data = { message: responseText };
      }
    }

    console.log(`[Shiprocket] Return order creation response (HTTP ${response.status}):`, data || responseText);

    if (!response.ok || (data && typeof data === "object" && data?.status_code === 0)) {
      const errorDetail =
        (data && typeof data === "object" && (data?.message || (data?.errors ? JSON.stringify(data.errors) : JSON.stringify(data)))) ||
        responseText ||
        `HTTP Error ${response.status}`;
      console.error(`[Shiprocket] Return order creation failed:`, errorDetail);
      return { success: false, error: errorDetail, data };
    }

    console.log(`[Shiprocket] Return order successfully created in Shiprocket!`, data || responseText);
    return { success: true, data: data || { message: "Return order created successfully" } };
  } catch (error: any) {
    const message = error?.message || String(error);
    console.error("[Shiprocket] Exception creating return order on Shiprocket:", message);
    return { success: false, error: message };
  }
};

export default {
  getShiprocketToken,
  ensurePickupLocationExists,
  buildShiprocketPayload,
  createShiprocketOrder,
  updateShiprocketOrderAddress,
  cancelShiprocketOrder,
  createShiprocketReturnOrder,
};





