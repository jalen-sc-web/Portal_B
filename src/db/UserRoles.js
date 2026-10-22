import { getPortalConnection, portalTable } from "../config/database.js";
import oracledb from "oracledb";

/**
 * Obtiene el mapa maestro de roles desde la tabla WEBPORTAL.ROLES.
 * 
 * @param {oracledb.Connection} connection - Conexión activa a la BD del Portal
 * @returns {Promise<Map<string, number>>} Mapa de NOMBRE_ROL (uppercase) -> CODROL
 */
const getRolesMasterMap = async (connection) => {
  const rolesTable = portalTable("ROLES");
  const sql = `
    SELECT codrol, UPPER(TRIM(nombre)) AS nombre, stsrol
    FROM ${rolesTable}
    WHERE stsrol = 'ACT'
  `;

  const result = await connection.execute(sql, {}, { outFormat: oracledb.OUT_FORMAT_OBJECT });
  const map = new Map();
  for (const row of result.rows || []) {
    if (row.NOMBRE && row.CODROL != null) {
      map.set(row.NOMBRE, Number(row.CODROL));
    }
  }
  return map;
};

/**
 * Consulta los roles registrados en WEBPORTAL.ROL_USUARIOS para un usuario específico,
 * haciendo JOIN con WEBPORTAL.ROLES para retornar los nombres legibles de cada rol.
 * 
 * @param {string} codusu - Código de usuario (cédula o 'admin')
 * @returns {Promise<Array<{ CODROL_USU: number, CODROL: number, ROL: string, STSROL_USU: string }>>}
 */
const getUserRoles = async (codusu) => {
  let connection;
  try {
    connection = await getPortalConnection();
    const rolUsuariosTable = portalTable("ROL_USUARIOS");
    const rolesTable = portalTable("ROLES");
    const cleanUser = String(codusu || "").trim().toUpperCase();

    const sql = `
      SELECT ru.codrol_usu, ru.codrol, r.nombre AS rol, ru.stsrol_usu
      FROM ${rolUsuariosTable} ru
      INNER JOIN ${rolesTable} r ON r.codrol = ru.codrol
      WHERE UPPER(ru.codusu) = :codusu
    `;

    const result = await connection.execute(
      sql,
      { codusu: cleanUser },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    return result.rows || [];
  } catch (error) {
    if (error.message?.includes("ORA-00942")) {
      console.warn("[UserRoles] La tabla ROL_USUARIOS o ROLES aún no está creada en el esquema WEBPORTAL.");
    } else {
      console.error("[UserRoles] Error al consultar roles de usuario:", error.message);
    }
    return [];
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (e) {
        console.error("[UserRoles] Error al cerrar conexión en getUserRoles:", e);
      }
    }
  }
};

/**
 * Sincroniza los roles del usuario entre la fuente de la verdad (cursor Acsel) y la tabla WEBPORTAL.ROL_USUARIOS.
 * 
 * Reglas de sincronización:
 * 1. Mapea cada nombre de rol del cursor (ej. 'ASEGURADO', 'ADMIN') a su respectivo CODROL de WEBPORTAL.ROLES.
 * 2. Si un rol viene en cursorRoles pero no existe en ROL_USUARIOS: se inserta con STSROL_USU = 'ACT'.
 *    (CODROL_USU es IDENTITY autoincremental).
 * 3. Si un rol existe en ROL_USUARIOS con STSROL_USU != 'ACT' pero viene en cursorRoles: se reactiva a STSROL_USU = 'ACT', FECHAMOD = SYSTIMESTAMP.
 * 4. Si un rol existe en ROL_USUARIOS con STSROL_USU = 'ACT' pero NO viene en cursorRoles: se desactiva a STSROL_USU = 'INA', FECHAMOD = SYSTIMESTAMP.
 * 5. Retorna la lista consolidada de nombres de roles con status activo ('ACT').
 *
 * @param {string} codusu - Código de usuario (cédula o 'admin')
 * @param {Array<string>} cursorRoles - Roles devueltos por el cursor de Acsel (o ['ADMIN'] para admin)
 * @returns {Promise<Array<string>>} - Lista de nombres de rol activos finales del usuario
 */
const syncUserRoles = async (codusu, cursorRoles = []) => {
  const cleanUser = String(codusu || "").trim().toUpperCase();
  if (!cleanUser) {
    return cursorRoles.length > 0 ? cursorRoles : ["ASEGURADO"];
  }

  // Normalizar conjunto de roles que vienen del cursor
  const incomingRoleNames = Array.from(
    new Set(
      (Array.isArray(cursorRoles) ? cursorRoles : [])
        .map((r) => String(r || "").trim().toUpperCase())
        .filter(Boolean)
    )
  );

  let connection;
  try {
    connection = await getPortalConnection();
    const rolUsuariosTable = portalTable("ROL_USUARIOS");
    const rolesTable = portalTable("ROLES");

    // 1. Obtener catálogo maestro de roles para traducir Nombre <-> CODROL
    let rolesMasterMap;
    try {
      rolesMasterMap = await getRolesMasterMap(connection);
    } catch (tblErr) {
      if (tblErr.message?.includes("ORA-00942")) {
        console.warn("[UserRoles] Tabla ROLES no encontrada. Retornando roles directos del cursor.");
        return incomingRoleNames.length > 0 ? incomingRoleNames : ["ASEGURADO"];
      }
      throw tblErr;
    }

    // 2. Obtener los roles que tiene registrados el usuario en ROL_USUARIOS
    const selectSql = `
      SELECT ru.codrol_usu, ru.codrol, r.nombre AS rol, ru.stsrol_usu
      FROM ${rolUsuariosTable} ru
      INNER JOIN ${rolesTable} r ON r.codrol = ru.codrol
      WHERE UPPER(ru.codusu) = :codusu
    `;

    let currentDbRows = [];
    try {
      const result = await connection.execute(
        selectSql,
        { codusu: cleanUser },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      currentDbRows = result.rows || [];
    } catch (tblError) {
      if (tblError.message?.includes("ORA-00942")) {
        console.warn("[UserRoles] Tabla ROL_USUARIOS no encontrada en WEBPORTAL. Retornando roles directos del cursor.");
        return incomingRoleNames.length > 0 ? incomingRoleNames : ["ASEGURADO"];
      }
      throw tblError;
    }

    // Mapa de CODROL -> { codrol_usu, rolName, sts }
    const dbRolesMap = new Map();
    for (const row of currentDbRows) {
      const codrol = Number(row.CODROL);
      const rolName = String(row.ROL || "").trim().toUpperCase();
      const sts = String(row.STSROL_USU || "ACT").trim().toUpperCase();
      dbRolesMap.set(codrol, { codrol_usu: row.CODROL_USU, rolName, sts });
    }

    // 3. Determinar qué insertar, reactivar o desactivar
    const toInsert = [];     // { codrol, rolName }
    const toReactivate = []; // { codrol, rolName }
    const toDeactivate = []; // { codrol, rolName }

    // Revisar los roles que vienen del cursor
    for (const rolName of incomingRoleNames) {
      const codrol = rolesMasterMap.get(rolName);
      if (!codrol) {
        console.warn(`[UserRoles Sync] El rol '${rolName}' no existe en la tabla WEBPORTAL.ROLES.`);
        continue;
      }

      if (!dbRolesMap.has(codrol)) {
        toInsert.push({ codrol, rolName });
      } else {
        const existing = dbRolesMap.get(codrol);
        if (existing.sts !== "ACT") {
          toReactivate.push({ codrol, rolName });
        }
      }
    }

    // Revisar los roles que están en la BD pero ya no vienen en el cursor
    for (const [codrol, data] of dbRolesMap.entries()) {
      if (!incomingRoleNames.includes(data.rolName) && data.sts === "ACT") {
        toDeactivate.push({ codrol, rolName: data.rolName });
      }
    }

    console.log(
      `[UserRoles Sync] Usuario ${cleanUser} -> Insertar: [${toInsert.map(r => r.rolName)}], Reactivar: [${toReactivate.map(r => r.rolName)}], Desactivar: [${toDeactivate.map(r => r.rolName)}]`
    );

    // 4. Ejecutar las operaciones DML
    // Inserción (CODROL_USU es autoincremental/IDENTITY)
    for (const { codrol } of toInsert) {
      const insertSql = `
        INSERT INTO ${rolUsuariosTable} (
          codusu,
          codrol,
          stsrol_usu,
          codusucre,
          fechacrea
        ) VALUES (
          :codusu,
          :codrol,
          'ACT',
          'WEBPORTAL',
          SYSTIMESTAMP
        )
      `;
      await connection.execute(insertSql, { codusu: cleanUser, codrol });
    }

    // Reactivación
    for (const { codrol } of toReactivate) {
      const reactivateSql = `
        UPDATE ${rolUsuariosTable}
        SET stsrol_usu = 'ACT',
            codusumod = 'WEBPORTAL',
            fechamod = SYSTIMESTAMP
        WHERE UPPER(codusu) = :codusu AND codrol = :codrol
      `;
      await connection.execute(reactivateSql, { codusu: cleanUser, codrol });
    }

    // Desactivación
    for (const { codrol } of toDeactivate) {
      const deactivateSql = `
        UPDATE ${rolUsuariosTable}
        SET stsrol_usu = 'INA',
            codusumod = 'WEBPORTAL',
            fechamod = SYSTIMESTAMP
        WHERE UPPER(codusu) = :codusu AND codrol = :codrol
      `;
      await connection.execute(deactivateSql, { codusu: cleanUser, codrol });
    }

    if (toInsert.length > 0 || toReactivate.length > 0 || toDeactivate.length > 0) {
      await connection.commit();
    }

    // 5. Retornar los roles activos finales
    const finalActiveRoles = incomingRoleNames.filter(
      (name) => !toDeactivate.some((d) => d.rolName === name)
    );
    return finalActiveRoles.length > 0 ? finalActiveRoles : (incomingRoleNames.length > 0 ? incomingRoleNames : ["ASEGURADO"]);
  } catch (error) {
    console.error("[UserRoles Sync] Error durante la sincronización de roles:", error.message);
    if (connection) {
      try {
        await connection.rollback();
      } catch (rbErr) {
        console.error("[UserRoles Sync] Error en rollback:", rbErr);
      }
    }
    // Fallback de contingencia: no interrumpir el login
    return incomingRoleNames.length > 0 ? incomingRoleNames : ["ASEGURADO"];
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (closeErr) {
        console.error("[UserRoles Sync] Error al cerrar conexión:", closeErr);
      }
    }
  }
};

export default {
  getUserRoles,
  syncUserRoles,
};
