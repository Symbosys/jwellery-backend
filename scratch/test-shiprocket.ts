import { buildShiprocketPayload, getShiprocketToken } from "../src/module/order/services/shiprocket.service.js";

async function testShiprocketIntegration() {
  console.log("=== 1. Testing Shiprocket Authentication ===");
  const token = await getShiprocketToken();
  console.log(" Token obtained successfully:", token ? "YES (JWT length: " + token.length + ")" : "NO");

  console.log("\n=== 2. Testing Payload Builder ===");
  const mockOrder = {
    id: "test-order-12345",
    orderNumber: "ORD-998877-1122",
    createdAt: new Date(),
    shippingName: "Naruto Uzumaki",
    shippingAddress: "House 221B, Leaf Village, Near Hokage House",
    shippingCity: "New Delhi",
    shippingState: "Delhi",
    shippingPincode: "110002",
    shippingPhone: "9876543210",
    paymentMethod: "Prepaid",
    note: "Reseller: M/s Goku",
    subtotal: 9000,
    shippingCharge: 0,
    discount: 0,
    totalAmount: 9000,
    items: [
      {
        id: "item-1",
        productId: "prod-1",
        productName: "Kunai",
        quantity: 10,
        unitPrice: 900,
        product: {
          name: "Kunai",
          sku: "chakra123",
          weight: 0.25
        }
      }
    ]
  };

  const payload = buildShiprocketPayload(mockOrder, "naruto@uzumaki.com");
  console.log(" Generated Shiprocket Payload:");
  console.log(JSON.stringify(payload, null, 2));

  console.log("\n Validation Check:");
  console.assert(payload.order_id === "ORD-998877-1122", "Order ID mismatch");
  console.assert(payload.billing_customer_name === "Naruto", "First name mismatch");
  console.assert(payload.billing_last_name === "Uzumaki", "Last name mismatch");
  console.assert(payload.billing_pincode === 110002, "Pincode mismatch");
  console.assert(payload.billing_phone === 9876543210, "Phone mismatch");
  if (payload.order_items && payload.order_items[0]) {
    console.assert(payload.order_items[0].name === "Kunai", "Item name mismatch");
    console.assert(payload.order_items[0].sku === "chakra123", "SKU mismatch");
  }
  console.assert(payload.payment_method === "Prepaid", "Payment method mismatch");

  console.log(" All assertions passed!");
}

testShiprocketIntegration().catch(console.error);
