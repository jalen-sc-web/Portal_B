import oracledb from 'oracledb';
import 'dotenv/config';

// Configuraciones globales de oracledb
oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
oracledb.fetchAsString = [oracledb.CLOB];
oracledb.fetchAsBuffer = [oracledb.BLOB];

// Inicialización de Thick Mode solo si está explícitamente configurado; de lo contrario opera en Thin Mode nativo
if (process.env.ORACLE_CLIENT_DIR) {
    try {
        oracledb.initOracleClient({ libDir: process.env.ORACLE_CLIENT_DIR });
        console.log('📦 Cliente Oracle inicializado en Thick Mode.');
    } catch (err) {
        console.warn('⚠️ No se pudo inicializar en Thick Mode, continuando en Thin Mode:', err.message);
    }
} else {
    console.log('📦 Cliente Oracle operando en Thin Mode nativo.');
}

// ------------------------------------------------------------------------------
// CONSTANTES Y HELPERS DE ESQUEMAS Y TABLAS
// ------------------------------------------------------------------------------
export const SCHEMAS = {
    ACSEL: process.env.ACSEL_SCHEMA || 'CONSSEG',
    PORTAL: process.env.PORTAL_SCHEMA || 'WEBPORTAL'
};

/**
 * Retorna el nombre calificado para una tabla del Portal (ej: WEBPORTAL.USUARIO)
 */
export const portalTable = (tableName) => {
    const schema = process.env.PORTAL_SCHEMA || SCHEMAS.PORTAL;
    return schema ? `${schema}.${tableName}` : tableName;
};

/**
 * Retorna el nombre calificado para una tabla de Acsel Core (ej: CONSSEG.CLIENTE)
 */
export const acselTable = (tableName) => {
    const schema = process.env.ACSEL_SCHEMA || SCHEMAS.ACSEL;
    return schema ? `${schema}.${tableName}` : tableName;
};

// ------------------------------------------------------------------------------
// 1. CONFIGURACIÓN POOL 1: CORE ACSEL / CONSSEG (Usuario JALEN u homólogo)
// ------------------------------------------------------------------------------
const acselServer = process.env.ACSEL_SERVER_BD || process.env.SERVER_BD || '10.0.0.75';
const acselPort = process.env.ACSEL_PORT_BD || process.env.PORT_BD || 1521;
const acselService = process.env.ACSEL_SERVICE_NAME_BD || process.env.SERVICE_NAME_BD || process.env.NAME || 'QA';

const acselDbConfig = {
    user: process.env.ACSEL_USER_BD || process.env.USER_BD || 'JALEN',
    password: process.env.ACSEL_PASSWORD_BD || process.env.PASSWORD_BD,
    connectString: `${acselServer}:${acselPort}/${acselService}`,
    poolMin: Number(process.env.ACSEL_DB_POOL_MIN || process.env.DB_POOL_MIN) || 2,
    poolMax: Number(process.env.ACSEL_DB_POOL_MAX || process.env.DB_POOL_MAX) || 20,
    poolIncrement: 1,
    poolTimeout: Number(process.env.ACSEL_DB_POOL_TIMEOUT || process.env.DB_POOL_TIMEOUT) || 60,
    queueTimeout: 30000
};

// ------------------------------------------------------------------------------
// 2. CONFIGURACIÓN POOL 2: WEBPORTAL (Usuario LUCOVIS / Esquema WEBPORTAL)
// ------------------------------------------------------------------------------
const portalServer = process.env.PORTAL_SERVER_BD || process.env.SERVER_BD || '10.0.0.75';
const portalPort = process.env.PORTAL_PORT_BD || process.env.PORT_BD || 1521;
const portalService = process.env.PORTAL_SERVICE_NAME_BD || process.env.SERVICE_NAME_BD || process.env.NAME || 'QA';

const portalDbConfig = {
    user: process.env.PORTAL_USER_BD || 'LUCOVIS',
    password: process.env.PORTAL_PASSWORD_BD || process.env.PASSWORD_BD,
    connectString: `${portalServer}:${portalPort}/${portalService}`,
    poolMin: Number(process.env.PORTAL_DB_POOL_MIN || process.env.DB_POOL_MIN) || 2,
    poolMax: Number(process.env.PORTAL_DB_POOL_MAX || process.env.DB_POOL_MAX) || 20,
    poolIncrement: 1,
    poolTimeout: Number(process.env.PORTAL_DB_POOL_TIMEOUT || process.env.DB_POOL_TIMEOUT) || 60,
    queueTimeout: 30000
};

let acselPool = null;
let portalPool = null;

/**
 * Inicializa ambos pools de conexiones a Oracle de manera concurrente.
 */
export async function initializePool() {
    console.log('📦 Inicializando pools de conexiones a Oracle...');
    try {
        const [pAcsel, pPortal] = await Promise.all([
            oracledb.createPool({ ...acselDbConfig, poolAlias: 'acselPool' }),
            oracledb.createPool({ ...portalDbConfig, poolAlias: 'portalPool' })
        ]);
        acselPool = pAcsel;
        portalPool = pPortal;
        console.log(`✅ Pool Acsel Core conectado exitosamente a ${acselDbConfig.connectString} (usuario: ${acselDbConfig.user})`);
        console.log(`✅ Pool WebPortal conectado exitosamente a ${portalDbConfig.connectString} (usuario: ${portalDbConfig.user})`);
    } catch (err) {
        console.error('❌ ERROR CRÍTICO: No se pudieron inicializar los pools de Oracle:', err);
        throw err;
    }
}

/**
 * Obtiene una conexión para el esquema Core Acsel (Clientes, Terceros, Catálogos).
 */
export async function getAcselConnection() {
    if (!acselPool) {
        throw new Error('Acsel pool not initialized. Call initializePool() first.');
    }
    return acselPool.getConnection();
}

/**
 * Obtiene una conexión para el esquema WebPortal (Usuarios, Credenciales, Auth).
 */
export async function getPortalConnection() {
    if (!portalPool) {
        throw new Error('Portal pool not initialized. Call initializePool() first.');
    }
    return portalPool.getConnection();
}

/**
 * Compatibilidad con código previo que invoca getConnection().
 * Si se especifica poolName ('portal' o 'acsel'), retorna la conexión respectiva.
 * Por defecto retorna conexión de Acsel.
 */
export async function getConnection(poolName = 'acsel') {
    if (poolName === 'portal' || poolName === 'webportal') {
        return getPortalConnection();
    }
    return getAcselConnection();
}

/**
 * Cierra ambos pools de conexiones de forma segura.
 */
export async function closePool() {
    const closes = [];
    if (acselPool) {
        closes.push(
            acselPool.close(10).then(() => {
                acselPool = null;
                console.log('Pool Acsel cerrado.');
            })
        );
    }
    if (portalPool) {
        closes.push(
            portalPool.close(10).then(() => {
                portalPool = null;
                console.log('Pool WebPortal cerrado.');
            })
        );
    }
    try {
        await Promise.all(closes);
        console.log('Pools de conexiones a Oracle cerrados exitosamente.');
    } catch (err) {
        console.error('❌ Error al cerrar los pools de conexiones:', err);
        throw err;
    }
}

export async function closePoolAndExit() {
    try {
        await closePool();
        process.exit(0);
    } catch {
        process.exit(1);
    }
}
