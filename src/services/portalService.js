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

export const getFullRateDetails = async ({ familiares }) => {
    if (!familiares || !Array.isArray(familiares) || familiares.length === 0) {
        const error = new Error("El campo familiares es requerido y debe ser un array con al menos un integrante.");
        error.statusCode = 400;
        error.isOperational = true;
        throw error;
    }

    for (const fam of familiares) {
        if (!fam.codParent || fam.edad === undefined || fam.edad === null || fam.edad === '') {
            const error = new Error("Cada familiar debe incluir un codParent y una edad válidos.");
            error.statusCode = 400;
            error.isOperational = true;
            throw error;
        }
    }

    const familiaresString = familiares.map(f => `${f.codParent}:${f.edad}`).join(',');

    const result = await Portal.getFullRate({ familiares: familiaresString });

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

    // Validamos que result.data contenga las estructuras (completa e individual)
    const rowsCompleta = result.data?.completa || [];
    const rowsIndividual = result.data?.individual || [];

    if (rowsCompleta.length === 0 && rowsIndividual.length === 0) {
        return {
            found: false,
            data: { planes: [], coberturas: [], tarifasIndividuales: [] },
            message: "No se encontraron tarifas disponibles para los familiares proporcionados."
        };
    }

    // ==========================================
    // 1. Procesar y agrupar para la lista de planes
    // ==========================================
    const planesMap = new Map();

    rowsCompleta.forEach(row => {
        const key = `${row.CODPLAN}-${row.REVPLAN}`;
        
        if (!planesMap.has(key)) {
            planesMap.set(key, {
                codPlan: row.CODPLAN,
                revPlan: row.REVPLAN,
                descPlan: row.DESCPLAN,
                primaTotal: 0,
                sumaAsegurada: 0,
                deducible: row.DEDUCIBLE || row.VALDED || 0 // <-- Incluimos el deducible a nivel de plan
            });
        }

        const planData = planesMap.get(key);

        // Sumamos la prima de esta cobertura al total del plan
        planData.primaTotal += Number(row.PRIMA || 0);

        // Si esta fila corresponde a la cobertura 8064, capturamos su suma asegurada para el plan
        if (row.CODCOBERT === '8064') {
            planData.sumaAsegurada = Number(row.SUMAASEG || 0);
            planData.deducible = row.DEDUCIBLE || row.VALDED || planData.deducible;
        }
    });

    const planes = Array.from(planesMap.values());

    // ==========================================
    // 2. El desglose detallado por cobertura
    // ==========================================
    const coberturas = rowsCompleta.map(row => ({
        codPlan: row.CODPLAN,
        revPlan: row.REVPLAN,
        codCobert: row.CODCOBERT,
        descCobert: row.DESCCOBERT,
        prima: row.PRIMA,
        sumaAseg: row.SUMAASEG,
        deducible: row.DEDUCIBLE || row.VALDED || 0 // <-- Incluimos el deducible en cada cobertura
    }));

    // ==========================================
    // 3. Procesar las tarifas individuales
    // ==========================================
    const tarifasIndividuales = rowsIndividual.map(row => ({
        codParent: row.CODPARENT,
        edadFamiliar: row.EDADFAMILIAR,
        codPlan: row.CODPLAN || null,
        revPlan: row.REVPLAN || null,
        descPlan: row.DESCPLAN,
        primaTotalIndividual: Number(row.PRIMATOTALINDIVIDUAL || 0),
        sumaAseguradaPlan: Number(row.SUMAASEGURADAPLAN || 0)
    }));

    return {
        found: true,
        data: {
            planes,         
            coberturas,
            tarifasIndividuales // <--- Nuevos datos del segundo cursor
        },
        message: "Tarifas agrupadas y obtenidas exitosamente."
    };
};

export const saveQuoteDetails = async ({
    codProd,
    nombreAseg,
    telefono,
    email,
    prima,
    sumaAseg,
    codInter,
    codOfiEmi,
    hcmPlan,
    asegurados,
    coberturas,
    codUsuCrea
}) => {
    // 1. Validaciones de integridad básicas en la capa de servicio
    if (!codProd || !nombreAseg || prima === undefined || !hcmPlan) {
        const error = new Error("Los datos de cabecera y del plan HCM son obligatorios.");
        error.statusCode = 400;
        error.isOperational = true;
        throw error;
    }

    if (!asegurados || !Array.isArray(asegurados) || asegurados.length === 0) {
        const error = new Error("Debe incluir al menos un asegurado (titular o dependiente) en la cotización.");
        error.statusCode = 400;
        error.isOperational = true;
        throw error;
    }

    // 2. Empaquetamos el objeto estructurado para enviarlo al modelo de Oracle (Portal.saveQuote)
    const quotePayload = {
        codProd,
        nombreAseg: nombreAseg.trim(),
        telefono: telefono || null,
        email: email || null,
        prima: Number(prima),
        sumaAseg: Number(sumaAseg || 0),
        codInter: codInter || null,
        codOfiEmi: codOfiEmi || null,
        stscot: 'VAL',
        codUsuCrea: codUsuCrea,
        
        // Detalle HCM
        hcmPlan: {
            codProd: hcmPlan.codProd || codProd,
            codPlan: hcmPlan.codPlan,
            revPlan: hcmPlan.revplan || hcmPlan.revPlan || '01',
            nombrePlan: hcmPlan.nombrePlan,
            prima: Number(hcmPlan.prima),
            sumaAseg: Number(hcmPlan.sumaAseg),
            deducible: Number(hcmPlan.deducible || 0)
        },

        // Lista de asegurados / familiares repetibles (titular, cónyuge, hijos múltiples)
        asegurados: asegurados.map(fam => ({
            codParent: String(fam.codParent),
            edad: Number(fam.edad),
            prima: Number(fam.prima || 0)
        })),

        // Desglose de coberturas del plan con sumaaseg_cob y prima_cob
        coberturas: (coberturas || []).map(cob => ({
            codCobert: String(cob.codCobert),
            descCobert: String(cob.descCobert),
            sumaAsegCob: (cob.sumaAsegCob !== undefined && cob.sumaAsegCob !== null) ? Number(cob.sumaAsegCob) : null,
            deducible: (cob.deducible !== undefined && cob.deducible !== null) ? Number(cob.deducible) : null,
            primaCob: (cob.primaCob !== undefined && cob.primaCob !== null) ? Number(cob.primaCob) : null
        }))
    };

    // 3. Ejecución en la capa de base de datos (Modelo / Driver Oracle)
    const result = await Portal.saveQuote(quotePayload);

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

    // 4. Retorno exitoso con el ID y la referencia generados en Oracle (`CODCOTI` y `CODCOTI_REF`)
    return {
        success: true,
        data: {
            codCoti: result.data?.codCoti,
            codCotiRef: result.data?.codCotiRef
        },
        message: "Cotización almacenada satisfactoriamente en el esquema WEBPORTAL."
    };
};


export default {
    getOwnerDetails,
    getFullRateDetails,
    saveQuoteDetails
};
