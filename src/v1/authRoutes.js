import express from 'express';
import authController from '../controllers/authController.js';
import { verifyToken, requireRole, verifyRecoveryKey } from '../middlewares/authMiddleware.js';
import { createRateLimiter } from '../middlewares/rateLimiter.js';

const router = express.Router();

// Limitadores de tasa por IP en memoria
const loginLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 15,
    message: "Demasiados intentos de acceso desde esta dirección IP. Por favor espere 15 minutos."
});

const forgotPasswordLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: "Demasiadas solicitudes de recuperación de contraseña desde esta dirección IP. Por favor espere 15 minutos."
});

router
    // Autenticación estándar y gestión de sesión
    .post("/login", loginLimiter, authController.login)
    .post("/refresh-token", verifyToken, authController.refreshToken)
    .get("/me", verifyToken, authController.getMe)
    .post("/logout", verifyToken, authController.logout)

    // Recuperación de contraseña por correo SMTP (Protegido por IP Rate Limiter y Account Cooldown)
    .post("/forgot-password", forgotPasswordLimiter, authController.forgotPassword)
    .post("/verify-reset-token", authController.verifyResetToken)
    .post("/reset-password", authController.resetPassword)

    // Cambio y establecimiento de contraseñas
    .post("/update-password", verifyToken, authController.changePassword)
    .post("/set-password", verifyToken, authController.setPassword)

    // Gestión administrativa de usuarios (Requiere rol ADMIN)
    .post("/admin/create-user", verifyToken, requireRole('ADMIN'), authController.createUser)
    .post("/admin/reset-password", verifyToken, requireRole('ADMIN'), authController.adminResetPassword)

    // Rescate de emergencia ("Break-Glass", requiere x-recovery-key de .env)
    .post("/system/override-password", verifyRecoveryKey, authController.emergencyOverridePassword);
     
export default router;