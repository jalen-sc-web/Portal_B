import { getConnection } from "../config/database.js";
import oracledb from "oracledb";

const USER_TABLE = process.env.DB_USER_TABLE || "LOCALWEBPORTAL.USUARIO";

const getUser = async (identifier, { onlyActive = true } = {}) => {
  let connection;
  try {
    connection = await getConnection();

    let sql = `
            SELECT codusu, nomusu, clave, clave_ant, stsusu, cambioclv, codperfil, email
            FROM ${USER_TABLE}
            WHERE (LOWER(codusu) = LOWER(:identifier) OR LOWER(email) = LOWER(:identifier))
        `;
    if (onlyActive) {
      sql += ` AND stsusu = 'ACT'`;
    }

    const result = await connection.execute(
      sql,
      { identifier: String(identifier).trim() },
      { outFormat: oracledb.OUT_FORMAT_OBJECT },
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

const createUser = async ({
  username,
  nombre,
  hashedPassword,
  role = "ASEGURADO",
  email = null,
  requireChange = true,
}) => {
  let connection;
  try {
    connection = await getConnection();
    const cambioclv = requireChange ? "S" : "N";
    const sql = `
            INSERT INTO ${USER_TABLE} (CODUSU, NOMUSU, CLAVE, CLAVE_ANT, STSUSU, CAMBIOCLV, CODPERFIL, EMAIL)
            VALUES (:username, :nombre, :hashedPassword, NULL, 'ACT', :cambioclv, :role, :email)
        `;
    const result = await connection.execute(
      sql,
      { username, nombre, hashedPassword, cambioclv, role, email },
      { autoCommit: true },
    );
    return { success: result.rowsAffected === 1 };
  } catch (err) {
    console.error("Error al crear usuario en Oracle Auth:", err);
    return { error: "Error en la base de datos al registrar usuario" };
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (e) {
        console.error("Error al cerrar conexión en createUser:", e);
      }
    }
  }
};

const updatePassword = async (username, hashedPassword, options = {}) => {
  let connection;
  try {
    connection = await getConnection();
    const requireChange = options.requireChange === true ? "S" : "N";
    const stsusu = options.status || "ACT";
    const sql = `
            UPDATE ${USER_TABLE} 
            SET CLAVE_ANT = CLAVE,
                CLAVE = :hashedPassword, 
                CAMBIOCLV = :requireChange, 
                STSUSU = :stsusu 
            WHERE LOWER(CODUSU) = LOWER(:username)
        `;
    const result = await connection.execute(
      sql,
      { username, hashedPassword, requireChange, stsusu },
      { autoCommit: true },
    );
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
  createUser,
  updatePassword,
};
