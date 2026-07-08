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

const app = express();

app.use(
  cors({
    origin: "*",
    credentials: true, // Important: allows cookies to be sent/received
  }),
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

app.use(errorMiddleware);
app.listen(4000, () => console.log("Server running on port 4000"));
