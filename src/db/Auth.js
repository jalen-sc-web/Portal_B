import { getConnection } from '../config/database.js';
import oracledb from 'oracledb';

const getUser = async (body) => {
    let connection;
    try {
        connection = await getConnection();
        
        const sql = `
            SELECT codusu, nomusu, clave, stsusu, cambioclv, codperfil
            FROM webamp.usuario_amp
            WHERE codusu = :username AND stsusu = 'ACT' AND clave = :password
        `;

        const result = await connection.execute(      
            sql, 
            {   username: body.username,
                password: body.password
            }, 
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        
        return { data: result.rows[0] || null };

    } catch (err) {
        console.error("Error Oracle Auth:", err);
        return { error: "Error en la base de datos al buscar usuario" };
    } finally {
        if (connection) {
            try { 
                await connection.close(); 
            } catch (e) { 
                console.error("Error al cerrar conexión:", e); 
            }
        }
    }
};

const updatePassword = async (username, newPassword) => {
    let connection;
    try {
        connection = await getConnection();
        const sql = `
            UPDATE webamp.usuario_amp 
            SET CLAVE = :newPassword, CAMBIOCLV = 'S' 
            WHERE CODUSU = :username
        `;
        await connection.execute(sql, { username, newPassword }, { autoCommit: true });
        return { success: true };
    } catch (err) {
        return { error: err.message };
    } finally {
        if (connection) await connection.close();
    }
};

export default { 
    getUser,
    updatePassword
};