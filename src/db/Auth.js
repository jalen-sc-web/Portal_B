import { getPortalConnection, portalTable } from "../config/database.js";
import oracledb from "oracledb";

const getUser = async (identifier, { onlyActive = true } = {}) => {
  let connection;
  try {
    connection = await getPortalConnection();

    const clean = String(identifier || "").trim();
    const isAdmin = clean.toLowerCase() === "admin";
    const cleanDigits = clean.replace(/\D/g, "");

    let sql;
    const binds = {};
    const table = portalTable("USUARIO");

    if (isAdmin) {
      sql = `
            SELECT codusu, nomusu, clave, clave_ant, stsusu, cambioclv, codperfil, email
            FROM ${table}
            WHERE LOWER(codusu) = 'admin'
        `;
    } else if (clean.includes("@")) {
      sql = `
            SELECT codusu, nomusu, clave, clave_ant, stsusu, cambioclv, codperfil, email
            FROM ${table}
            WHERE LOWER(email) = LOWER(:cleanEmail)
        `;
      binds.cleanEmail = clean;
    } else {
      sql = `
            SELECT codusu, nomusu, clave, clave_ant, stsusu, cambioclv, codperfil, email
            FROM ${table}
            WHERE (
                LOWER(codusu) = LOWER(:clean)
                OR (LENGTH(:cleanDigits) > 0 AND REGEXP_REPLACE(codusu, '[^0-9]', '') = :cleanDigits)
            )
        `;
      binds.clean = clean;
      binds.cleanDigits = cleanDigits || clean;
    }

    if (onlyActive) {
      sql += ` AND stsusu = 'ACT'`;
    }

    const result = await connection.execute(
      sql,
      binds,
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
    connection = await getPortalConnection();
    const clean = String(username || "").trim();
    const isAdmin = clean.toLowerCase() === "admin";
    const finalUsername = isAdmin ? "admin" : clean.replace(/\D/g, "");
    const cambioclv = requireChange ? "S" : "N";
    const table = portalTable("USUARIO");
    const sql = `
            INSERT INTO ${table} (CODUSU, NOMUSU, CLAVE, CLAVE_ANT, STSUSU, CAMBIOCLV, CODPERFIL, EMAIL)
            VALUES (:username, :nombre, :hashedPassword, NULL, 'ACT', :cambioclv, :role, :email)
        `;
    const result = await connection.execute(
      sql,
      { username: finalUsername, nombre, hashedPassword, cambioclv, role, email },
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
    connection = await getPortalConnection();
    const clean = String(username || "").trim();
    const isAdmin = clean.toLowerCase() === "admin";
    const cleanDigits = clean.replace(/\D/g, "");
    const requireChange = options.requireChange === true ? "S" : "N";
    const stsusu = options.status || "ACT";
    const table = portalTable("USUARIO");

    let sql;
    const binds = { hashedPassword, requireChange, stsusu };

    if (isAdmin) {
      sql = `
            UPDATE ${table} 
            SET CLAVE_ANT = CLAVE,
                CLAVE = :hashedPassword, 
                CAMBIOCLV = :requireChange, 
                STSUSU = :stsusu 
            WHERE LOWER(CODUSU) = 'admin'
        `;
    } else {
      sql = `
            UPDATE ${table} 
            SET CLAVE_ANT = CLAVE,
                CLAVE = :hashedPassword, 
                CAMBIOCLV = :requireChange, 
                STSUSU = :stsusu 
            WHERE (
                LOWER(CODUSU) = LOWER(:clean)
                OR (LENGTH(:cleanDigits) > 0 AND REGEXP_REPLACE(CODUSU, '[^0-9]', '') = :cleanDigits)
            )
        `;
      binds.clean = clean;
      binds.cleanDigits = cleanDigits || clean;
    }

    const result = await connection.execute(
      sql,
      binds,
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
