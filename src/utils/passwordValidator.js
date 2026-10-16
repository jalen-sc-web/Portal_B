import fs from 'fs';
import bcrypt from 'bcryptjs';

// Carga la lista negra de contraseñas en memoria (Set O(1))
let blacklistSet = new Set();
try {
  const jsonPath = new URL('../config/passwordBlacklist.json', import.meta.url);
  const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  blacklistSet = new Set(data.map(p => String(p).trim().toLowerCase()));
} catch (e) {
  console.warn("⚠️ No se pudo cargar passwordBlacklist.json:", e.message);
}

/**
 * Evalúa si una contraseña se encuentra o contiene una palabra de la lista negra.
 */
export const isBlacklisted = (password) => {
  const clean = String(password || '').toLowerCase().trim();
  if (!clean) return true;

  if (blacklistSet.has(clean)) return true;

  // Verifica si contiene términos prohibidos de 4+ caracteres
  for (const term of blacklistSet) {
    if (term.length >= 4 && clean.includes(term)) {
      return true;
    }
  }

  return false;
};

/**
 * Calcula el nivel de fortaleza de la clave (0: Insegura, 1: Débil, 2: Aceptable, 3: Buena, 4: Fuerte).
 */
export const calculatePasswordStrength = (password, context = {}) => {
  const pwd = String(password || '');
  if (!pwd || pwd.length < 8) {
    return { score: 0, label: 'Insegura', acceptable: false, feedback: 'Mínimo 8 caracteres requeridos.' };
  }

  const { username, email, nombre } = context;
  const pwdLower = pwd.toLowerCase();

  // Validación de datos personales
  if (username && username.length >= 3 && pwdLower.includes(String(username).toLowerCase())) {
    return { score: 0, label: 'Insegura', acceptable: false, feedback: 'No puede contener su nombre de usuario.' };
  }

  if (email && pwdLower.includes(String(email).split('@')[0].toLowerCase())) {
    return { score: 0, label: 'Insegura', acceptable: false, feedback: 'No puede contener su correo electrónico.' };
  }

  if (nombre) {
    const parts = String(nombre).toLowerCase().split(' ').filter(p => p.length >= 4);
    for (const part of parts) {
      if (pwdLower.includes(part)) {
        return { score: 0, label: 'Insegura', acceptable: false, feedback: 'No puede contener partes de su nombre.' };
      }
    }
  }

  // Validación de lista negra
  if (isBlacklisted(pwd)) {
    return { score: 0, label: 'Insegura', acceptable: false, feedback: 'Contraseña demasiado predecible o de uso común.' };
  }

  let points = 0;
  if (pwd.length >= 8) points++;
  if (pwd.length >= 10) points++;
  if (pwd.length > 24) points++;
  if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) points++;
  if (/[0-9]/.test(pwd)) points++;
  if (/[^A-Za-z0-9]/.test(pwd)) points++;

  // Mapeo a escala 0-4
  // Puntos: 1-2 -> Débil (1), 3 -> Aceptable (2), 4 -> Buena (3), 5 -> Fuerte (4)
  let score = 1;
  let label = 'Débil';
  let acceptable = false;

  if (points >= 5) {
    score = 4;
    label = 'Fuerte';
    acceptable = true;
  } else if (points >= 4) {
    score = 3;
    label = 'Buena';
    acceptable = true;
  } else if (points >= 3) {
    score = 2;
    label = 'Aceptable';
    acceptable = true;
  }

  return { score, label, acceptable, feedback: acceptable ? '' : 'Combine mayúsculas, minúsculas, números o símbolos.' };
};

/**
 * Valida la fortaleza y la no repetición de contraseñas contra hash actual y hash previo.
 */
export const validateNewPassword = async (newPassword, user) => {
  if (!newPassword || typeof newPassword !== 'string') {
    const error = new Error('La nueva contraseña es requerida.');
    error.statusCode = 400;
    error.isOperational = true;
    throw error;
  }

  if (newPassword.length < 8) {
    const error = new Error('La nueva contraseña debe tener al menos 8 caracteres.');
    error.statusCode = 400;
    error.isOperational = true;
    throw error;
  }

  const strength = calculatePasswordStrength(newPassword, {
    username: user.CODUSU || user.username,
    email: user.EMAIL || user.email,
    nombre: user.NOMUSU || user.nombre
  });

  if (!strength.acceptable) {
    const error = new Error(strength.feedback || 'La contraseña es demasiado débil. Debe ser al menos de nivel Aceptable.');
    error.statusCode = 400;
    error.isOperational = true;
    throw error;
  }

  // 1. Validar que no sea igual a la contraseña actual (CLAVE)
  if (user.CLAVE) {
    const matchesCurrent = await bcrypt.compare(newPassword, user.CLAVE);
    if (matchesCurrent) {
      const error = new Error('La nueva contraseña no puede ser igual a su contraseña actual.');
      error.statusCode = 400;
      error.isOperational = true;
      throw error;
    }
  }

  // 2. Validar que no sea igual a la contraseña anterior (CLAVE_ANT)
  if (user.CLAVE_ANT) {
    const matchesPrev = await bcrypt.compare(newPassword, user.CLAVE_ANT);
    if (matchesPrev) {
      const error = new Error('No puede reutilizar su contraseña anterior por motivos de seguridad.');
      error.statusCode = 400;
      error.isOperational = true;
      throw error;
    }
  }

  return true;
};

export default {
  isBlacklisted,
  calculatePasswordStrength,
  validateNewPassword
};
