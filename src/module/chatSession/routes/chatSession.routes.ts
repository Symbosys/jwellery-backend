import express from "express";
import { protect, optionalProtect } from "../../../middleware/auth.middleware.js";
import { 
  getMyActiveSession, 
  sendMessage, 
  getAllSessions, 
  sendAgentReply, 
  closeSession 
} from "../controller/chatSession.controller.js";

const router = express.Router();

// User routes (allow guests)
router.get("/my-session", optionalProtect, getMyActiveSession);
router.post("/message", optionalProtect, sendMessage);

// Admin/Agent routes (can be protected with admin middleware later)
router.get("/", optionalProtect, getAllSessions);
router.post("/:id/reply", optionalProtect, sendAgentReply);
router.put("/:id/close", optionalProtect, closeSession);

export default router;
