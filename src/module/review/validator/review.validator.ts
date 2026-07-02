import { z } from "zod";

export const CreateReviewValidator = z.object({
  rating: z.number().min(1, "Rating must be at least 1").max(5, "Rating cannot exceed 5"),
  comment: z.string().min(3, "Comment is too short"),
  productId: z.string().uuid("Invalid product ID"),
});

export const ReplyReviewValidator = z.object({
  reply: z.string().min(2, "Reply cannot be empty"),
});
