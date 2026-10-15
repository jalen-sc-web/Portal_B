import Auth from '../db/Auth.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { revokeToken, getJwtSecret } from '../middlewares/authMiddleware.js';

const getJwtExpiresIn = () => process.env.JWT_EXPIRES_IN || '8h';

export const getExpiresInSeconds = () => {
    const str = getJwtExpiresIn();
    if (str.endsWith('h')) return parseInt(str, 10) * 3600;
    if (str.endsWith('m')) return parseInt(str, 10) * 60;
    if (str.endsWith('d')) return parseInt(str, 10) * 86400;
    return parseInt(str, 10) || 28800;
};

export const generateUserToken = (user, expiresIn = getJwtExpiresIn()) => {
    return jwt.sign(
        { 
            username: user.CODUSU || user.username, 
            role: user.CODPERFIL || user.role,
            requireChange: user.CAMBIOCLV === 'S' || user.requireChange === true
        },
        getJwtSecret(),
        { expiresIn }
    );
};

export const loginUser = async ({ username, password }) => {
    if (!username || !password) {
        const error = new Error("Usuario y contraseña son requeridos.");
        error.statusCode = 400;
        error.isOperational = true;
        throw error;
    }

    const result = await Auth.getUser(username);
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
        role: user.CODPERFIL
    };

    if (user.CAMBIOCLV === 'S') {
        // Emite token temporal de 15m con alcance de cambio de contraseña
        const tempToken = generateUserToken(user, '15m');
        return {
            requireChange: true,
            token: tempToken,
            expiresIn: 900,
            user: userData,
            message: "Debe actualizar su contraseña obligatoriamente."
        };
    }

    const token = generateUserToken(user);

    return {
        requireChange: false,
        token,
        expiresIn: getExpiresInSeconds(),
        user: userData,
        message: "Acceso exitoso."
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
            role: user.CODPERFIL
        },
        message: "Token renovado exitosamente."
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
        requireChange: user.CAMBIOCLV === 'S',
        status: user.STSUSU
    };
};

export const changeUserPassword = async ({ username, currentPassword, newPassword }) => {
    if (!username || !currentPassword || !newPassword) {
        const error = new Error("Debe suministrar usuario, contraseña actual y nueva contraseña.");
        error.statusCode = 400;
        error.isOperational = true;
        throw error;
    }

    if (typeof newPassword !== 'string' || newPassword.length < 6) {
        const error = new Error("La nueva contraseña debe tener al menos 6 caracteres.");
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

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    const updateResult = await Auth.updatePassword(username, hashedPassword, { requireChange: false });
    if (updateResult.error || !updateResult.success) {
        const error = new Error(updateResult.error || "No se pudo actualizar la contraseña.");
        error.statusCode = 500;
        error.isOperational = true;
        throw error;
    }

    return { message: "Clave actualizada exitosamente." };
};

export const setPasswordFromSession = async ({ username, newPassword, currentToken, currentTokenExp }) => {
    if (!username || !newPassword) {
        const error = new Error("La nueva contraseña es requerida.");
        error.statusCode = 400;
        error.isOperational = true;
        throw error;
    }

    if (typeof newPassword !== 'string' || newPassword.length < 6) {
        const error = new Error("La nueva contraseña debe tener al menos 6 caracteres.");
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
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    const updateResult = await Auth.updatePassword(username, hashedPassword, {
        requireChange: false,
        status: 'ACT'
    });

    if (updateResult.error || !updateResult.success) {
        const error = new Error(updateResult.error || "No se pudo actualizar la contraseña.");
        error.statusCode = 500;
        error.isOperational = true;
        throw error;
    }

    // Invalida el token temporal previo
    if (currentToken && currentTokenExp) {
        revokeToken(currentToken, currentTokenExp);
    }

    // Emite token definitivo de sesión normal
    const updatedUser = { ...user, CAMBIOCLV: 'N' };
    const newToken = generateUserToken(updatedUser);

    return {
        token: newToken,
        expiresIn: getExpiresInSeconds(),
        message: "Contraseña establecida exitosamente."
    };
};

export const createUserByAdmin = async ({ username, nombre, role = 'ASEGURADO', tempPassword }) => {
    if (!username || !nombre) {
        const error = new Error("Los campos username y nombre son obligatorios.");
        error.statusCode = 400;
        error.isOperational = true;
        throw error;
    }

    const cleanUsername = String(username).trim().toUpperCase();
    const existing = await Auth.getUser(cleanUsername, { onlyActive: false });
    if (existing?.data) {
        const error = new Error(`El usuario '${cleanUsername}' ya existe en el sistema.`);
        error.statusCode = 400;
        error.isOperational = true;
        throw error;
    }

    let finalTempPassword = tempPassword;
    if (!finalTempPassword || typeof finalTempPassword !== 'string' || finalTempPassword.trim().length === 0) {
        const chars = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$';
        let generated = '';
        for (let i = 0; i < 10; i++) {
            generated += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        finalTempPassword = generated;
    } else if (finalTempPassword.length < 6) {
        const error = new Error("La contraseña temporal debe tener al menos 6 caracteres.");
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
        role: (role || 'ASEGURADO').toUpperCase(),
        requireChange: true
    });

    if (createResult.error || !createResult.success) {
        const error = new Error(createResult.error || "No se pudo crear el usuario en la base de datos.");
        error.statusCode = 500;
        error.isOperational = true;
        throw error;
    }

    return {
        username: cleanUsername,
        nombre: nombre.trim(),
        role: (role || 'ASEGURADO').toUpperCase(),
        tempPassword: finalTempPassword,
        message: "Usuario creado exitosamente con clave temporal."
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
    if (!finalTempPassword || typeof finalTempPassword !== 'string' || finalTempPassword.trim().length === 0) {
        const chars = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$';
        let generated = '';
        for (let i = 0; i < 10; i++) {
            generated += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        finalTempPassword = generated;
    } else if (finalTempPassword.length < 6) {
        const error = new Error("La contraseña temporal debe tener al menos 6 caracteres.");
        error.statusCode = 400;
        error.isOperational = true;
        throw error;
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(finalTempPassword, salt);

    // Se actualiza con requireChange: true (CAMBIOCLV = 'S')
    const updateResult = await Auth.updatePassword(targetUsername, hashedPassword, {
        requireChange: true,
        status: 'ACT'
    });

    if (updateResult.error || !updateResult.success) {
        const error = new Error(updateResult.error || "No se pudo resetear la contraseña del usuario.");
        error.statusCode = 500;
        error.isOperational = true;
        throw error;
    }

    return {
        targetUsername,
        tempPassword: finalTempPassword,
        message: "Contraseña reseteada exitosamente. El usuario deberá cambiarla obligatoriamente al iniciar sesión."
    };
};

export const emergencyOverridePassword = async ({ username, newPassword }) => {
    if (!username || !newPassword) {
        const error = new Error("Los campos username y newPassword son requeridos.");
        error.statusCode = 400;
        error.isOperational = true;
        throw error;
    }

    if (typeof newPassword !== 'string' || newPassword.length < 6) {
        const error = new Error("La nueva contraseña debe tener al menos 6 caracteres.");
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
        status: 'ACT'
    });

    if (updateResult.error || !updateResult.success) {
        const error = new Error(updateResult.error || "No se pudo actualizar la contraseña.");
        error.statusCode = 500;
        error.isOperational = true;
        throw error;
    }

    return {
        username,
        message: "Contraseña actualizada exitosamente vía llave maestra de emergencia."
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
    emergencyOverridePassword
};
