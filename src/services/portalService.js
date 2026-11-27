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
        const error = new Error(result.error, result.rawError ? { cause: result.rawError } : undefined);
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

const resolveFechaNacAndEdad = (fam) => {
    const rawDate = fam.fechanac ?? fam.fecnac;
    if (rawDate && typeof rawDate === 'string' && /^\d{4}-\d{2}-\d{2}/.test(rawDate.trim())) {
        const fecnac = rawDate.trim().slice(0, 10);
        const [y, m, d] = fecnac.split('-').map(Number);
        const birth = new Date(y, m - 1, d);
        if (isNaN(birth.getTime())) {
            const error = new Error("La fecha de nacimiento proporcionada no es válida.");
            error.statusCode = 400;
            error.isOperational = true;
            throw error;
        }
        const hoy = new Date();
        let edad = hoy.getFullYear() - birth.getFullYear();
        const mDiff = hoy.getMonth() - birth.getMonth();
        if (mDiff < 0 || (mDiff === 0 && hoy.getDate() < birth.getDate())) {
            edad--;
        }
        if (edad < 0) {
            const error = new Error("La fecha de nacimiento no puede ser futura.");
            error.statusCode = 400;
            error.isOperational = true;
            throw error;
        }
        // Edad actuarial (cumpleaños más cercano: +1 si han pasado >= 6 meses desde el último cumpleaños)
        let mesesDesdeCumple = (hoy.getMonth() - birth.getMonth() + 12) % 12;
        if (hoy.getDate() < birth.getDate()) {
            mesesDesdeCumple = (mesesDesdeCumple - 1 + 12) % 12;
        }
        if (mesesDesdeCumple >= 6) {
            edad++;
        }
        return { fecnac, edad };
    }

    if (fam.edad !== undefined && fam.edad !== null && fam.edad !== '' && !isNaN(Number(fam.edad))) {
        const edadNum = Number(fam.edad);
        if (edadNum < 0) {
            const error = new Error("La edad del integrante no puede ser negativa.");
            error.statusCode = 400;
            error.isOperational = true;
            throw error;
        }
        const hoy = new Date();
        const anioNac = hoy.getFullYear() - Math.floor(edadNum);
        const mm = String(hoy.getMonth() + 1).padStart(2, '0');
        const dd = String(hoy.getDate()).padStart(2, '0');
        return { fecnac: `${anioNac}-${mm}-${dd}`, edad: edadNum };
    }

    const error = new Error("Cada familiar debe incluir un codParent y una fecha de nacimiento o edad válidos.");
    error.statusCode = 400;
    error.isOperational = true;
    throw error;
};

const buildFuneralRateResponse = async ({ indTipoPlan, normalized }) => {
    const tipoPlan = String(indTipoPlan || (normalized.length > 1 ? 'G' : 'I')).trim().toUpperCase();
    if (tipoPlan !== 'I' && tipoPlan !== 'G') {
        const error = new Error("El tipo de plan funerario debe ser 'I' (Individual) o 'G' (Grupo Familiar).");
        error.statusCode = 400;
        error.isOperational = true;
        throw error;
    }

    const titulares = normalized.filter(f => f.codParent === '0001' || f.codParent === '0002');
    if (titulares.length !== 1) {
        const error = new Error("Debe incluir exactamente un asegurado titular (Masculino o Femenino).");
        error.statusCode = 400;
        error.isOperational = true;
        throw error;
    }

    if (titulares[0].edad < 18) {
        const error = new Error("El asegurado titular debe ser mayor de edad (mínimo 18 años).");
        error.statusCode = 400;
        error.isOperational = true;
        throw error;
    }

    if (tipoPlan === 'I' && normalized.length > 1) {
        const error = new Error("El plan funerario individual solo admite al asegurado titular.");
        error.statusCode = 400;
        error.isOperational = true;
        throw error;
    }

    if (tipoPlan === 'G' && normalized.length > 6) {
        const error = new Error("El plan funerario familiar admite hasta un máximo de 6 asegurados (titular y 5 familiares).");
        error.statusCode = 400;
        error.isOperational = true;
        throw error;
    }

    const familiaresString = normalized.map(f => `${f.codParent}:${f.fecnac}`).join(',');
    const result = await Portal.getFuneralRate({ indTipoPlan: tipoPlan, familiares: familiaresString });

    if (result.permissionError) {
        const error = new Error(result.permissionError);
        error.statusCode = 403;
        error.isOperational = true;
        throw error;
    }

    if (result.error) {
        const error = new Error(result.error, result.rawError ? { cause: result.rawError } : undefined);
        error.statusCode = 500;
        error.isOperational = true;
        throw error;
    }

    const rows = result.data || [];
    if (rows.length === 0) {
        return {
            found: false,
            data: { planes: [], coberturas: [], tarifasIndividuales: [] },
            message: "No existen planes funerarios disponibles para las edades o parentescos ingresados."
        };
    }

    const parentCounts = new Map();
    for (const fam of normalized) {
        parentCounts.set(fam.codParent, (parentCounts.get(fam.codParent) || 0) + 1);
    }

    const planGroups = new Map();
    for (const row of rows) {
        const key = `${row.CODPLAN}-${row.REVPLAN}`;
        if (!planGroups.has(key)) {
            planGroups.set(key, {
                codPlan: row.CODPLAN,
                revPlan: row.REVPLAN,
                descPlan: row.DESCPLAN,
                indTipoPlan: row.INDTIPOPLAN || tipoPlan,
                rows: []
            });
        }
        planGroups.get(key).rows.push(row);
    }

    const planes = [];
    const coberturas = [];
    const tarifasIndividuales = [];

    for (const group of planGroups.values()) {
        const matchedIds = new Set();
        let eligible = true;

        for (const row of group.rows) {
            if (row.PRIMACOBERT === null || row.PRIMACOBERT === undefined) {
                eligible = false;
                break;
            }
            const maxParent = row.MAXPARENT !== null && row.MAXPARENT !== undefined ? Number(row.MAXPARENT) : 99;
            if ((parentCounts.get(row.CODPARENT) || 0) > maxParent) {
                eligible = false;
                break;
            }
            matchedIds.add(Number(row.ID_FAMILIAR));
        }

        if (!eligible || matchedIds.size !== normalized.length) {
            continue;
        }

        const cobMap = new Map();
        const indMap = new Map();
        let primaTotal = 0;
        let sumaAsegurada = 0;

        for (const row of group.rows) {
            const primaRow = Number(row.PRIMACOBERT || 0);
            const sumaRow = Number(row.SUMAASEG || 0);
            const dedRow = Number(row.DEDUCIBLE || 0);

            primaTotal += primaRow;

            if (
                (row.CODPARENT === '0001' || row.CODPARENT === '0002') &&
                (row.CODCOBERT === '1001' || sumaAsegurada === 0)
            ) {
                sumaAsegurada = sumaRow;
            }

            const cobKey = String(row.CODCOBERT);
            if (!cobMap.has(cobKey)) {
                cobMap.set(cobKey, {
                    codPlan: group.codPlan,
                    revPlan: group.revPlan,
                    codCobert: cobKey,
                    descCobert: row.DESCCOBERT,
                    prima: 0,
                    sumaAseg: sumaRow,
                    deducible: dedRow
                });
            }
            const cobEntry = cobMap.get(cobKey);
            cobEntry.prima += primaRow;
            if ((row.CODPARENT === '0001' || row.CODPARENT === '0002') && sumaRow > 0) {
                cobEntry.sumaAseg = sumaRow;
            }

            const indKey = Number(row.ID_FAMILIAR);
            if (!indMap.has(indKey)) {
                indMap.set(indKey, {
                    codParent: row.CODPARENT,
                    edadFamiliar: Number(row.EDADFAMILIAR || 0),
                    codPlan: group.codPlan,
                    revPlan: group.revPlan,
                    descPlan: group.descPlan,
                    primaTotalIndividual: 0,
                    sumaAseguradaPlan: sumaRow
                });
            }
            indMap.get(indKey).primaTotalIndividual += primaRow;
        }

        planes.push({
            codPlan: group.codPlan,
            revPlan: group.revPlan,
            descPlan: group.descPlan,
            indTipoPlan: group.indTipoPlan,
            primaTotal,
            sumaAsegurada,
            deducible: 0
        });

        coberturas.push(...cobMap.values());
        tarifasIndividuales.push(...indMap.values());
    }

    if (planes.length === 0) {
        return {
            found: false,
            data: { planes: [], coberturas: [], tarifasIndividuales: [] },
            message: "No existen planes funerarios disponibles para las edades o parentescos ingresados."
        };
    }

    return {
        found: true,
        data: { planes, coberturas, tarifasIndividuales },
        message: "Tarifas funerarias obtenidas exitosamente."
    };
};

export const getFullRateDetails = async ({ codProd = '1007', indTipoPlan, familiares }) => {
    if (!familiares || !Array.isArray(familiares) || familiares.length === 0) {
        const error = new Error("El campo familiares es requerido y debe ser un array con al menos un integrante.");
        error.statusCode = 400;
        error.isOperational = true;
        throw error;
    }

    const normalized = familiares.map(fam => {
        if (!fam.codParent) {
            const error = new Error("Cada familiar debe incluir un codParent y una fecha de nacimiento o edad válidos.");
            error.statusCode = 400;
            error.isOperational = true;
            throw error;
        }
        const resolved = resolveFechaNacAndEdad(fam);
        return {
            codParent: String(fam.codParent).trim(),
            fecnac: resolved.fecnac,
            edad: resolved.edad
        };
    });

    if (String(codProd || '1007').trim() === '1010') {
        return buildFuneralRateResponse({ indTipoPlan, normalized });
    }

    const familiaresString = normalized.map(f => `${f.codParent}:${f.fecnac}`).join(',');

    const result = await Portal.getFullRate({ familiares: familiaresString });

    if (result.permissionError) {
        const error = new Error(result.permissionError);
        error.statusCode = 403;
        error.isOperational = true;
        throw error;
    }

    if (result.error) {
        const error = new Error(result.error, result.rawError ? { cause: result.rawError } : undefined);
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
    if (!codProd || !nombreAseg || prima === undefined || prima === null || !hcmPlan) {
        const error = new Error("Los datos de cabecera y del plan son obligatorios.");
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
        
        // Detalle del plan (HCM / Funerario)
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
        asegurados: asegurados.map(fam => {
            const resolved = resolveFechaNacAndEdad(fam);
            return {
                codParent: String(fam.codParent),
                fecnac: resolved.fecnac,
                edad: resolved.edad,
                prima: Number(fam.prima || 0)
            };
        }),

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
        const error = new Error(result.error, result.rawError ? { cause: result.rawError } : undefined);
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
