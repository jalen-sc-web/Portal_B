import { getAcselConnection, acselTable } from "../config/database.js";
import oracledb from "oracledb";

/**
 * Consulta y extrae los roles asociados a una cédula en Acsel invocando la función PL/SQL
 * webportal.pr_portal.fn_devuelve_rol(p_tipoid, p_numid, p_dvid) que retorna un SYS_REFCURSOR.
 *
 * @param {Object} params
 * @param {string} params.tipoid - Tipo de documento ('V', 'E', 'J', 'G', etc.)
 * @param {string|number} params.numid - Número de cédula/identificación sin formato
 * @param {string|number} params.dvid - Dígito verificador (por defecto '0')
 * @returns {Promise<Array<string>>} Lista normalizada de nombres de rol (ej: ['TITULAR', 'INTERMEDIARIO'])
 */
const getRolesByCedula = async ({ tipoid = "V", numid, dvid = "0" }) => {
  let connection;
  const cleanTipoid = String(tipoid || "V")
    .trim()
    .toUpperCase();
  const cleanNumId = String(numid || "").trim();
  const cleanDvid = String(dvid ?? "0").trim();

  console.log(
    `[DB fn_devuelve_rol] ---> ENTRADA: tipoid='${cleanTipoid}', numid='${cleanNumId}', dvid='${cleanDvid}'`,
  );

  try {
    if (!cleanNumId) {
      console.warn(
        "[DB fn_devuelve_rol] numid vacío, retornando ['TITULAR'] por defecto",
      );
      return ["TITULAR"];
    }

    console.log(
      "[DB fn_devuelve_rol] 1. Obteniendo conexión de Acsel (JALEN)...",
    );
    connection = await getAcselConnection();
    console.log("[DB fn_devuelve_rol] 2. Conexión de Acsel establecida.");

    // Invocar la función PL/SQL que retorna SYS_REFCURSOR
    const sql = `
      BEGIN
        :cursor := webportal.pr_portal.fn_devuelve_rol(:tipoid, :numid, :dvid);
      END;
    `;

    const binds = {
      tipoid: cleanTipoid,
      numid: cleanNumId,
      dvid: cleanDvid,
      cursor: { type: oracledb.CURSOR, dir: oracledb.BIND_OUT },
    };

    console.log("[DB fn_devuelve_rol] 3. Ejecutando PL/SQL con binds:", {
      tipoid: binds.tipoid,
      numid: binds.numid,
      dvid: binds.dvid,
    });

    const result = await connection.execute(sql, binds);
    const cursor = result.outBinds?.cursor;

    console.log(
      "[DB fn_devuelve_rol] 4. Ejecución completada. ¿Cursor recibido?:",
      !!cursor,
    );

    const rawRows = [];
    if (cursor) {
      let row;
      let count = 0;
      while ((row = await cursor.getRow())) {
        count++;
        rawRows.push(row);
        console.log(
          `[DB fn_devuelve_rol] Fila ${count} del cursor:`,
          JSON.stringify(row),
        );
        if (count > 500) {
          console.warn(
            "[DB fn_devuelve_rol] Límite de seguridad alcanzado al leer cursor de roles (500)",
          );
          break;
        }
      }
      console.log(
        `[DB fn_devuelve_rol] 5. Total filas leídas del cursor: ${count}`,
      );
      try {
        await cursor.close();
      } catch (closeCursorErr) {
        console.error(
          "[DB fn_devuelve_rol] Error al cerrar cursor de roles:",
          closeCursorErr,
        );
      }
    } else {
      console.warn(
        "[DB fn_devuelve_rol] El outBind cursor es nulo o indefinido.",
      );
    }

    // Extraer y normalizar los nombres de rol de las filas del cursor
    // Maneja tanto arreglos por posición como objetos con llaves diversas (ROL, COD_ROL, DESCRIPCION, etc.)
    const rolesSet = new Set();
    for (const r of rawRows) {
      if (typeof r === "string" && r.trim()) {
        rolesSet.add(r.trim().toUpperCase());
      } else if (r && typeof r === "object") {
        const val =
          r.ROL ||
          r.COD_ROL ||
          r.DESCRIPCION ||
          r.DESC_ROL ||
          r.TIPOCLI ||
          r.NOMBRE ||
          Object.values(r)[0];
        if (val && typeof val === "string" && val.trim()) {
          rolesSet.add(val.trim().toUpperCase());
        }
      }
    }

    // Si el set está vacío, asigna al menos el rol base ASEGURADO
    if (rolesSet.size === 0) {
      console.log(
        "[DB fn_devuelve_rol] Sin roles devueltos en cursor, asignando ['TITULAR']",
      );
      rolesSet.add("TITULAR");
    }

    const finalRoles = Array.from(rolesSet);
    console.log(`[DB fn_devuelve_rol] <--- SALIDA FINAL ROLES:`, finalRoles);
    return finalRoles;
  } catch (error) {
    console.error("[DB fn_devuelve_rol] ❌ ERROR en ejecución:", error);
    // Fallback de contingencia: no interrumpir el login si la función falla o no encuentra pólizas
    return ["TITULAR"];
  } finally {
    if (connection) {
      try {
        await connection.close();
        console.log(
          "[DB fn_devuelve_rol] Conexión de Acsel cerrada correctamente.",
        );
      } catch (closeErr) {
        console.error(
          "[DB fn_devuelve_rol] Error al cerrar conexión de Acsel:",
          closeErr,
        );
      }
    }
  }
};

const getOwner = async (data) => {
  let connection;

  try {
    connection = await getAcselConnection();

    let { tipoid, numid, dvid } = data;

    if (dvid == null || dvid === "" || dvid === undefined) {
      dvid = 0;
    }

    const clienteTbl = acselTable("CLIENTE");
    const terceroTbl = acselTable("TERCERO");
    const paisTbl = acselTable("PAIS");
    const estadoTbl = acselTable("ESTADO");
    const ciudadTbl = acselTable("CIUDAD");
    const municipioTbl = acselTable("MUNICIPIO");
    const zonaPostalTbl = acselTable("ZONA_POSTAL");

    const query = `
            SELECT
                c.NUMID, c.SEXO, c.FECNAC, c.TIPOID, c.CODCLI, c.TIPOCLI, c.EDOCIVIL,
                t.NOMTER, t.APETER, t.DIREC, t.TELEF1, t.TELEF2, t.EMAIL,
                t.CODPAIS, p.DESCPAIS,
                t.CODESTADO, e.DESCESTADO,
                t.CODCIUDAD, ci.DESCCIUDAD,
                t.CODMUNICIPIO, m.DESCMUNICIPIO,
                t.INDNACIONAL, t.ZIP, zp.DESCZONAPOSTAL,
                t.INDACTCORREO, t.INDACTTLF, t.FECMODCORREO, t.FECMODTLF
            FROM
                ${clienteTbl} c
            JOIN
                ${terceroTbl} t ON t.TIPOID = c.TIPOID AND t.NUMID = c.NUMID AND t.DVID = c.DVID
            LEFT JOIN
                ${paisTbl} p ON p.CODPAIS = t.CODPAIS
            LEFT JOIN
                ${estadoTbl} e ON e.CODESTADO = t.CODESTADO
            LEFT JOIN
                ${ciudadTbl} ci ON ci.CODPAIS = t.CODPAIS AND ci.CODESTADO = t.CODESTADO AND ci.CODCIUDAD = t.CODCIUDAD
            LEFT JOIN
                ${municipioTbl} m ON m.CODPAIS = t.CODPAIS AND m.CODESTADO = t.CODESTADO AND m.CODCIUDAD = t.CODCIUDAD AND m.CODMUNICIPIO = t.CODMUNICIPIO
            LEFT JOIN
                ${zonaPostalTbl} zp ON zp.ZONAPOSTAL = t.ZIP
            WHERE
                c.TIPOID = :tipoid AND c.NUMID = :numid AND c.DVID = :dvid
        `;

    const result = await connection.execute(
      query,
      { tipoid, numid, dvid },
      { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );

    const owner = result.rows[0] || null;

    if (!owner) {
      return { status: false, data: null, message: "Titular no encontrado" };
    }

    return {
      status: true,
      data: owner,
      message: "Titular encontrado exitosamente.",
    };
  } catch (error) {
    console.error("Error al obtener titular de Acsel:", error);
    return {
      status: false,
      error: "Error en la base de datos al consultar titular",
      message: "Error al obtener titular",
    };
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (closeErr) {
        console.error(
          "Error al cerrar la conexión a Oracle en getOwner:",
          closeErr,
        );
      }
    }
  }
};

export default {
  getOwner,
  getRolesByCedula,
};
