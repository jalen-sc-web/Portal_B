import Auth from '../db/Auth.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const getJwtSecret = () => process.env.JWT_SECRET || 'secreto_constitucion';

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

    if (user.CAMBIOCLV === 'N') {
        return {
            requireChange: true,
            message: "Debe actualizar su contraseña obligatoriamente."
        };
    }

    const token = jwt.sign(
        { username: user.CODUSU, role: user.CODPERFIL },
        getJwtSecret(),
        { expiresIn: '8h' }
    );

    return {
        token,
        user: {
            username: user.CODUSU,
            nombre: user.NOMUSU,
            role: user.CODPERFIL
        },
        message: "Acceso exitoso."
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

    const updateResult = await Auth.updatePassword(username, hashedPassword);
    if (updateResult.error || !updateResult.success) {
        const error = new Error(updateResult.error || "No se pudo actualizar la contraseña.");
        error.statusCode = 500;
        error.isOperational = true;
        throw error;
    }

    return { message: "Clave actualizada exitosamente." };
};

export default {
    loginUser,
    changeUserPassword
};
