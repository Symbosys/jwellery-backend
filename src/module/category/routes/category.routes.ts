import express from "express";
import {
  categoryCreate,
  getAllcategory,
  getById,
  UpdateCategory,
  deleteCategory,
} from "../controller/category.controller";
import { protect } from "../../../middleware/auth.middleware.js";
import upload from "../../../utils/multer.js";

const router = express.Router();

router.post("/", protect, upload.single("image"), categoryCreate);
router.get("/", getAllcategory);
router.get("/:id", getById);
router.put("/:id", protect, upload.single("image"), UpdateCategory);
router.delete("/:id", protect, deleteCategory);

export default router;
