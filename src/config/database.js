import oracledb from 'oracledb';
import 'dotenv/config';

try {
    oracledb.initOracleClient();
    
    oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
    oracledb.fetchAsString = [oracledb.CLOB]; 
    oracledb.fetchAsBuffer = [oracledb.BLOB]; 
    console.log('Cliente Oracle inicializado en Thick Mode y configurado correctamente.');
} catch (err) {
    console.error('Error al inicializar/configurar el cliente Oracle:', err);
    process.exit(1); 
}

const dbConfig = {
    user: process.env.USER_BD,
    password: process.env.PASSWORD_BD,
    connectString: `${process.env.SERVER_BD}:${process.env.PORT_BD}/${process.env.NAME}`,
    poolMin: 1,
    poolMax: 50,
    poolIncrement: 1,
    poolTimeout: 5,  
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

export async function closePoolAndExit() {
    if (oraclePool) {
        console.log('\nCerrando pool de conexiones...');
        try {
            await oraclePool.close(10);
            console.log('Pool de conexiones a la base de datos Oracle cerrado.');
            process.exit(0);
        } catch (err) {
            console.error('❌ Error al cerrar el pool de conexiones:', err);
            process.exit(1);
        }
    } else {
        console.log('No hay pool de conexiones Oracle para cerrar.');
        process.exit(0);
    }
}