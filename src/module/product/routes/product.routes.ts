import express from "express";
import {
  createProduct,
  getAllProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  addToBag,
} from "../controllre/product.controller.js";
import { protect } from "../../../middleware/auth.middleware.js";
import upload from "../../../utils/multer.js";

const router = express.Router();

router.post("/", protect, upload.single("image"), createProduct);
router.get("/", getAllProducts);
router.get("/:id", getProductById);
router.put("/:id", protect, upload.single("image"), updateProduct);
router.delete("/:id", protect, deleteProduct);
router.post("/add-to-bag", protect, addToBag);

export default router;
