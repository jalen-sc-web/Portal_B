import express from 'express';

import portalController from '../controllers/portalController.js';

const router = express.Router();

router

    .post("/search-owner", portalController.getOwner)
        
export default router;