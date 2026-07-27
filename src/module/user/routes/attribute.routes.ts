import express from "express";
import {
    createAttribute,
    deleteAttribute,
    getAllAttributes,
    addAttributeValues,
    updateAttributeValue,
    deleteAttributeValue
} from "../../product/controllre/attribute.controller.js";

const router = express.Router();

router.get("/", getAllAttributes);
router.post("/", createAttribute);
router.delete("/:id", deleteAttribute);
router.post("/:id/values", addAttributeValues);
router.patch("/values/:valueId", updateAttributeValue);
router.put("/values/:valueId", updateAttributeValue);
router.delete("/values/:valueId", deleteAttributeValue);

export default router;

