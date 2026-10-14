import { getConnection } from '../config/database.js';
import oracledb from 'oracledb';

const USER_TABLE = process.env.DB_USER_TABLE || 'WEBPORTAL.USUARIO';

const getUser = async (username) => {
    let connection;
    try {
        connection = await getConnection();
        
        const sql = `
            SELECT codusu, nomusu, clave, stsusu, cambioclv, codperfil
            FROM ${USER_TABLE}
            WHERE codusu = :username AND stsusu = 'ACT'
        `;

        const result = await connection.execute(      
            sql, 
            { username }, 
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

const updatePassword = async (username, hashedPassword) => {
    let connection;
    try {
        connection = await getConnection();
        const sql = `
            UPDATE ${USER_TABLE} 
            SET CLAVE = :hashedPassword, CAMBIOCLV = 'S' 
            WHERE CODUSU = :username
        `;
        const result = await connection.execute(sql, { username, hashedPassword }, { autoCommit: true });
        return { success: result.rowsAffected === 1 };
    } catch (err) {
        console.error("Error al actualizar clave:", err);
        return { error: "Error en la base de datos al actualizar la clave" };
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (e) {
                console.error("Error al cerrar conexión en updatePassword:", e);
            }
        }
    }
};

export default { 
    getUser,
    updatePassword
};