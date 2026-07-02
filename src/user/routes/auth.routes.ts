import express from "express";
import { requestOtp, verifyOtp, logout, adminRegister, adminLogin } from "../controller/auth.controller";
import { getAlluser, getById, updateUser } from "../controller/user.controller";
import { protect, optionalProtect } from "../../middleware/auth.middleware";

const router = express.Router();

router.post("/request-otp", requestOtp);
router.post("/verify-otp", verifyOtp);
router.post("/logout", logout);

// Admin authentication routes
router.post("/admin/register", adminRegister);
router.post("/admin/login", adminLogin);

// User Profile & Customer management
router.get("/all", optionalProtect, getAlluser);
router.get("/:id", protect, getById);
router.put("/:id", protect, updateUser);

export default router;
