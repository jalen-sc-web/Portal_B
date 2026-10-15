import authService from '../services/authService.js';

const login = async (req, res, next) => {
    try {
        const { username, password } = req.body;
        const result = await authService.loginUser({ username, password });

        if (result.requireChange) {
            return res.status(200).json({
                status: true,
                requireChange: true,
                message: result.message
            });
        }

        return res.status(200).json({
            status: true,
            token: result.token,
            data: result.user,
            message: result.message
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
    changePassword,
    adminResetPassword,
    emergencyOverridePassword
};