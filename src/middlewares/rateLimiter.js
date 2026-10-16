/**
 * Middleware de Rate Limiting en memoria para Express con algoritmo de Ventana Deslizante (Sliding Window).
 * Previene ataques de DoS, fuerza bruta y saturación de servicios externos (ej. SMTP).
 */

export const createRateLimiter = ({
    windowMs = 15 * 60 * 1000,
    max = 5,
    message = 'Demasiadas solicitudes. Por favor espere antes de intentar nuevamente.',
    keyGenerator = (req) => {
        const forwarded = req.headers['x-forwarded-for'];
        if (forwarded) {
            return String(forwarded).split(',')[0].trim();
        }
        return req.ip || req.socket?.remoteAddress || 'unknown';
    }
} = {}) => {
    // Almacena un mapa de clave (IP) -> array de timestamps de peticiones
    const requestLog = new Map();

    // Limpieza periódica en segundo plano para evitar fugas de memoria
    const cleanupInterval = setInterval(() => {
        const now = Date.now();
        for (const [key, timestamps] of requestLog.entries()) {
            const valid = timestamps.filter(t => now - t < windowMs);
            if (valid.length === 0) {
                requestLog.delete(key);
            } else {
                requestLog.set(key, valid);
            }
        }
    }, Math.min(windowMs, 5 * 60 * 1000));

    if (cleanupInterval.unref) {
        cleanupInterval.unref();
    }

    return (req, res, next) => {
        const key = keyGenerator(req);
        const now = Date.now();

        const timestamps = requestLog.get(key) || [];
        const validTimestamps = timestamps.filter(t => now - t < windowMs);

        if (validTimestamps.length >= max) {
            const oldestTimestamp = validTimestamps[0];
            const retryAfterSec = Math.max(1, Math.ceil((oldestTimestamp + windowMs - now) / 1000));

            res.set('Retry-After', String(retryAfterSec));
            res.set('X-RateLimit-Limit', String(max));
            res.set('X-RateLimit-Remaining', '0');
            res.set('X-RateLimit-Reset', String(Math.ceil((oldestTimestamp + windowMs) / 1000)));

            console.warn(`🛑 [RateLimiter IP] Bloqueada solicitud desde '${key}'. Límite de ${max} peticiones en ${windowMs / 1000}s excedido.`);

            return res.status(429).json({
                status: false,
                statusCode: 429,
                message,
                retryAfter: retryAfterSec
            });
        }

        validTimestamps.push(now);
        requestLog.set(key, validTimestamps);

        const remaining = max - validTimestamps.length;
        res.set('X-RateLimit-Limit', String(max));
        res.set('X-RateLimit-Remaining', String(remaining));

        next();
    };
};

export default createRateLimiter;
