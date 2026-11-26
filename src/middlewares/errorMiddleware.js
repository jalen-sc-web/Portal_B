import { logger, serializeError } from '../utils/logger.js';

/**
 * Middlewares para manejo centralizado de errores y rutas no encontradas.
 */

export const notFoundHandler = (req, res, next) => {
    logger.warn(`Ruta no encontrada: ${req.method} ${req.originalUrl}`, 'HttpRouter', {
        method: req.method,
        url: req.originalUrl,
        ip: req.ip,
        userAgent: req.get?.('user-agent') || req.headers?.['user-agent'],
        user: req.user?.username || null
    });

    res.status(404).json({
        status: false,
        message: `Ruta no encontrada: ${req.method} ${req.originalUrl}`
    });
};

export const errorHandler = (err, req, res, next) => {
    // Evitar fuga de mensajes técnicos o sentencias SQL hacia el cliente
    const statusCode = err.statusCode || err.status || 500;
    const clientMessage = (err.isOperational && err.message) 
        ? err.message 
        : 'Ocurrió un error interno en el servidor.';

    logger.error(
        `Error ${statusCode} en ${req.method} ${req.originalUrl}: ${err.message || 'Sin mensaje'}`,
        'ErrorHandler',
        {
            statusCode,
            method: req.method,
            url: req.originalUrl,
            ip: req.ip,
            userAgent: req.get?.('user-agent') || req.headers?.['user-agent'],
            user: req.user ? { username: req.user.username, role: req.user.role } : null,
            params: req.params,
            query: req.query,
            error: serializeError(err)
        }
    );

    if (err.retryAfter) {
        res.set('Retry-After', String(err.retryAfter));
    }

    res.status(statusCode).json({
        status: false,
        statusCode,
        message: clientMessage,
        ...(err.retryAfter ? { retryAfter: err.retryAfter } : {})
    });
};
