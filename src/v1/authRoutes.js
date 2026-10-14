import express from 'express';
import authController from '../controllers/authController.js';
import { verifyToken } from '../middlewares/authMiddleware.js';

const router = express.Router();

router
    .post("/login", authController.login)
    .post("/update-password", verifyToken, authController.changePassword);
     
export default router;