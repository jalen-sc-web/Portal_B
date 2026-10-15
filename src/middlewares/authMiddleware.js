import jwt from "jsonwebtoken";
import crypto from "crypto";

export const getJwtSecret = () =>
  process.env.JWT_SECRET || "secreto_constitucion";

// Lista de revocación de tokens (Blocklist en memoria con TTL)
const revokedTokens = new Map();

export const revokeToken = (token, expiryEpochSeconds) => {
  const expiryMs = expiryEpochSeconds
    ? expiryEpochSeconds * 1000
    : Date.now() + 8 * 60 * 60 * 1000;
  revokedTokens.set(token, expiryMs);
};

export const isTokenRevoked = (token) => {
  const expiry = revokedTokens.get(token);
  if (!expiry) return false;
  if (Date.now() > expiry) {
    revokedTokens.delete(token);
    return false;
  }
  return true;
};

export const verifyToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      status: false,
      message: "Token no proporcionado o formato inválido",
    });
  }

  const token = authHeader.split(" ")[1];

  if (isTokenRevoked(token)) {
    return res.status(401).json({
      status: false,
      message: "Token revocado. La sesión ha sido finalizada.",
    });
  }

  jwt.verify(token, getJwtSecret(), (err, decoded) => {
    if (err) {
      return res
        .status(401)
        .json({ status: false, message: "Token inválido o expirado" });
    }
    req.user = decoded;
    req.token = token;
    next();
  });
};

export const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(403).json({
        status: false,
        message: "Acceso denegado: rol de usuario no identificado.",
      });
    }
    const userRole = String(req.user.role).toUpperCase();
    const hasRole = allowedRoles.some((r) => r.toUpperCase() === userRole);
    if (!hasRole) {
      return res.status(403).json({
        status: false,
        message: `Acceso denegado: se requiere rol ${allowedRoles.join(" o ")}.`,
      });
    }
    next();
  };
};

export const verifyRecoveryKey = (req, res, next) => {
  const recoveryKeyHeader = req.headers["x-recovery-key"];
  const configuredKey = process.env.ADMIN_RECOVERY_KEY;

  if (
    !configuredKey ||
    typeof configuredKey !== "string" ||
    configuredKey.trim().length < 16
  ) {
    return res.status(503).json({
      status: false,
      message:
        "La llave de recuperación ADMIN_RECOVERY_KEY no está configurada o es insegura en el servidor.",
    });
  }

  if (!recoveryKeyHeader || typeof recoveryKeyHeader !== "string") {
    return res.status(401).json({
      status: false,
      message:
        "Encabezado x-recovery-key requerido para esta operación de emergencia.",
    });
  }

  const a = Buffer.from(recoveryKeyHeader);
  const b = Buffer.from(configuredKey);

  console.log(
    `DEBUG: Verificando llave de recuperación. Longitudes: a=${a.length}, b=${b.length}`,
  );
  console.log(recoveryKeyHeader);

  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return res.status(401).json({
      status: false,
      message: "Llave de recuperación de emergencia inválida.",
    });
  }

  next();
};
