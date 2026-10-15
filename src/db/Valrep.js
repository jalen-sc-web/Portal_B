import { getConnection } from '../config/database.js';
import oracledb from 'oracledb';

const executeCatalogQuery = async (sql, binds = {}) => {
    let connection;
    try {
        connection = await getConnection();
        const result = await connection.execute(sql, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT });
        return { data: result.rows || [] };
    } catch (error) {
        console.error("Error en consulta catálogo Acsel:", error);
        return { error: "Error en la base de datos al consultar catálogo" };
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (err) {
                console.error("Error al cerrar conexión de catálogo:", err);
            }
        }
    }
};

const getCountry = async () => {
    const query = `
        SELECT "CODPAIS", "DESCPAIS"
        FROM CONSSEG."PAIS"
        ORDER BY "CODPAIS"
    `;
    return executeCatalogQuery(query);
};

const getState = async ({ codpais }) => {
    const query = `
        SELECT "CODPAIS", "CODESTADO", "DESCESTADO"
        FROM CONSSEG."ESTADO"
        WHERE "CODPAIS" = :codpais
        ORDER BY "CODESTADO"
    `;
    return executeCatalogQuery(query, { codpais });
};

const getCity = async ({ codpais, codestado }) => {
    const query = `
        SELECT "CODPAIS", "CODESTADO", "CODCIUDAD", "DESCCIUDAD"
        FROM CONSSEG."CIUDAD"
        WHERE "CODPAIS" = :codpais AND "CODESTADO" = :codestado
        ORDER BY "CODCIUDAD"
    `;
    return executeCatalogQuery(query, { codpais, codestado });
};

const getMunicipality = async ({ codpais, codestado, codciudad }) => {
    const query = `
        SELECT "CODPAIS", "CODESTADO", "CODCIUDAD", "CODMUNICIPIO", "DESCMUNICIPIO"
        FROM CONSSEG."MUNICIPIO"
        WHERE "CODPAIS" = :codpais AND "CODESTADO" = :codestado AND "CODCIUDAD" = :codciudad
        ORDER BY "CODMUNICIPIO"
    `;
    return executeCatalogQuery(query, { codpais, codestado, codciudad });
};

const getLval = async ({ tipolval }) => {
    const query = `
        SELECT CODLVAL, DESCLVAL, TIPOLVAL, ABRLVAL
        FROM CONSSEG.LVAL
        WHERE TIPOLVAL = :tipolval
        ORDER BY CODLVAL
    `;
    return executeCatalogQuery(query, { tipolval });
};

export default {
    getCountry,
    getState,
    getCity,
    getMunicipality,
    getLval
};