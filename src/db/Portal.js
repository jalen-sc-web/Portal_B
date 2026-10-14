import { getConnection } from '../config/database.js';
import oracledb from 'oracledb';

const getOwner = async (data) => {
    let connection;

    try {
        connection = await getConnection();

        let { tipoid, numid, dvid } = data;

        if (dvid == null || dvid == '' || dvid == undefined) { 
            dvid = 0;
        }
        
        let owner = {};

        const clienteQuery = `
            SELECT
                NUMID, SEXO, FECNAC, TIPOID, CODCLI, TIPOCLI, EDOCIVIL
            FROM
                CONSSEG.CLIENTE
            WHERE
                TIPOID = :tipoid AND NUMID = :numid AND DVID = :dvid
        `;
        const clienteResult = await connection.execute(
            clienteQuery,
            { tipoid, numid, dvid },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        const cliente = clienteResult.rows[0] || null;

        if (!cliente) {
            console.log(`Titular no encontrado en CLIENTE para TIPOID: ${tipoid}, NUMID: ${numid}`);
            return { status: false, data: null, message: "Titular no encontrado" };
        }

        owner = cliente;

        const terceroQuery = `
            SELECT
                NOMTER, APETER, DIREC, TELEF1, TELEF2, EMAIL, CODPAIS, CODESTADO, CODCIUDAD, CODMUNICIPIO, INDNACIONAL, ZIP, TIPOID, NUMID,
                INDACTCORREO, INDACTTLF, FECMODCORREO, FECMODTLF
            FROM
                CONSSEG.TERCERO
            WHERE
                TIPOID = :tipoid AND NUMID = :numid AND DVID = :dvid
        `;
        const terceroResult = await connection.execute(terceroQuery, { tipoid, numid, dvid }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
        const tercero = terceroResult.rows[0] || {};

        if (!tercero.NUMID) {
            console.log(`Titular no encontrado en TERCERO para TIPOID: ${tipoid}, NUMID: ${numid}`);
            return { status: false, data: null, message: "Titular no encontrado." };
        }
        owner = { ...owner, ...tercero };

        if (tercero.CODPAIS) {
            const paisResult = await connection.execute(
                `SELECT DESCPAIS FROM CONSSEG.PAIS WHERE CODPAIS = :codpais`,
                { codpais: tercero.CODPAIS },
                { outFormat: oracledb.OUT_FORMAT_OBJECT }
            );
            owner = { ...owner, ...(paisResult.rows[0] || {}) };
        }

        if (tercero.CODESTADO) {
            const estadoResult = await connection.execute(
                `SELECT DESCESTADO FROM CONSSEG.ESTADO WHERE CODESTADO = :codestado`,
                { codestado: tercero.CODESTADO },
                { outFormat: oracledb.OUT_FORMAT_OBJECT }
            );
            owner = { ...owner, ...(estadoResult.rows[0] || {}) };
        }

        if (tercero.CODPAIS && tercero.CODESTADO && tercero.CODCIUDAD) {
            const ciudadResult = await connection.execute(
                `SELECT DESCCIUDAD FROM CONSSEG.CIUDAD WHERE CODPAIS = :codpais AND CODESTADO = :codestado AND CODCIUDAD = :codciudad`,
                { codpais: tercero.CODPAIS, codestado: tercero.CODESTADO, codciudad: tercero.CODCIUDAD },
                { outFormat: oracledb.OUT_FORMAT_OBJECT }
            );
            owner = { ...owner, ...(ciudadResult.rows[0] || {}) };
        }

        if (tercero.CODPAIS && tercero.CODESTADO && tercero.CODCIUDAD && tercero.CODMUNICIPIO) {
            const municipioResult = await connection.execute(
                `SELECT DESCMUNICIPIO FROM CONSSEG.MUNICIPIO WHERE CODPAIS = :codpais AND CODESTADO = :codestado AND CODCIUDAD = :codciudad AND CODMUNICIPIO = :codmunicipio`,
                { codpais: tercero.CODPAIS, codestado: tercero.CODESTADO, codciudad: tercero.CODCIUDAD, codmunicipio: tercero.CODMUNICIPIO },
                { outFormat: oracledb.OUT_FORMAT_OBJECT }
            );
            owner = { ...owner, ...(municipioResult.rows[0] || {}) };
        }
        
        if (tercero.ZIP) {
            const zonaPostalResult = await connection.execute(
                `SELECT DESCZONAPOSTAL FROM CONSSEG.ZONA_POSTAL WHERE ZONAPOSTAL = :zip`,
                { zip: tercero.ZIP },
                { outFormat: oracledb.OUT_FORMAT_OBJECT }
            );
            owner = { ...owner, ...(zonaPostalResult.rows[0] || {}) };
        }

        if (Object.keys(owner).length === 0) {
            return { status: false, data: null, message: "Titular no encontrado." };
        }

        return { status: true, data: owner, message: "Titular encontrado exitosamente." };

    } catch (error) {
        console.error('Error al obtener titular de Acsel:', error);
        return { status: false, error: error.message, message: "Error al obtener titular de Acsel." };
    } finally {
        if (connection) {
            try {
                await connection.close();
                console.log('Conexión a Oracle cerrada (devuelta al pool) para getOwnerAcsel.');
            } catch (closeErr) {
                console.error('Error al cerrar la conexión a Oracle en getOwnerAcsel:', closeErr);
            }
        }
    }
};

export default {
    getOwner
}