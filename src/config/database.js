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

const dbConfig = {
    user: process.env.USER_BD,
    password: process.env.PASSWORD_BD,
    connectString: `${process.env.SERVER_BD}:${process.env.PORT_BD}/${process.env.NAME}`,
    poolMin: Number(process.env.DB_POOL_MIN) || 2,
    poolMax: Number(process.env.DB_POOL_MAX) || 20,
    poolIncrement: 1,
    poolTimeout: Number(process.env.DB_POOL_TIMEOUT) || 60,  
    queueTimeout: 30000
};

let oraclePool;

export async function initializePool() {
    console.log('📦 Inicializando Oracle Connection Pool...');
    try {
        oraclePool = await oracledb.createPool(dbConfig);
        console.log('✅ Pool de conexiones a la base de datos Oracle creado correctamente.');
    } catch (err) {
        console.error('❌ ERROR CRÍTICO: No se pudo inicializar el pool de conexiones de Oracle:', err);
        throw err;
    }
}

export async function getConnection() {
    if (!oraclePool) {
        console.error('❌ Error: Intentando obtener conexión de Oracle antes de que el pool esté inicializado.');
        throw new Error('Oracle pool not initialized. Call initializePool() first.');
    }

    try {
        const connection = await oraclePool.getConnection();
        return connection;
    } catch (err) {
        console.error('❌ Error al obtener conexión del pool de Oracle:', err);
        throw err;
    }
}

export async function closePool() {
    if (oraclePool) {
        console.log('Cerrando pool de conexiones Oracle...');
        try {
            await oraclePool.close(10);
            oraclePool = null;
            console.log('Pool de conexiones a la base de datos Oracle cerrado.');
        } catch (err) {
            console.error('❌ Error al cerrar el pool de conexiones:', err);
            throw err;
        }
    }
}

export async function closePoolAndExit() {
    try {
        await closePool();
        process.exit(0);
    } catch (err) {
        process.exit(1);
    }
}