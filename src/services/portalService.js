import Portal from '../db/Portal.js';

export const getOwnerDetails = async ({ tipoid, numid, dvid }) => {
    if (!tipoid || !numid) {
        const error = new Error("Los campos tipoid y numid son requeridos.");
        error.statusCode = 400;
        error.isOperational = true;
        throw error;
    }

    const cleanDvid = (dvid == null || dvid === '' || dvid === undefined) ? 0 : dvid;

    const result = await Portal.getOwner({ tipoid, numid, dvid: cleanDvid });

    if (result.permissionError) {
        const error = new Error(result.permissionError);
        error.statusCode = 403;
        error.isOperational = true;
        throw error;
    }

    if (result.error) {
        const error = new Error(result.error);
        error.statusCode = 500;
        error.isOperational = true;
        throw error;
    }

    let tipocli;
    switch (tipoid) {
        case 'V':
        case 'E':
            tipocli = 'P';
            break;
        case 'G':
            tipocli = 'G';
            break;
        case 'M':
            tipocli = 'P';
            break;
        default:
            tipocli = 'E';
            break;
    }

    if (!result || !result.data) {
        return {
            found: false,
            data: {
                tipocli,
                indnacional: 'N',
                edocivil: 'S'
            },
            message: "No se encontró el titular con los datos proporcionados."
        };
    }

    const d = result.data;

    return {
        found: true,
        data: {
            numid,
            nomter: d.NOMTER ?? '',
            apeter: d.APETER ?? '', 
            direc: d.DIREC ?? null,
            email: (d.EMAIL ?? null)?.toLowerCase(),
            codpais: d.CODPAIS ?? '001',
            descpais: d.DESCPAIS ?? null,
            codestado: d.CODESTADO ?? null,
            descestado: d.DESCESTADO ?? null,
            codciudad: d.CODCIUDAD ?? null,
            descciudad: d.DESCCIUDAD ?? null,
            codmunicipio: d.CODMUNICIPIO ?? null,
            descmunicipio: d.DESCMUNICIPIO ?? null, 
            sexo: d.SEXO ?? null,
            fecnac: d.FECNAC ?? null,
            tipoid: d.TIPOID,
            indnacional: d.INDNACIONAL ?? 'N',
            edocivil: d.EDOCIVIL ?? 'S',
            titular: `${d.NOMTER ?? ''} ${d.APETER ?? ''}`.trim(), 
            zip: d.ZIP ?? null,
            zip_desc: d.DESCZONAPOSTAL ?? null,
            codcli: d.CODCLI ?? null,
            telef1: d.TELEF1 ?? null,
            telef2: d.TELEF2 ?? null,
            indactcorreo: d.INDACTCORREO ?? null,
            indacttlf: d.INDACTTLF ?? null,
            fecmodcorreo: d.FECMODCORREO ?? null,
            fecmodtlf: d.FECMODTLF ?? null,
            tipocli,
            dvid: cleanDvid
        },
        message: "Titular obtenido exitosamente."
    };
};

export default {
    getOwnerDetails
};
