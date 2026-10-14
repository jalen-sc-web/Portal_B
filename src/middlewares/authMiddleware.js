import jwt from 'jsonwebtoken';

const JWT_SECRET = 'fb221dc365f82f38a05a7522602b3b5f46939db219279b48c19ec0fa2b32b7fc';

export const verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Espera "Bearer TOKEN"

    if (!token) {
        return res.status(403).json({ message: "Token no proporcionado" });
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).json({ message: "Token inválido o expirado" });
        }
        req.user = decoded; // Guardamos los datos del usuario en la petición
        next(); // Continuamos al controlador
    });
};       