import express from 'express';
import 'dotenv/config';
import cors from 'cors';
import { initializePool, closePoolAndExit } from './config/database.js';

import v1ValrepRouter from './v1/valrepRoutes.js';
import v1PortalRouter from './v1/portalRoutes.js';
import v1AuthRoutes from './v1/authRoutes.js';
import { notFoundHandler, errorHandler } from './middlewares/errorMiddleware.js';
import { apiReference } from '@scalar/express-api-reference';
import { openApiSpec } from './config/swagger.js';
import { logger, serializeError } from './utils/logger.js';

const app = express();

const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:4200';
app.use(cors({
  origin: clientOrigin === '*' ? '*' : [clientOrigin, 'http://localhost:4200'],
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'],
  optionsSuccessStatus: 204,
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'x-client-channel']
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Logging HTTP de solicitudes
app.use((req, res, next) => {
  if (req.originalUrl.endsWith('/logs')) return next();
  const startedAt = Date.now();
  res.on('finish', () => {
    const durationMs = Date.now() - startedAt;
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    logger.log(level, `${req.method} ${req.originalUrl} ${res.statusCode} (${durationMs}ms)`, 'HttpServer', {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      durationMs,
      ip: req.ip,
      user: req.user?.username || null
    });
  });
  next();
});

// Recepción de logs estructurados desde el frontend
app.post('/apixportal/api/v1/logs', (req, res) => {
  const logs = req.body?.logs;
  if (!Array.isArray(logs)) {
    return res.status(400).json({ status: false, message: 'El campo logs debe ser un arreglo.' });
  }
  logger.enqueueExternalLogs(logs, 'frontend');
  return res.status(202).json({ status: true, accepted: logs.length });
});

// Documentación interactiva con Scalar
app.get('/docs/openapi.json', (req, res) => {
  res.json(openApiSpec);
});

app.use(
  '/docs',
  apiReference({
    spec: {
      content: openApiSpec
    },
    theme: 'purple',
    pageTitle: 'Portal del Asegurado - Documentación API'
  })
);

app.use('/apixportal/api/v1/auth', v1AuthRoutes);
app.use("/apixportal/api/v1/valrep", v1ValrepRouter); 
app.use("/apixportal/api/v1/portal", v1PortalRouter);

// Manejo centralizado de 404 y errores
app.use(notFoundHandler);
app.use(errorHandler);

const PORT = process.env.PORT || 5610;

async function startApplication() {
    try {
        await initializePool();        
        app.listen(PORT, () => {
            logger.info(`API (HTTP) escuchando en puerto ${PORT}`, 'Bootstrap', { port: PORT });
        });
    } catch (error) {
        logger.error('Error fatal al iniciar la aplicación', 'Bootstrap', { error: serializeError(error) });
        await logger.shutdown();
        await closePoolAndExit();
        process.exit(1);
    }
}

const handleShutdown = async (signal) => {
    logger.info(`Señal ${signal} recibida, cerrando aplicación`, 'Bootstrap', { signal });
    await logger.shutdown();
    await closePoolAndExit();
    process.exit(0);
};

if (process.env.NODE_ENV !== 'test') {
    process.on('SIGINT', () => void handleShutdown('SIGINT'));
    process.on('SIGTERM', () => void handleShutdown('SIGTERM'));
    process.on('unhandledRejection', (reason) => {
        logger.error('Promesa rechazada no manejada', 'Process', { error: serializeError(reason) });
    });
    process.on('uncaughtException', (error) => {
        logger.error('Excepción no capturada', 'Process', { error: serializeError(error) });
    });
    startApplication();
}

export default app;