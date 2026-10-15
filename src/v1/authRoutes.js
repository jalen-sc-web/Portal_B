import express from 'express';
import authController from '../controllers/authController.js';
import { verifyToken, requireRole, verifyRecoveryKey } from '../middlewares/authMiddleware.js';

const router = express.Router();

router
    // Autenticación estándar y gestión de sesión
    .post("/login", authController.login)
    .post("/refresh-token", verifyToken, authController.refreshToken)
    .get("/me", verifyToken, authController.getMe)
    .post("/logout", verifyToken, authController.logout)

    // Cambio y establecimiento de contraseñas
    .post("/update-password", verifyToken, authController.changePassword)
    .post("/set-password", verifyToken, authController.setPassword)

    // Gestión administrativa de usuarios (Requiere rol ADMIN)
    .post("/admin/create-user", verifyToken, requireRole('ADMIN'), authController.createUser)
    .post("/admin/reset-password", verifyToken, requireRole('ADMIN'), authController.adminResetPassword)

    // Rescate de emergencia ("Break-Glass", requiere x-recovery-key de .env)
    .post("/system/override-password", verifyRecoveryKey, authController.emergencyOverridePassword);
     
export default router;