import { getAcselConnection, acselTable } from "../config/database.js";
import oracledb from "oracledb";
import { logger, serializeError } from "../utils/logger.js";

const executeCatalogQuery = async (sql, binds = {}) => {
  let connection;
  try {
    connection = await getAcselConnection();
    const result = await connection.execute(sql, binds, {
      outFormat: oracledb.OUT_FORMAT_OBJECT,
    });
    return { data: result.rows || [] };
  } catch (error) {
    logger.error("Error en consulta catálogo Acsel", "ValrepDB.executeCatalogQuery", { error: serializeError(error), sql });
    return { error: "Error en la base de datos al consultar catálogo", rawError: error };
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        logger.error("Error al cerrar conexión de catálogo", "ValrepDB.executeCatalogQuery", { error: serializeError(err) });
      }
    }
  }
};

const getCountry = async () => {
  const query = `
        SELECT "CODPAIS", "DESCPAIS"
        FROM ${acselTable('"PAIS"')}
        ORDER BY "CODPAIS"
    `;
  return executeCatalogQuery(query);
};

const getState = async ({ codpais }) => {
  const query = `
        SELECT "CODPAIS", "CODESTADO", "DESCESTADO"
        FROM ${acselTable('"ESTADO"')}
        WHERE "CODPAIS" = :codpais
        ORDER BY "CODESTADO"
    `;
  return executeCatalogQuery(query, { codpais });
};

const getCity = async ({ codpais, codestado }) => {
  const query = `
        SELECT "CODPAIS", "CODESTADO", "CODCIUDAD", "DESCCIUDAD"
        FROM ${acselTable('"CIUDAD"')}
        WHERE "CODPAIS" = :codpais AND "CODESTADO" = :codestado
        ORDER BY "CODCIUDAD"
    `;
  return executeCatalogQuery(query, { codpais, codestado });
};

const getMunicipality = async ({ codpais, codestado, codciudad }) => {
  const query = `
        SELECT "CODPAIS", "CODESTADO", "CODCIUDAD", "CODMUNICIPIO", "DESCMUNICIPIO"
        FROM ${acselTable('"MUNICIPIO"')}
        WHERE "CODPAIS" = :codpais AND "CODESTADO" = :codestado AND "CODCIUDAD" = :codciudad
        ORDER BY "CODMUNICIPIO"
    `;
  return executeCatalogQuery(query, { codpais, codestado, codciudad });
};

const getLval = async ({ tipolval }) => {
  const query = `
        SELECT CODLVAL, TRIM(DESCRIP) AS DESCRIP, TRIM(DESCRIP) AS DESCLVAL, TIPOLVAL
        FROM ${acselTable("LVAL")}
        WHERE TRIM(TIPOLVAL) = :tipolval
        ORDER BY CODLVAL
    `;
  return executeCatalogQuery(query, { tipolval });
};

const getParent = async ({ codprod } = {}) => {
  if (String(codprod || '').trim() === '1010') {
    const query = `
        SELECT DISTINCT lv.CODLVAL,
               TRIM(lv.DESCRIP) AS DESCRIP,
               MIN(pr.EDADINI) AS MIN_EDAD,
               MAX(pr.EDADFIN) AS MAX_EDAD,
               MAX(pr.MAXPARENT) AS MAX_PARENT
        FROM ${acselTable("PRIMA_COBERT_PROD")} pr
        JOIN ${acselTable("PLAN_PROD")} pp
          ON pp.CODPROD = pr.CODPROD
         AND pp.CODPLAN = pr.CODPLAN
         AND pp.REVPLAN = pr.REVPLAN
        JOIN ${acselTable('"LVAL"')} lv
          ON lv.TIPOLVAL = 'PARENT'
         AND lv.CODLVAL = pr.CODPARENT
        WHERE pr.CODPROD = '1010'
          AND pr.CODCOBERT = '1001'
          AND pp.STSPLAN = 'ACT'
          AND pp.FECFINVIG > SYSDATE
          AND pp.INDCOTIWEB = 'S'
          AND pp.INDTIPOPLAN = 'G'
        GROUP BY lv.CODLVAL, TRIM(lv.DESCRIP)
        ORDER BY lv.CODLVAL
    `;
    return executeCatalogQuery(query, {});
  }

  const query = `
        SELECT CODLVAL, DESCRIP
        FROM ${acselTable('"LVAL"')}
        WHERE TIPOLVAL = 'PARENT'
          AND CODLVAL IN ('0001', '0002', '0003', '0004', '0005', '0006', '0007', '0008')
        ORDER BY CODLVAL
    `;
  return executeCatalogQuery(query, {});
};

export default {
  getCountry,
  getState,
  getCity,
  getMunicipality,
  getLval,
  getParent
};
