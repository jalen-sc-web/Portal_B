import Auth from '../db/Auth.js';
import jwt from 'jsonwebtoken';

const login = async (req, res) => {
    const result = await Auth.getUser(req.body);
    if (result.error || !result.data) {
        return res.status(401).send({ status: false, message: "Credenciales inválidas" });
    }

    const user = result.data;
    if (req.body.password !== user.CLAVE) {
        return res.status(401).send({ status: false, message: "Contraseña incorrecta" });
    }

    if (user.CAMBIOCLV === 'N') {
        return res.status(200).send({
            status: true,
            code: 201,
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
};

const changePassword = async (req, res) => {
    const { username, newPassword } = req.body;
    const result = await Auth.updatePassword(username, newPassword);
    if (result.error) return res.status(500).send({ status: false, message: result.error });
    res.status(200).send({ status: true, message: "Clave actualizada" });
};

export default { login, changePassword };