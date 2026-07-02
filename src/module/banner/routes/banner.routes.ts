import express from "express";
import {
  createBanner,
  getAllBanners,
  getBannerById,
  updateBanner,
  deleteBanner
} from "../controller/banner.controller";
import upload from "../../../utils/multer";

const router = express.Router();

router.get("/", getAllBanners);
router.post("/", upload.single("image"), createBanner);
router.get("/:id", getBannerById);
router.put("/:id", upload.single("image"), updateBanner);
router.delete("/:id", deleteBanner);

export default router;
