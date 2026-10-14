import Auth from '../db/Auth.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const login = async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).send({ status: false, message: "Usuario y contraseña requeridos" });
        }

        const result = await Auth.getUser(username);
        if (result.error || !result.data) {
            return res.status(401).send({ status: false, message: "Credenciales inválidas" });
        }

        const user = result.data;
        const isMatch = await bcrypt.compare(password, user.CLAVE);
        if (!isMatch) {
            return res.status(401).send({ status: false, message: "Credenciales inválidas" });
        }

        if (user.CAMBIOCLV === 'N') {
            return res.status(200).send({
                status: true,
                requireChange: true,
                message: "Debe actualizar su contraseña"
            });
        }

        const token = jwt.sign(
            { username: user.CODUSU, role: user.CODPERFIL },
            process.env.JWT_SECRET || 'secreto_constitucion',
            { expiresIn: '8h' }
        );

        return res.status(200).send({
            status: true,
            token: token,
            data: { username: user.CODUSU, nombre: user.NOMUSU, role: user.CODPERFIL },
            message: "Acceso exitoso"
        });
    } catch (error) {
        console.error("Error en login:", error);
        return res.status(500).send({ status: false, message: "Ocurrió un error en el servidor" });
    }
};

const changePassword = async (req, res) => {
    try {
        const username = req.user?.username || req.body.username;
        const { currentPassword, newPassword } = req.body;

        if (!username || !currentPassword || !newPassword) {
            return res.status(400).send({ 
                status: false, 
                message: "Debe suministrar usuario, contraseña actual y nueva contraseña" 
            });
        }

        if (typeof newPassword !== 'string' || newPassword.length < 6) {
            return res.status(400).send({ 
                status: false, 
                message: "La nueva contraseña debe tener al menos 6 caracteres" 
            });
        }

        const result = await Auth.getUser(username);
        if (result.error || !result.data) {
            return res.status(404).send({ status: false, message: "Usuario no encontrado" });
        }

        const user = result.data;
        const isMatch = await bcrypt.compare(currentPassword, user.CLAVE);
        if (!isMatch) {
            return res.status(401).send({ status: false, message: "La contraseña actual es incorrecta" });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        const updateResult = await Auth.updatePassword(username, hashedPassword);
        if (updateResult.error || !updateResult.success) {
            return res.status(500).send({ 
                status: false, 
                message: updateResult.error || "No se pudo actualizar la contraseña" 
            });
        }

        return res.status(200).send({ status: true, message: "Clave actualizada exitosamente" });
    } catch (error) {
        console.error("Error en changePassword:", error);
        return res.status(500).send({ status: false, message: "Ocurrió un error en el servidor" });
    }
};

export default { login, changePassword };