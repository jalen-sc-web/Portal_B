import express from 'express';
import portalController from '../controllers/portalController.js';
import { verifyToken } from '../middlewares/authMiddleware.js';

const router = express.Router();

router
    .post("/search-owner", verifyToken, portalController.getOwner)
    .post("/full-rate", portalController.getFullRate)
        
export default router;