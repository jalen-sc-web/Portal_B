import { getAcselConnection, acselTable, getPortalConnection, portalTable } from "../config/database.js";
import oracledb from "oracledb";

/**
 * Consulta y extrae los roles asociados a una cédula en Acsel invocando la función PL/SQL
 * webportal.pr_portal.fn_devuelve_rol(p_tipoid, p_numid, p_dvid) que retorna un SYS_REFCURSOR.
 *
 * @param {Object} params
 * @param {string} params.tipoid - Tipo de documento ('V', 'E', 'J', 'G', etc.)
 * @param {string|number} params.numid - Número de cédula/identificación sin formato
 * @param {string|number} params.dvid - Dígito verificador (por defecto '0')
 * @returns {Promise<Array<string>>} Lista normalizada de nombres de rol (ej: ['ASEGURADO', 'INTERMEDIARIO'])
 */
const getRolesByCedula = async ({ tipoid = "V", numid, dvid = "0" }) => {
  let connection;
  let connectionPortal;
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
        "[DB fn_devuelve_rol] numid vacío, retornando ['ASEGURADO'] por defecto",
      );
      return ["ASEGURADO"];
    }

    console.log(
      "[DB fn_devuelve_rol] 1. Obteniendo conexión de Acsel (JALEN)...",
    );
    connection = await getAcselConnection();
    connectionPortal = await getPortalConnection();
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
        "[DB fn_devuelve_rol] Sin roles devueltos en cursor, asignando ['ASEGURADO']",
      );
      rolesSet.add("ASEGURADO");
    }

    // =========================================================================
    // BUSCAR EN LA TABLA ROLES DE WEBPORTAL PARA OBTENER EL CODROL Y EL NOMBRE OFICIAL
    // =========================================================================
    const rolesTable = portalTable("ROLES");
    const roleNamesArray = Array.from(rolesSet);

    const placeholders = roleNamesArray.map((_, index) => `:rName${index}`).join(", ");
    const roleBinds = {};
    roleNamesArray.forEach((name, index) => {
      roleBinds[`rName${index}`] = name;
    });

    const rolesQuery = `
      SELECT codrol, nombre 
      FROM ${rolesTable} 
      WHERE UPPER(nombre) IN (${placeholders})
        AND stsrol = 'ACT' -- O el estatus que maneje tu tabla de roles si aplica
    `;

    const rolesResult = await connectionPortal.execute(
      rolesQuery,
      roleBinds,
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    const dbRoles = rolesResult.rows || [];

    // Mapear los resultados obtenidos de la BD con codrol y nombre
    const finalRoles = dbRoles.map(row => ({
      codrol: Number(row.CODROL),
      nombre: String(row.NOMBRE).trim().toUpperCase()
    }));

    console.log(`[DB fn_devuelve_rol] <--- SALIDA FINAL ROLES:`, finalRoles);
    return finalRoles;
  } catch (error) {
    console.error("[DB fn_devuelve_rol] ❌ ERROR en ejecución:", error);
    // Fallback de contingencia: no interrumpir el login si la función falla o no encuentra pólizas
    return ["ASEGURADO"];
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

const getFullRate = async (data) => {
  let connection;

  try {
    connection = await getAcselConnection();

    let { familiares } = data; // Recibe la cadena formateada desde el service: '0001:25,0007:50'

    // ==========================================
    // 1. PRIMER CURSOR: OBTENER_TARIFA_COMPLETA
    // ==========================================
    const resultCompleta = await connection.execute(
      `BEGIN
         :cursor := WEBPORTAL.PR_PORTAL.OBTENER_TARIFA_COMPLETA(:familiares);
       END;`,
      {
        familiares: { val: familiares, type: oracledb.STRING },
        cursor: { type: oracledb.CURSOR, dir: oracledb.BIND_OUT }
      },
      {
        outFormat: oracledb.OUT_FORMAT_OBJECT
      }
    );

    const resultSetCompleta = resultCompleta.outBinds.cursor;
    // getRows() permite traer todas las filas de golpe de forma más eficiente (puedes pasarle un límite si son muchas, ej: getRows(100))
    const rowsCompleta = await resultSetCompleta.getRows();
    await resultSetCompleta.close();


    // ==========================================
    // 2. SEGUNDO CURSOR: OBTENER_TARIFA_INDIVIDUAL
    // ==========================================
    const resultIndividual = await connection.execute(
      `BEGIN
         :cursor := WEBPORTAL.PR_PORTAL.OBTENER_TARIFA_INDIVIDUAL(:familiares);
       END;`,
      {
        familiares: { val: familiares, type: oracledb.STRING },
        cursor: { type: oracledb.CURSOR, dir: oracledb.BIND_OUT }
      },
      {
        outFormat: oracledb.OUT_FORMAT_OBJECT
      }
    );

    const resultSetIndividual = resultIndividual.outBinds.cursor;
    const rowsIndividual = await resultSetIndividual.getRows();
    await resultSetIndividual.close();


    // ==========================================
    // VALIDACIONES Y RETORNO
    // ==========================================
    const hasDataCompleta = rowsCompleta && rowsCompleta.length > 0;
    const hasDataIndividual = rowsIndividual && rowsIndividual.length > 0;

    if (!hasDataCompleta && !hasDataIndividual) {
      return { 
        status: false, 
        data: { completa: [], individual: [] }, 
        message: "No se encontraron tarifas disponibles." 
      };
    }

    return {
      status: true,
      data: {
        completa: rowsCompleta,
        individual: rowsIndividual
      },
      message: "Tarifas obtenidas exitosamente.",
    };

  } catch (error) {
    console.error("Error al obtener tarifas completas e individuales:", error);
    return {
      status: false,
      error: "Error en la base de datos al consultar tarifas",
      message: "Error al obtener tarifas",
    };
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (closeErr) {
        console.error(
          "Error al cerrar la conexión a Oracle en getFullRate:",
          closeErr,
        );
      }
    }
  }
};

export const saveQuote = async (data) => {

  if (!data) {
    return { status: false, message: "EL PAYLOAD DE LA COTIZACIÓN ESTÁ VACÍO." };
  }

  const { codProd, prima, hcmPlan, asegurados, coberturas } = data;

  const nombreAseg = data.nombreAseg ? String(data.nombreAseg).toUpperCase() : '';
  const codUsuCrea = data.codUsuCrea ? String(data.codUsuCrea).toUpperCase() : 'PORTALASEG';

  if (!codProd) {
    return { status: false, message: "EL CÓDIGO DE PRODUCTO (CODPROD) ES OBLIGATORIO." };
  }
  if (!nombreAseg || nombreAseg.trim() === "") {
    return { status: false, message: "EL NOMBRE DEL ASEGURADO TITULAR ES OBLIGATORIO." };
  }
  if (prima === undefined || prima === null || isNaN(prima)) {
    return { status: false, message: "LA PRIMA TOTAL DE LA COTIZACIÓN ES INVÁLIDA O REQUERIDA." };
  }

  if (!hcmPlan || !hcmPlan.codPlan) {
    return { status: false, message: "LOS DATOS DEL PLAN HCM (HCMPLAN Y SU CODPLAN) SON OBLIGATORIOS." };
  }

  if (!Array.isArray(asegurados) || asegurados.length === 0) {
    return { status: false, message: "DEBE INCLUIR AL MENOS UN ASEGURADO EN LA COTIZACIÓN." };
  }

  if (!Array.isArray(coberturas) || coberturas.length === 0) {
    return { status: false, message: "LA COTIZACIÓN DEBE CONTENER EL DESGLOSE DE COBERTURAS." };
  }

  let connection;

  try {
    connection = await getPortalConnection();

    // 2. INSERTAR CABECERA EN WEBPORTAL.COTIZACIONES
    const insertCotizacionQuery = `
      INSERT INTO WEBPORTAL.COTIZACIONES (
        CODCOTI_REF, CODPROD, NOMBRE_ASEG, TELEFONO, EMAIL, 
        PRIMA, SUMA_ASEG, CODINTER, CODOFIEMI, STSCOT, FECHACREA, CODUSUCREA
      ) VALUES (
        'TEMP_REF', :codProd, :nombreAseg, :telefono, :email, 
        :prima, :sumaAseg, :codInter, :codOfiEmi, 'VAL', SYSTIMESTAMP, :codUsuCrea
      ) RETURNING CODCOTI INTO :codcoti
    `;

    const bindVarsCotizacion = {
      codProd,
      nombreAseg,
      telefono: data.telefono || null,
      email: data.email || null,
      prima,
      sumaAseg: data.sumaAseg || null,
      codInter: data.codInter || '000001',
      codOfiEmi: data.codOfiEmi || '100101',
      codUsuCrea,
      codcoti: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT }
    };

    const cotizacionRes = await connection.execute(insertCotizacionQuery, bindVarsCotizacion);
    const codCoti = cotizacionRes.outBinds.codcoti[0];

    // 3. ACTUALIZAR EL CODCOTI_REF COMBINANDO EL CODPROD + EL CODCOTI RECIÉN GENERADO
    const codCotiRef = `${codProd}-${codCoti}`;
    const updateRefQuery = `
      UPDATE WEBPORTAL.COTIZACIONES 
      SET CODCOTI_REF = :codCotiRef 
      WHERE CODCOTI = :codCoti
    `;
    await connection.execute(updateRefQuery, { codCotiRef, codCoti });

    // 4. INSERTAR DETALLE EN WEBPORTAL.COTIZACION_HCM
    const insertHcmQuery = `
      INSERT INTO WEBPORTAL.COTIZACION_HCM (
        CODCOTI, CODPROD, CODPLAN, REVPLAN, NOMBREPLAN, 
        PRIMA, SUMA_ASEG, DEDUCIBLE, FECHACREA, CODUSUCREA
      ) VALUES (
        :codCoti, :codProd, :codPlan, :revPlan, :nombrePlan, 
        :prima, :sumaAseg, :deducible, SYSTIMESTAMP, :codUsuCrea
      )
    `;
    await connection.execute(insertHcmQuery, {
      codCoti,
      codProd: hcmPlan.codProd || codProd,
      codPlan: hcmPlan.codPlan,
      revPlan: hcmPlan.revPlan || '01',
      nombrePlan: hcmPlan.nombrePlan ? String(hcmPlan.nombrePlan).toUpperCase() : null,
      prima: hcmPlan.prima,
      sumaAseg: hcmPlan.sumaAseg,
      deducible: hcmPlan.deducible !== undefined ? hcmPlan.deducible : null,
      codUsuCrea
    });

    // 5. INSERTAR ASEGURADOS / FAMILIARES MÚLTIPLES EN WEBPORTAL.COTIZACION_HCM_ASEG
    const insertAsegQuery = `
      INSERT INTO WEBPORTAL.COTIZACION_HCM_ASEG (
        CODCOTI, CODPARENT, EDAD, PRIMA, FECHACREA, CODUSUCREA
      ) VALUES (
        :codCoti, :codParent, :edad, :prima, SYSTIMESTAMP, :codUsuCrea
      )
    `;

    for (const fam of asegurados) {
      await connection.execute(insertAsegQuery, {
        codCoti,
        codParent: fam.codParent,
        edad: fam.edad,
        prima: fam.prima !== undefined ? fam.prima : 0,
        codUsuCrea
      });
    }

    // 6. INSERTAR COBERTURAS DEL PLAN EN WEBPORTAL.COTIZACION_HCM_COB
    const insertCobQuery = `
      INSERT INTO WEBPORTAL.COTIZACION_HCM_COB (
        CODCOTI, CODCOBERT, DESCCOBERT, SUMAASEG_COB, DEDUCIBLE, PRIMA_COB, FECHACREA, CODUSUCREA
      ) VALUES (
        :codCoti, :codCobert, :descCobert, :sumaAsegCob, :deducible, :primaCob, SYSTIMESTAMP, :codUsuCrea
      )
    `;

    for (const cob of coberturas) {
      await connection.execute(insertCobQuery, {
        codCoti,
        codCobert: cob.codCobert,
        descCobert: cob.descCobert ? String(cob.descCobert).toUpperCase() : null,
        sumaAsegCob: (cob.sumaAsegCob !== undefined && cob.sumaAsegCob !== null) ? cob.sumaAsegCob : null,
        deducible: (cob.deducible !== undefined && cob.deducible !== null) ? cob.deducible : null,
        primaCob: (cob.primaCob !== undefined && cob.primaCob !== null) ? cob.primaCob : null,
        codUsuCrea
      });
    }

    // COMMIT DE TODA LA TRANSACCIÓN ATÓMICA
    await connection.commit();

    return {
      status: true,
      data: {
        codCoti,
        codCotiRef
      },
      message: "COTIZACIÓN GUARDADA EXITOSAMENTE EN EL ESQUEMA WEBPORTAL."
    };

  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rbErr) {
        console.error("ERROR AL REALIZAR ROLLBACK EN SAVEQUOTE:", rbErr);
      }
    }
    console.error("ERROR AL GUARDAR LA COTIZACIÓN EN ORACLE:", error);
    return {
      status: false,
      error: "ERROR EN LA BASE DE DATOS AL REGISTRAR LA COTIZACIÓN",
      message: error.message || "ERROR AL PROCESAR LA COTIZACIÓN"
    };
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (closeErr) {
        console.error("ERROR AL CERRAR LA CONEXIÓN A ORACLE EN SAVEQUOTE:", closeErr);
      }
    }
  }
};

export default {
  getOwner,
  getRolesByCedula,
  getFullRate,
  saveQuote
};
