import { getConnection } from '../config/database.js';
import oracledb from 'oracledb';

const getOwner = async (data) => {
    let connection;

    try {
        connection = await getConnection();

        let { tipoid, numid, dvid } = data;

        if (dvid == null || dvid === '' || dvid === undefined) { 
            dvid = 0;
        }

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
                CONSSEG.CLIENTE c
            JOIN
                CONSSEG.TERCERO t ON t.TIPOID = c.TIPOID AND t.NUMID = c.NUMID AND t.DVID = c.DVID
            LEFT JOIN
                CONSSEG.PAIS p ON p.CODPAIS = t.CODPAIS
            LEFT JOIN
                CONSSEG.ESTADO e ON e.CODESTADO = t.CODESTADO
            LEFT JOIN
                CONSSEG.CIUDAD ci ON ci.CODPAIS = t.CODPAIS AND ci.CODESTADO = t.CODESTADO AND ci.CODCIUDAD = t.CODCIUDAD
            LEFT JOIN
                CONSSEG.MUNICIPIO m ON m.CODPAIS = t.CODPAIS AND m.CODESTADO = t.CODESTADO AND m.CODCIUDAD = t.CODCIUDAD AND m.CODMUNICIPIO = t.CODMUNICIPIO
            LEFT JOIN
                CONSSEG.ZONA_POSTAL zp ON zp.ZONAPOSTAL = t.ZIP
            WHERE
                c.TIPOID = :tipoid AND c.NUMID = :numid AND c.DVID = :dvid
        `;

        const result = await connection.execute(
            query,
            { tipoid, numid, dvid },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        const owner = result.rows[0] || null;

        if (!owner) {
            return { status: false, data: null, message: "Titular no encontrado" };
        }

        return { status: true, data: owner, message: "Titular encontrado exitosamente." };

    } catch (error) {
        console.error('Error al obtener titular de Acsel:', error);
        return { status: false, error: "Error en la base de datos al consultar titular", message: "Error al obtener titular" };
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (closeErr) {
                console.error('Error al cerrar la conexión a Oracle en getOwner:', closeErr);
            }
        }
    }
};

export default {
    getOwner
};