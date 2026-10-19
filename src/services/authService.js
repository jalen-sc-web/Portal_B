import Auth from "../db/Auth.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import {
  revokeToken,
  isTokenRevoked,
  getJwtSecret,
} from "../middlewares/authMiddleware.js";
import { sendPasswordResetEmail } from "../utils/mailer.js";
import { validateNewPassword } from "../utils/passwordValidator.js";

// Rate limiting por cuenta/correo: Map de clave normalizada -> timestamp de expiración del cooldown
const accountCooldowns = new Map();
const getCooldownDurationMs = () => Number(process.env.RESET_PASSWORD_COOLDOWN_SECONDS || 180) * 1000;

// Limpieza periódica de cooldowns expirados
const cooldownCleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [key, expiresAt] of accountCooldowns.entries()) {
    if (now >= expiresAt) {
      accountCooldowns.delete(key);
    }
  }
}, 5 * 60 * 1000);

if (cooldownCleanupInterval.unref) {
  cooldownCleanupInterval.unref();
}

const getJwtExpiresIn = () => process.env.JWT_EXPIRES_IN || "8h";

export const getExpiresInSeconds = () => {
  const str = getJwtExpiresIn();
  if (str.endsWith("h")) return parseInt(str, 10) * 3600;
  if (str.endsWith("m")) return parseInt(str, 10) * 60;
  if (str.endsWith("d")) return parseInt(str, 10) * 86400;
  return parseInt(str, 10) || 28800;
};

export const generateUserToken = (user, expiresIn = getJwtExpiresIn()) => {
  return jwt.sign(
    {
      username: user.CODUSU || user.username,
      role: user.CODPERFIL || user.role,
      email: user.EMAIL || user.email,
      requireChange: user.CAMBIOCLV === "S" || user.requireChange === true,
    },
    getJwtSecret(),
    { expiresIn },
  );
};

export const loginUser = async ({ username, password }) => {
  if (!username || !password) {
    const error = new Error("Documento de identidad y contraseña son requeridos.");
    error.statusCode = 400;
    error.isOperational = true;
    throw error;
  }

  const raw = String(username).trim();
  const isAdmin = raw.toLowerCase() === "admin";

  let searchIdentifier;
  if (isAdmin) {
    searchIdentifier = "admin";
  } else {
    // El login funciona exclusivamente con el documento de identidad (solo números)
    const cleanCedula = raw.replace(/\D/g, "");
    if (!cleanCedula) {
      const error = new Error("Debe ingresar un número de documento de identidad válido.");
      error.statusCode = 400;
      error.isOperational = true;
      throw error;
    }
    searchIdentifier = cleanCedula;
  }

  const result = await Auth.getUser(searchIdentifier);
  if (result.error || !result.data) {
    const error = new Error("Credenciales inválidas.");
    error.statusCode = 401;
    error.isOperational = true;
    throw error;
  }

  const user = result.data;
  const isMatch = await bcrypt.compare(password, user.CLAVE);
  if (!isMatch) {
    const error = new Error("Credenciales inválidas.");
    error.statusCode = 401;
    error.isOperational = true;
    throw error;
  }

  const userData = {
    username: user.CODUSU,
    nombre: user.NOMUSU,
    role: user.CODPERFIL,
    email: user.EMAIL,
  };

  if (user.CAMBIOCLV === "S") {
    // Emite token temporal de 5m con alcance de cambio de contraseña
    const tempToken = generateUserToken(user, "5m");
    return {
      requireChange: true,
      token: tempToken,
      expiresIn: 300,
      user: userData,
      message: "Debe actualizar su contraseña obligatoriamente.",
    };
  }

  const token = generateUserToken(user);

  return {
    requireChange: false,
    token,
    expiresIn: getExpiresInSeconds(),
    user: userData,
    message: "Acceso exitoso.",
  };
};

export const refreshToken = async ({ userPayload, currentToken }) => {
  if (!userPayload?.username) {
    const error = new Error("Datos de sesión inválidos.");
    error.statusCode = 401;
    error.isOperational = true;
    throw error;
  }

  const result = await Auth.getUser(userPayload.username);
  if (result.error || !result.data) {
    const error = new Error("Usuario inactivo o no encontrado.");
    error.statusCode = 401;
    error.isOperational = true;
    throw error;
  }

  const user = result.data;
  if (currentToken && userPayload.exp) {
    revokeToken(currentToken, userPayload.exp);
  }

  const newToken = generateUserToken(user);

  return {
    token: newToken,
    expiresIn: getExpiresInSeconds(),
    user: {
      username: user.CODUSU,
      nombre: user.NOMUSU,
      role: user.CODPERFIL,
      email: user.EMAIL,
    },
    message: "Token renovado exitosamente.",
  };
};

export const getCurrentUser = async (username) => {
  if (!username) {
    const error = new Error("Usuario no identificado en la sesión.");
    error.statusCode = 400;
    error.isOperational = true;
    throw error;
  }

  const result = await Auth.getUser(username);
  if (result.error || !result.data) {
    const error = new Error("Usuario no encontrado.");
    error.statusCode = 404;
    error.isOperational = true;
    throw error;
  }

  const user = result.data;
  return {
    username: user.CODUSU,
    nombre: user.NOMUSU,
    role: user.CODPERFIL,
    email: user.EMAIL,
    requireChange: user.CAMBIOCLV === "S",
    status: user.STSUSU,
  };
};

export const changeUserPassword = async ({
  username,
  currentPassword,
  newPassword,
}) => {
  if (!username || !currentPassword || !newPassword) {
    const error = new Error(
      "Debe suministrar usuario, contraseña actual y nueva contraseña.",
    );
    error.statusCode = 400;
    error.isOperational = true;
    throw error;
  }

  if (typeof newPassword !== "string" || newPassword.length < 8) {
    const error = new Error(
      "La nueva contraseña debe tener al menos 8 caracteres.",
    );
    error.statusCode = 400;
    error.isOperational = true;
    throw error;
  }

  const result = await Auth.getUser(username);
  if (result.error || !result.data) {
    const error = new Error("Usuario no encontrado.");
    error.statusCode = 404;
    error.isOperational = true;
    throw error;
  }

  const user = result.data;
  const isMatch = await bcrypt.compare(currentPassword, user.CLAVE);
  if (!isMatch) {
    const error = new Error("La contraseña actual es incorrecta.");
    error.statusCode = 401;
    error.isOperational = true;
    throw error;
  }

  await validateNewPassword(newPassword, user);

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(newPassword, salt);

  const updateResult = await Auth.updatePassword(username, hashedPassword, {
    requireChange: false,
  });
  if (updateResult.error || !updateResult.success) {
    const error = new Error(
      updateResult.error || "No se pudo actualizar la contraseña.",
    );
    error.statusCode = 500;
    error.isOperational = true;
    throw error;
  }

  return { message: "Clave actualizada exitosamente." };
};

export const setPasswordFromSession = async ({
  username,
  newPassword,
  currentToken,
  currentTokenExp,
}) => {
  if (!username || !newPassword) {
    const error = new Error("La nueva contraseña es requerida.");
    error.statusCode = 400;
    error.isOperational = true;
    throw error;
  }

  if (typeof newPassword !== "string" || newPassword.length < 8) {
    const error = new Error(
      "La nueva contraseña debe tener al menos 8 caracteres.",
    );
    error.statusCode = 400;
    error.isOperational = true;
    throw error;
  }

  const result = await Auth.getUser(username);
  if (result.error || !result.data) {
    const error = new Error("Usuario no encontrado.");
    error.statusCode = 404;
    error.isOperational = true;
    throw error;
  }

  const user = result.data;
  await validateNewPassword(newPassword, user);
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(newPassword, salt);

  const updateResult = await Auth.updatePassword(username, hashedPassword, {
    requireChange: false,
    status: "ACT",
  });

  if (updateResult.error || !updateResult.success) {
    const error = new Error(
      updateResult.error || "No se pudo actualizar la contraseña.",
    );
    error.statusCode = 500;
    error.isOperational = true;
    throw error;
  }

  // Invalida el token temporal previo
  if (currentToken && currentTokenExp) {
    revokeToken(currentToken, currentTokenExp);
  }

  // Emite token definitivo de sesión normal
  const updatedUser = { ...user, CAMBIOCLV: "N" };
  const newToken = generateUserToken(updatedUser);

  return {
    token: newToken,
    expiresIn: getExpiresInSeconds(),
    message: "Contraseña establecida exitosamente.",
  };
};

export const createUserByAdmin = async ({
  username,
  nombre,
  role = "ASEGURADO",
  email,
  tempPassword,
}) => {
  if (!username || !nombre) {
    const error = new Error("Los campos username y nombre son obligatorios.");
    error.statusCode = 400;
    error.isOperational = true;
    throw error;
  }

  const cleanUsername = String(username).trim().toUpperCase();
  const existing = await Auth.getUser(cleanUsername, { onlyActive: false });
  if (existing?.data) {
    const error = new Error(
      `El usuario '${cleanUsername}' ya existe en el sistema.`,
    );
    error.statusCode = 400;
    error.isOperational = true;
    throw error;
  }

  let finalTempPassword = tempPassword;
  if (
    !finalTempPassword ||
    typeof finalTempPassword !== "string" ||
    finalTempPassword.trim().length === 0
  ) {
    const chars =
      "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$";
    let generated = "";
    for (let i = 0; i < 10; i++) {
      generated += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    finalTempPassword = generated;
  } else if (finalTempPassword.length < 6) {
    const error = new Error(
      "La contraseña temporal debe tener al menos 6 caracteres.",
    );
    error.statusCode = 400;
    error.isOperational = true;
    throw error;
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(finalTempPassword, salt);

  const createResult = await Auth.createUser({
    username: cleanUsername,
    nombre: nombre.trim(),
    hashedPassword,
    role: (role || "ASEGURADO").toUpperCase(),
    email: email ? email.trim() : null,
    requireChange: true,
  });

  if (createResult.error || !createResult.success) {
    const error = new Error(
      createResult.error || "No se pudo crear el usuario en la base de datos.",
    );
    error.statusCode = 500;
    error.isOperational = true;
    throw error;
  }

  return {
    username: cleanUsername,
    nombre: nombre.trim(),
    role: (role || "ASEGURADO").toUpperCase(),
    email: email ? email.trim() : null,
    tempPassword: finalTempPassword,
    message: "Usuario creado exitosamente con clave temporal.",
  };
};

export const adminResetPassword = async ({ targetUsername, tempPassword }) => {
  if (!targetUsername) {
    const error = new Error("El campo targetUsername es requerido.");
    error.statusCode = 400;
    error.isOperational = true;
    throw error;
  }

  const result = await Auth.getUser(targetUsername);
  if (result.error || !result.data) {
    const error = new Error("Usuario destino no encontrado.");
    error.statusCode = 404;
    error.isOperational = true;
    throw error;
  }

  let finalTempPassword = tempPassword;
  if (
    !finalTempPassword ||
    typeof finalTempPassword !== "string" ||
    finalTempPassword.trim().length === 0
  ) {
    const chars =
      "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$";
    let generated = "";
    for (let i = 0; i < 10; i++) {
      generated += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    finalTempPassword = generated;
  } else if (finalTempPassword.length < 6) {
    const error = new Error(
      "La contraseña temporal debe tener al menos 6 caracteres.",
    );
    error.statusCode = 400;
    error.isOperational = true;
    throw error;
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(finalTempPassword, salt);

  // Se actualiza con requireChange: true (CAMBIOCLV = 'S')
  const updateResult = await Auth.updatePassword(
    targetUsername,
    hashedPassword,
    {
      requireChange: true,
      status: "ACT",
    },
  );

  if (updateResult.error || !updateResult.success) {
    const error = new Error(
      updateResult.error || "No se pudo resetear la contraseña del usuario.",
    );
    error.statusCode = 500;
    error.isOperational = true;
    throw error;
  }

  return {
    targetUsername,
    tempPassword: finalTempPassword,
    message:
      "Contraseña reseteada exitosamente. El usuario deberá cambiarla obligatoriamente al iniciar sesión.",
  };
};

export const emergencyOverridePassword = async ({ username, newPassword }) => {
  if (!username || !newPassword) {
    const error = new Error(
      "Los campos username y newPassword son requeridos.",
    );
    error.statusCode = 400;
    error.isOperational = true;
    throw error;
  }

  if (typeof newPassword !== "string" || newPassword.length < 6) {
    const error = new Error(
      "La nueva contraseña debe tener al menos 6 caracteres.",
    );
    error.statusCode = 400;
    error.isOperational = true;
    throw error;
  }

  const result = await Auth.getUser(username);
  if (result.error || !result.data) {
    const error = new Error("Usuario no encontrado.");
    error.statusCode = 404;
    error.isOperational = true;
    throw error;
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(newPassword, salt);

  // Override de emergencia restaura cuenta activa y clave vigente
  const updateResult = await Auth.updatePassword(username, hashedPassword, {
    requireChange: false,
    status: "ACT",
  });

  if (updateResult.error || !updateResult.success) {
    const error = new Error(
      updateResult.error || "No se pudo actualizar la contraseña.",
    );
    error.statusCode = 500;
    error.isOperational = true;
    throw error;
  }

  return {
    username,
    message:
      "Contraseña actualizada exitosamente vía llave maestra de emergencia.",
  };
};

export const requestPasswordReset = async (identifier) => {
  if (
    !identifier ||
    typeof identifier !== "string" ||
    identifier.trim().length === 0
  ) {
    const error = new Error(
      "Debe suministrar su correo electrónico o usuario.",
    );
    error.statusCode = 400;
    error.isOperational = true;
    throw error;
  }

  const cleanIdentifier = identifier.trim().toLowerCase();
  const now = Date.now();

  // 1. Verificar si el identificador ingresado está en período de enfriamiento (Cooldown)
  const existingCooldown = accountCooldowns.get(cleanIdentifier);
  if (existingCooldown && now < existingCooldown) {
    const remainingSeconds = Math.max(1, Math.ceil((existingCooldown - now) / 1000));
    console.warn(`🛑 [RateLimiter Cooldown] Solicitud bloqueada para '${cleanIdentifier}'. Cooldown activo por ${remainingSeconds}s.`);
    const error = new Error(
      `Ya se ha solicitado un enlace recientemente. Por favor espere ${remainingSeconds} segundos antes de solicitar otro envío.`
    );
    error.statusCode = 429;
    error.isOperational = true;
    error.retryAfter = remainingSeconds;
    throw error;
  }

  const result = await Auth.getUser(cleanIdentifier);

  // Mitigación de enumeración de cuentas: si no existe, registrar cooldown y retornar mensaje neutro
  if (!result?.data) {
    accountCooldowns.set(cleanIdentifier, now + getCooldownDurationMs());
    return {
      status: true,
      message:
        "Si los datos coinciden con un usuario registrado, hemos enviado un enlace de recuperación a su correo.",
    };
  }

  const user = result.data;
  const recipientEmail = (
    user.EMAIL || (cleanIdentifier.includes("@") ? cleanIdentifier : null)
  )?.toLowerCase();

  if (!recipientEmail) {
    const error = new Error(
      "El usuario no tiene una dirección de correo electrónico registrada para recuperar el acceso. Contacte al administrador.",
    );
    error.statusCode = 400;
    error.isOperational = true;
    throw error;
  }

  // 2. Verificar si el correo destino resuelto también está en período de enfriamiento
  const emailCooldown = accountCooldowns.get(recipientEmail);
  if (emailCooldown && now < emailCooldown) {
    const remainingSeconds = Math.max(1, Math.ceil((emailCooldown - now) / 1000));
    console.warn(`🛑 [RateLimiter Cooldown] Solicitud bloqueada para '${recipientEmail}'. Cooldown activo por ${remainingSeconds}s.`);
    const error = new Error(
      `Ya se ha enviado un correo recientemente a esta cuenta. Por favor espere ${remainingSeconds} segundos antes de solicitar otro envío.`
    );
    error.statusCode = 429;
    error.isOperational = true;
    error.retryAfter = remainingSeconds;
    throw error;
  }

  // Token JWT con expiración de 72 horas exclusivo para recuperación de contraseña
  const resetToken = jwt.sign(
    {
      username: user.CODUSU,
      email: recipientEmail,
      purpose: "password_reset",
    },
    getJwtSecret(),
    { expiresIn: "72h" },
  );

  // Registrar cooldown tanto para el identificador como para el correo resuelto y el nombre de usuario
  const cooldownExpiresAt = now + getCooldownDurationMs();
  accountCooldowns.set(cleanIdentifier, cooldownExpiresAt);
  accountCooldowns.set(recipientEmail, cooldownExpiresAt);
  if (user.CODUSU) {
    accountCooldowns.set(String(user.CODUSU).trim().toLowerCase(), cooldownExpiresAt);
  }

  await sendPasswordResetEmail({
    to: recipientEmail,
    nombre: user.NOMUSU,
    resetToken,
  });

  return {
    status: true,
    message:
      "Se ha enviado un enlace de recuperación a su correo electrónico. Válido por 72 horas.",
  };
};

export const verifyResetToken = async (token) => {
  if (!token) {
    const error = new Error("Token de recuperación no suministrado.");
    error.statusCode = 400;
    error.isOperational = true;
    throw error;
  }

  if (isTokenRevoked(token)) {
    const error = new Error(
      "El enlace de recuperación ya ha sido utilizado o ha sido invalidado.",
    );
    error.statusCode = 401;
    error.isOperational = true;
    throw error;
  }

  let decoded;
  try {
    decoded = jwt.verify(token, getJwtSecret());
  } catch (err) {
    const error = new Error(
      "El enlace de recuperación es inválido o ha expirado (más de 72 horas).",
    );
    error.statusCode = 401;
    error.isOperational = true;
    throw error;
  }

  if (decoded.purpose !== "password_reset") {
    const error = new Error(
      "El token proporcionado no corresponde a una recuperación de contraseña.",
    );
    error.statusCode = 401;
    error.isOperational = true;
    throw error;
  }

  const result = await Auth.getUser(decoded.username);
  if (!result?.data) {
    const error = new Error("Usuario no encontrado.");
    error.statusCode = 404;
    error.isOperational = true;
    throw error;
  }

  const user = result.data;
  return {
    valid: true,
    username: user.CODUSU,
    nombre: user.NOMUSU,
    email: user.EMAIL,
  };
};

export const resetPasswordWithToken = async ({ token, newPassword }) => {
  if (!token || !newPassword) {
    const error = new Error(
      "El token de recuperación y la nueva contraseña son requeridos.",
    );
    error.statusCode = 400;
    error.isOperational = true;
    throw error;
  }

  if (typeof newPassword !== "string" || newPassword.length < 8) {
    const error = new Error(
      "La nueva contraseña debe tener al menos 8 caracteres.",
    );
    error.statusCode = 400;
    error.isOperational = true;
    throw error;
  }

  if (isTokenRevoked(token)) {
    const error = new Error(
      "Este enlace de recuperación ya ha sido utilizado.",
    );
    error.statusCode = 401;
    error.isOperational = true;
    throw error;
  }

  let decoded;
  try {
    decoded = jwt.verify(token, getJwtSecret());
  } catch (err) {
    const error = new Error(
      "El enlace de recuperación es inválido o ha expirado.",
    );
    error.statusCode = 401;
    error.isOperational = true;
    throw error;
  }

  if (decoded.purpose !== "password_reset") {
    const error = new Error(
      "El token no es válido para recuperación de contraseña.",
    );
    error.statusCode = 401;
    error.isOperational = true;
    throw error;
  }

  const result = await Auth.getUser(decoded.username);
  if (!result?.data) {
    const error = new Error("Usuario no encontrado.");
    error.statusCode = 404;
    error.isOperational = true;
    throw error;
  }

  const user = result.data;
  await validateNewPassword(newPassword, user);
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(newPassword, salt);

  // Actualiza la contraseña y establece CAMBIOCLV = 'N'
  const updateResult = await Auth.updatePassword(user.CODUSU, hashedPassword, {
    requireChange: false,
    status: "ACT",
  });

  if (updateResult.error || !updateResult.success) {
    const error = new Error(
      updateResult.error || "No se pudo actualizar la contraseña.",
    );
    error.statusCode = 500;
    error.isOperational = true;
    throw error;
  }

  // Invalida el token de recuperación en el blocklist para que no pueda reutilizarse
  if (decoded.exp) {
    revokeToken(token, decoded.exp);
  }

  // Emite token de sesión normal definitivo
  const updatedUser = { ...user, CAMBIOCLV: "N" };
  const sessionToken = generateUserToken(updatedUser);

  return {
    token: sessionToken,
    expiresIn: getExpiresInSeconds(),
    user: {
      username: user.CODUSU,
      nombre: user.NOMUSU,
      role: user.CODPERFIL,
      email: user.EMAIL,
    },
    message: "Contraseña restablecida exitosamente. Sesión iniciada.",
  };
};

export default {
  loginUser,
  refreshToken,
  getCurrentUser,
  changeUserPassword,
  setPasswordFromSession,
  createUserByAdmin,
  adminResetPassword,
  emergencyOverridePassword,
  requestPasswordReset,
  verifyResetToken,
  resetPasswordWithToken,
};
