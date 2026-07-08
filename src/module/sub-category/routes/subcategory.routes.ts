import express from "express";
import {
  subCatogaryCreate,
  getAllCategory,
  getByIdSubCategory,
  updateSubCategory,
  deleteSubCategory,
} from "../subcategory.controller.js";
import { protect } from "../../../middleware/auth.middleware.js";
import upload from "../../../utils/multer.js";

const router = express.Router();

router.post("/", protect, upload.single("image"), subCatogaryCreate);
router.get("/", getAllCategory);
router.get("/:id", getByIdSubCategory);
router.put("/:id", protect, upload.single("image"), updateSubCategory);
router.delete("/:id", protect, deleteSubCategory);

export default router;
