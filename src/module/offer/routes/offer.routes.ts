import express from "express";
import {
    getAllOffers,
    getOfferById,
    createOffer,
    updateOffer,
    deleteOffer
} from "../controller/offer.controller.js";

const router = express.Router();

router.route("/")
    .get(getAllOffers)
    .post(createOffer);

router.route("/:id")
    .get(getOfferById)
    .put(updateOffer)
    .delete(deleteOffer);

export default router;
