import Valrep from '../db/Valrep.js';

// Cache en memoria ligero con TTL para tablas de catálogos maestras
const cache = new Map();
const TTL_MS = 10 * 60 * 1000; // 10 minutos

const getFromCache = (key) => {
    const entry = cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiry) {
        cache.delete(key);
        return null;
    }
    return entry.data;
};

const setInCache = (key, data) => {
    cache.set(key, {
        data,
        expiry: Date.now() + TTL_MS
    });
};

export const getCountries = async () => {
    const cacheKey = 'catalog_countries';
    const cached = getFromCache(cacheKey);
    if (cached) return cached;

    const result = await Valrep.getCountry();
    if (result.error) {
        const err = new Error(result.error);
        err.statusCode = 500;
        err.isOperational = true;
        throw err;
    }

    setInCache(cacheKey, result.data);
    return result.data;
};

export const getStates = async (codpais) => {
    if (!codpais) {
        const err = new Error("El parámetro codpais es requerido.");
        err.statusCode = 400;
        err.isOperational = true;
        throw err;
    }

    const cacheKey = `catalog_states_${codpais}`;
    const cached = getFromCache(cacheKey);
    if (cached) return cached;

    const result = await Valrep.getState({ codpais });
    if (result.error) {
        const err = new Error(result.error);
        err.statusCode = 500;
        err.isOperational = true;
        throw err;
    }

    setInCache(cacheKey, result.data);
    return result.data;
};

export const getCities = async (codpais, codestado) => {
    if (!codpais || !codestado) {
        const err = new Error("Los parámetros codpais y codestado son requeridos.");
        err.statusCode = 400;
        err.isOperational = true;
        throw err;
    }

    const cacheKey = `catalog_cities_${codpais}_${codestado}`;
    const cached = getFromCache(cacheKey);
    if (cached) return cached;

    const result = await Valrep.getCity({ codpais, codestado });
    if (result.error) {
        const err = new Error(result.error);
        err.statusCode = 500;
        err.isOperational = true;
        throw err;
    }

    setInCache(cacheKey, result.data);
    return result.data;
};

export const getMunicipalities = async (codpais, codestado, codciudad) => {
    if (!codpais || !codestado || !codciudad) {
        const err = new Error("Los parámetros codpais, codestado y codciudad son requeridos.");
        err.statusCode = 400;
        err.isOperational = true;
        throw err;
    }

    const cacheKey = `catalog_mun_${codpais}_${codestado}_${codciudad}`;
    const cached = getFromCache(cacheKey);
    if (cached) return cached;

    const result = await Valrep.getMunicipality({ codpais, codestado, codciudad });
    if (result.error) {
        const err = new Error(result.error);
        err.statusCode = 500;
        err.isOperational = true;
        throw err;
    }

    setInCache(cacheKey, result.data);
    return result.data;
};

export const getLvals = async (tipolval) => {
    if (!tipolval) {
        const err = new Error("El parámetro tipolval es requerido.");
        err.statusCode = 400;
        err.isOperational = true;
        throw err;
    }

    const cacheKey = `catalog_lval_${tipolval}`;
    const cached = getFromCache(cacheKey);
    if (cached) return cached;

    const result = await Valrep.getLval({ tipolval });
    if (result.error) {
        const err = new Error(result.error);
        err.statusCode = 500;
        err.isOperational = true;
        throw err;
    }

    setInCache(cacheKey, result.data);
    return result.data;
};

export const getParents = async () => {
    const cacheKey = `catalog_parents_PARENT`;
    const cached = getFromCache(cacheKey);
    if (cached) return cached;

    // Puedes pasar directamente 'PARENT' o invocar la capa de datos reutilizando la consulta de lval
    const result = await Valrep.getParent({ tipolval: 'PARENT' });
    
    if (result.error) {
        const err = new Error(result.error);
        err.statusCode = 500;
        err.isOperational = true;
        throw err;
    }

    setInCache(cacheKey, result.data);
    return result.data;
};

export default {
    getCountries,
    getStates,
    getCities,
    getMunicipalities,
    getLvals,
    getParents
};
