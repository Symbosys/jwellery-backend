import express from "express";
import {
    createAttribute,
    deleteAttribute,
    getAllAttributes,
    addAttributeValues,
    deleteAttributeValue
} from "../../module/product/controllre/attribute.controller.js";

const router = express.Router();

router.get("/", getAllAttributes);
router.post("/", createAttribute);
router.delete("/:id", deleteAttribute);
router.post("/:id/values", addAttributeValues);
router.delete("/values/:valueId", deleteAttributeValue);

export default router;
