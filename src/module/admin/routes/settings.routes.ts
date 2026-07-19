import express from "express";
import { 
  getWebConfig, 
  updateWebConfig 
} from "../controller/settings.controller.js";
import { optionalProtect } from "../../../middleware/auth.middleware.js";
import upload from "../../../utils/multer.js";

const router = express.Router();

const optionalUpload = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const contentType = req.headers["content-type"] || "";
  if (contentType.includes("multipart/form-data")) {
    return upload.single("logo")(req, res, next);
  }
  next();
};

router.get("/", optionalProtect, getWebConfig);
router.put("/", optionalProtect, optionalUpload, updateWebConfig);

export default router;
