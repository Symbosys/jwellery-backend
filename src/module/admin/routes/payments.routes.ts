import express from "express";
import { 
  getPaymentsOverview, 
  getTransactions 
} from "../controller/payments.controller.js";
import { optionalProtect } from "../../../middleware/auth.middleware.js";

const router = express.Router();

router.get("/overview", optionalProtect, getPaymentsOverview);
router.get("/transactions", optionalProtect, getTransactions);

export default router;
