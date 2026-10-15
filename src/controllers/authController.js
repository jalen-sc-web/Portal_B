import authService from '../services/authService.js';
import { revokeToken } from '../middlewares/authMiddleware.js';

const login = async (req, res, next) => {
    try {
        const { username, password } = req.body;
        const result = await authService.loginUser({ username, password });

        return res.status(200).json({
            status: true,
            requireChange: result.requireChange,
            token: result.token,
            expiresIn: result.expiresIn,
            data: result.user,
            message: result.message
        });
    } catch (error) {
        next(error);
    }
};

const refreshToken = async (req, res, next) => {
    try {
        const result = await authService.refreshToken({
            userPayload: req.user,
            currentToken: req.token
        });

        return res.status(200).json({
            status: true,
            token: result.token,
            expiresIn: result.expiresIn,
            data: result.user,
            message: result.message
        });
    } catch (error) {
        next(error);
    }
};

const getMe = async (req, res, next) => {
    try {
        const result = await authService.getCurrentUser(req.user?.username);

        return res.status(200).json({
            status: true,
            data: result
        });
    } catch (error) {
        next(error);
    }
};

const logout = async (req, res, next) => {
    try {
        if (req.token) {
            revokeToken(req.token, req.user?.exp);
        }

        return res.status(200).json({
            status: true,
            message: "Sesión cerrada exitosamente. Token invalidado."
        });
    } catch (error) {
        next(error);
    }
};

const changePassword = async (req, res, next) => {
    try {
        const username = req.user?.username || req.body.username;
        const { currentPassword, newPassword } = req.body;

        const result = await authService.changeUserPassword({
            username,
            currentPassword,
            newPassword
        });

        return res.status(200).json({
            status: true,
            message: result.message
        });
    } catch (error) {
        next(error);
    }
};

const setPassword = async (req, res, next) => {
    try {
        const username = req.user?.username;
        const { newPassword } = req.body;

        const result = await authService.setPasswordFromSession({
            username,
            newPassword,
            currentToken: req.token,
            currentTokenExp: req.user?.exp
        });

        return res.status(200).json({
            status: true,
            token: result.token,
            expiresIn: result.expiresIn,
            message: result.message
        });
    } catch (error) {
        next(error);
    }
};

const forgotPassword = async (req, res, next) => {
    try {
        const identifier = req.body.email || req.body.identifier || req.body.username;
        const result = await authService.requestPasswordReset(identifier);

        return res.status(200).json({
            status: true,
            message: result.message
        });
    } catch (error) {
        next(error);
    }
};

const verifyResetToken = async (req, res, next) => {
    try {
        const token = req.body.token || req.query.token;
        const result = await authService.verifyResetToken(token);

        return res.status(200).json({
            status: true,
            data: result,
            message: "Token de recuperación válido."
        });
    } catch (error) {
        next(error);
    }
};

const resetPassword = async (req, res, next) => {
    try {
        const { token, newPassword } = req.body;
        const result = await authService.resetPasswordWithToken({ token, newPassword });

        return res.status(200).json({
            status: true,
            token: result.token,
            expiresIn: result.expiresIn,
            data: result.user,
            message: result.message
        });
    } catch (error) {
        next(error);
    }
};

const createUser = async (req, res, next) => {
    try {
        const { username, nombre, role, email, tempPassword } = req.body;
        const result = await authService.createUserByAdmin({
            username,
            nombre,
            role,
            email,
            tempPassword
        });

        return res.status(201).json({
            status: true,
            data: {
                username: result.username,
                nombre: result.nombre,
                role: result.role,
                email: result.email,
                tempPassword: result.tempPassword
            },
            message: result.message
        });
    } catch (error) {
        next(error);
    }
};

const adminResetPassword = async (req, res, next) => {
    try {
        const { targetUsername, tempPassword } = req.body;
        const result = await authService.adminResetPassword({ targetUsername, tempPassword });

        return res.status(200).json({
            status: true,
            targetUsername: result.targetUsername,
            tempPassword: result.tempPassword,
            message: result.message
        });
    } catch (error) {
        next(error);
    }
};

const emergencyOverridePassword = async (req, res, next) => {
    try {
        const { username, newPassword } = req.body;
        const result = await authService.emergencyOverridePassword({ username, newPassword });

        return res.status(200).json({
            status: true,
            username: result.username,
            message: result.message
        });
    } catch (error) {
        next(error);
    }
};

export default { 
    login, 
    refreshToken,
    getMe,
    logout,
    changePassword,
    setPassword,
    forgotPassword,
    verifyResetToken,
    resetPassword,
    createUser,
    adminResetPassword,
    emergencyOverridePassword
};