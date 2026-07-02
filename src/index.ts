import express from "express";

import errorMiddleware from "./middleware/error.middleware";
import userrouter from "./module/user/routes/auth.routes";
import catogaryrouter from "./module/category/routes/category.routes";
import subcategoryrouter from "./module/sub-category/routes/subcategory.routes";
import cors from "cors";

import productrouter from "./module/product/routes/product.routes";
import attributerouter from "./module/user/routes/attribute.routes";
import cartrouter from "./module/cart/routes/cart.routes";
import wishlistrouter from "./module/wishlist/routes/wishlist.routes";
import orderrouter from "./module/order/routes/order.routes.js";
import analyticsrouter from "./module/analytics/routes/analytics.routes.js";
import bannerrouter from "./module/banner/routes/banner.routes";
import couponrouter from "./coupon/routes/coupon.routes";
import chatsessionrouter from "./module/chatSession/routes/chatSession.routes.js";
import reviewrouter from "./module/review/routes/review.routes";
import offerrouter from "./module/offer/routes/offer.routes.js";

const app = express();

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, postman)
    if (!origin) return callback(null, true);
    
    // Allow any localhost, 127.0.0.1, or local network IPs (192.168.*.*, 10.*.*.*) domain on any port
    if (/^http:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)(:\d+)?$/.test(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,                // Important: allows cookies to be sent/received
}));

app.use(express.json({ limit: "50mb" })); // ✅ REQUIRED
app.use(express.urlencoded({ limit: "50mb", extended: true }));

app.get("/", (req, res) => {
  res.send("Hello Worlds!"); // Added a proper response
});


app.use("/api/user", userrouter)
app.use("/api/catogary", catogaryrouter)
app.use("/api/suncatogary", subcategoryrouter)
app.use("/api/product", productrouter)
app.use("/api/attribute", attributerouter)
app.use("/api/cart", cartrouter)
app.use("/api/wishlist", wishlistrouter)
app.use("/api/order", orderrouter)
app.use("/api/analytics", analyticsrouter)
app.use("/api/banner", bannerrouter)
app.use("/api/coupon", couponrouter)
app.use("/api/chat", chatsessionrouter)
app.use("/api/review", reviewrouter)
app.use("/api/offer", offerrouter)

app.use(errorMiddleware);
app.listen(4000, () => console.log("Server running on port 4000"));