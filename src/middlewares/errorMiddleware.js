/**
 * Middlewares para manejo centralizado de errores y rutas no encontradas.
 */

export const notFoundHandler = (req, res, next) => {
    res.status(404).json({
        status: false,
        message: `Ruta no encontrada: ${req.method} ${req.originalUrl}`
    });
};

export const errorHandler = (err, req, res, next) => {
    console.error(`❌ [Error Handler] en ${req.method} ${req.originalUrl}:`, err);

    // Evitar fuga de mensajes técnicos o sentencias SQL hacia el cliente
    const statusCode = err.statusCode || err.status || 500;
    const clientMessage = (err.isOperational && err.message) 
        ? err.message 
        : 'Ocurrió un error interno en el servidor.';

    res.status(statusCode).json({
        status: false,
        message: clientMessage
    });
};
