import { getConnection } from "../config/database.js";
import oracledb from "oracledb";

const USER_TABLE = process.env.DB_USER_TABLE || "LOCALWEBPORTAL.USUARIO";

const getUser = async (username, { onlyActive = true } = {}) => {
  let connection;
  try {
    connection = await getConnection();

    let sql = `
            SELECT codusu, nomusu, clave, stsusu, cambioclv, codperfil
            FROM ${USER_TABLE}
            WHERE codusu = :username
        `;
    if (onlyActive) {
      sql += ` AND stsusu = 'ACT'`;
    }

    const result = await connection.execute(
      sql,
      { username },
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
  requireChange = true,
}) => {
  let connection;
  try {
    connection = await getConnection();
    const cambioclv = requireChange ? "S" : "N";
    const sql = `
            INSERT INTO ${USER_TABLE} (CODUSU, NOMUSU, CLAVE, STSUSU, CAMBIOCLV, CODPERFIL)
            VALUES (:username, :nombre, :hashedPassword, 'ACT', :cambioclv, :role)
        `;
    const result = await connection.execute(
      sql,
      { username, nombre, hashedPassword, cambioclv, role },
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
            SET CLAVE = :hashedPassword, CAMBIOCLV = :requireChange, STSUSU = :stsusu 
            WHERE CODUSU = :username
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
