import express from "express";
import { getAllReviews, createReview, replyToReview } from "../controller/review.controller";
import { protect, optionalProtect } from "../../../middleware/auth.middleware";

const router = express.Router();

router.get("/all", optionalProtect, getAllReviews);
router.post("/", protect, createReview);
router.put("/:id/reply", protect, replyToReview);

export default router;
