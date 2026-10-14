import jwt from 'jsonwebtoken';

const getJwtSecret = () => process.env.JWT_SECRET || 'secreto_constitucion';

export const verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ status: false, message: "Token no proporcionado o formato inválido" });
    }

    const token = authHeader.split(' ')[1];

    jwt.verify(token, getJwtSecret(), (err, decoded) => {
        if (err) {
            return res.status(401).json({ status: false, message: "Token inválido o expirado" });
        }
        req.user = decoded;
        next();
    });
};       