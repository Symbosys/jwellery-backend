import { z } from "zod";

export const sendMessageSchema = z.object({
  text: z.string().min(1, "Message cannot be empty"),
  sessionId: z.string().uuid("Invalid session ID").optional(),
});
