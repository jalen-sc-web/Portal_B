import express from 'express';
import authController from '../controllers/authController.js';
import { verifyToken, requireRole, verifyRecoveryKey } from '../middlewares/authMiddleware.js';

const router = express.Router();

router
    // Autenticación estándar
    .post("/login", authController.login)
    .post("/update-password", verifyToken, authController.changePassword)

    // Gestión administrativa de claves (Requiere rol ADMIN)
    .post("/admin/reset-password", verifyToken, requireRole('ADMIN'), authController.adminResetPassword)

    // Rescate de emergencia ("Break-Glass", requiere x-recovery-key de .env)
    .post("/system/override-password", verifyRecoveryKey, authController.emergencyOverridePassword);
     
export default router;