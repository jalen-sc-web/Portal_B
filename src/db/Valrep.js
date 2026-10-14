import { getConnection } from './../config/database.js';
import oracledb from 'oracledb';

const getCountry = async () => {
    let connection;
    try {
        connection = await getConnection();

        const query = `
            SELECT
                "CODPAIS",
                "DESCPAIS"
            FROM
                CONSSEG."PAIS"
            ORDER BY
                "CODPAIS"
        `;
        const result = await connection.execute(
            query,
            [],
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        return result.rows;

    } catch (error) {
        console.error("Error al obtener países:", error);
        return { error: error.message };
    } finally {
        if (connection) {
            try {
                await connection.close();
                console.log('Conexión a Oracle cerrada (devuelta al pool) para getCountry.');
            } catch (err) {
                console.error('Error al cerrar la conexión a Oracle en getCountry:', err);
            }
        }
    }
};

const getState = async (data) => {
    let connection;
    try {
        connection = await getConnection();

        const query = `
            SELECT
                "CODPAIS",
                "CODESTADO",
                "DESCESTADO"
            FROM
                CONSSEG."ESTADO"
            WHERE
                "CODPAIS" = :codpais
            ORDER BY
                "CODESTADO"
        `;
        const result = await connection.execute(
            query,
            { codpais: data.codpais },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        return result.rows;

    } catch (error) {
        console.error("Error al obtener estados:", error);
        return { error: error.message };
    } finally {
        if (connection) {
            try {
                await connection.close();
                console.log('Conexión a Oracle cerrada (devuelta al pool) para getState.');
            } catch (err) {
                console.error('Error al cerrar la conexión a Oracle en getState:', err);
            }
        }
    }
};

const getCity = async (data) => {
    let connection;
    try {
        connection = await getConnection();

        const query = `
            SELECT
                "CODPAIS",
                "CODESTADO",
                "CODCIUDAD",
                "DESCCIUDAD"
            FROM
                CONSSEG."CIUDAD"
            WHERE
                "CODPAIS" = :codpais
                AND "CODESTADO" = :codestado
            ORDER BY
                "CODCIUDAD"
        `;
        const result = await connection.execute(
            query,
            { codpais: data.codpais, codestado: data.codestado },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        return result.rows;

    } catch (error) {
        console.error("Error al obtener ciudades:", error);
        return { error: error.message };
    } finally {
        if (connection) {
            try {
                await connection.close();
                console.log('Conexión a Oracle cerrada (devuelta al pool) para getCity.');
            } catch (err) {
                console.error('Error al cerrar la conexión a Oracle en getCity:', err);
            }
        }
    }
};

const getMunicipality = async (data) => {
    let connection;
    try {
        connection = await getConnection();

        const query = `
            SELECT
                "CODPAIS",
                "CODESTADO",
                "CODCIUDAD",
                "CODMUNICIPIO",
                "DESCMUNICIPIO"
            FROM
                CONSSEG."MUNICIPIO"
            WHERE
                "CODPAIS" = :codpais
                AND "CODESTADO" = :codestado
                AND "CODCIUDAD" = :codciudad
            ORDER BY
                "CODMUNICIPIO"
        `;
        const result = await connection.execute(
            query,
            { codpais: data.codpais, codestado: data.codestado, codciudad: data.codciudad },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        return result.rows;

    } catch (error) {
        console.error("Error al obtener municipios:", error);
        return { error: error.message };
    } finally {
        if (connection) {
            try {
                await connection.close();
                console.log('Conexión a Oracle cerrada (devuelta al pool) para getMunicipality.');
            } catch (err) {
                console.error('Error al cerrar la conexión a Oracle en getMunicipality:', err);
            }
        }
    }
};

const getLval = async (data) => {
    console.log("getLval data:", data);
    
    let connection;
    try {
        connection = await getConnection();

        const query = `
            SELECT * FROM CONSSEG.LVAL WHERE TIPOLVAL = :tipolval
        `;
        const result = await connection.execute(
            query,
            { tipolval: data.tipolval },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        return result.rows;

    } catch (error) {
        console.error("Error al obtener lval:", error);
        return { error: error.message };
    } finally {
        if (connection) {
            try {
                await connection.close();
                console.log('Conexión a Oracle cerrada (devuelta al pool) para getLval.');
            } catch (err) {
                console.error('Error al cerrar la conexión a Oracle en getLval:', err);
            }
        }
    }
};

export default {
  getCountry,
  getState,
  getCity,
  getMunicipality,
  getLval
}