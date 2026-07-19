import express from "express";

import errorMiddleware from "./middleware/error.middleware.js";
import userrouter from "./module/user/routes/auth.routes.js";
import catogaryrouter from "./module/category/routes/category.routes.js";
import subcategoryrouter from "./module/sub-category/routes/subcategory.routes.js";
import cors from "cors";

import productrouter from "./module/product/routes/product.routes.js";
import attributerouter from "./module/user/routes/attribute.routes.js";
import cartrouter from "./module/cart/routes/cart.routes.js";
import wishlistrouter from "./module/wishlist/routes/wishlist.routes.js";
import orderrouter from "./module/order/routes/order.routes.js";
import analyticsrouter from "./module/analytics/routes/analytics.routes.js";
import bannerrouter from "./module/banner/routes/banner.routes.js";
import couponrouter from "./coupon/routes/coupon.routes.js";
import chatsessionrouter from "./module/chatSession/routes/chatSession.routes.js";
import reviewrouter from "./module/review/routes/review.routes.js";
import offerrouter from "./module/offer/routes/offer.routes.js";
import brandrouter from "./module/brand/routes/brand.routes.js";
import blogrouter from "./module/blogs/routes/blog.routes.js";
import addressrouter from "./module/address/routes/address.routes.js";
import adminrouter from "./module/admin/routes/analytics.routes.js";
import paymentsRouter from "./module/admin/routes/payments.routes.js";
import settingsRouter from "./module/admin/routes/settings.routes.js";
import dashboardRouter from "./module/admin/routes/dashboard.routes.js";

const app = express();

const allowedOrigins = [
  "https://protien-frontend.vercel.app",
  "https://protien-admin.vercel.app",
  "https://admin.fuelandnutrients.com",
  "https://fuelandnutrients.com"
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, postman)
      if (!origin) return callback(null, true);
      
      if (
        allowedOrigins.includes(origin) ||
        /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)(:\d+)?$/.test(origin)
      ) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

app.use(express.json({ limit: "50mb" })); // ✅ REQUIRED
app.use(express.urlencoded({ limit: "50mb", extended: true }));

app.get("/", (req, res) => {
  res.send("Hello Worlds!"); // Added a proper response
});

app.use("/api/user", userrouter);
app.use("/api/catogary", catogaryrouter);
app.use("/api/suncatogary", subcategoryrouter);
app.use("/api/product", productrouter);
app.use("/api/attribute", attributerouter);
app.use("/api/cart", cartrouter);
app.use("/api/wishlist", wishlistrouter);
app.use("/api/order", orderrouter);
app.use("/api/analytics", analyticsrouter);
app.use("/api/banner", bannerrouter);
app.use("/api/coupon", couponrouter);
app.use("/api/chat", chatsessionrouter);
app.use("/api/review", reviewrouter);
app.use("/api/offer", offerrouter);
app.use("/api/brand", brandrouter);
app.use("/api/blog", blogrouter);
app.use("/api/admin", adminrouter);
app.use("/api/admin/payments", paymentsRouter);
app.use("/api/admin/settings", settingsRouter);
app.use("/api/admin/dashboard", dashboardRouter);
app.use("/api/address", addressrouter);

app.use(errorMiddleware);
app.listen(4000, () => console.log("Server running on port 4000"));

export default app;
