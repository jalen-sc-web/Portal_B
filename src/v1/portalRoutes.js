import express from "express";
import portalController from "../controllers/portalController.js";
import quoteController from "../controllers/quoteController.js";
import { verifyToken } from "../middlewares/authMiddleware.js";

const router = express.Router();

router
  .post("/search-owner", verifyToken, portalController.getOwner)
  .post("/full-rate", portalController.getFullRate)
  .post("/save-quote", portalController.saveQuote)
  .get("/cotizaciones/asegurado", verifyToken, quoteController.getInsuredQuotes)
  .get(
    "/cotizaciones/intermediario",
    verifyToken,
    quoteController.getIntermediaryQuotes,
  )
  .get("/cotizaciones/:id", verifyToken, quoteController.getQuoteById);

export default router;
