import { describe, test, expect, vi } from 'vitest';
import { createRateLimiter } from '../../src/middlewares/rateLimiter.js';

describe('RateLimiter Middleware - Protección Anti-DoS y Fuerza Bruta', () => {
  /**
   * ID: I001-RATE
   * Descripción: Validar que peticiones dentro del límite permitido sean procesadas normalmente
   * Resultado Esperado: Debe invocar next() sin modificar la respuesta
   */
  test('[I001-RATE] Debería permitir solicitudes que se encuentren dentro del límite de la ventana', () => {
    const limiter = createRateLimiter({ windowMs: 1000, max: 2 });
    const req = { ip: '192.168.1.10', headers: {} };
    const res = { set: vi.fn(), status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();

    limiter(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  /**
   * ID: I002-RATE
   * Descripción: Validar que solicitudes excedentes retornen código de estado HTTP 429
   * Resultado Esperado: Debe responder con statusCode 429 y no llamar a next()
   */
  test('[I002-RATE] Debería bloquear con HTTP 429 al exceder el número máximo de peticiones', () => {
    const limiter = createRateLimiter({ windowMs: 10000, max: 2 });
    const req = { ip: '192.168.1.20', headers: {} };
    const res = { set: vi.fn(), status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();

    limiter(req, res, next); // 1
    limiter(req, res, next); // 2
    expect(next).toHaveBeenCalledTimes(2);

    limiter(req, res, next); // 3 -> Bloqueado
    expect(next).toHaveBeenCalledTimes(2);
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: false,
        statusCode: 429,
        retryAfter: expect.any(Number)
      })
    );
  });

  /**
   * ID: I003-RATE
   * Descripción: Validar que se inyecten las cabeceras estándar de control de rate limit
   * Resultado Esperado: Debe establecer cabeceras Retry-After, X-RateLimit-Limit, X-RateLimit-Remaining y X-RateLimit-Reset
   */
  test('[I003-RATE] Debería configurar cabeceras estándar de rate limiting al bloquear', () => {
    const limiter = createRateLimiter({ windowMs: 5000, max: 1 });
    const req = { ip: '192.168.1.30', headers: {} };
    const res = { set: vi.fn(), status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();

    limiter(req, res, next); // Petición 1 (permitida)
    limiter(req, res, next); // Petición 2 (bloqueada)

    expect(res.set).toHaveBeenCalledWith('X-RateLimit-Limit', '1');
    expect(res.set).toHaveBeenCalledWith('X-RateLimit-Remaining', '0');
    expect(res.set).toHaveBeenCalledWith('Retry-After', expect.any(String));
    expect(res.set).toHaveBeenCalledWith('X-RateLimit-Reset', expect.any(String));
  });

  /**
   * ID: I004-RATE
   * Descripción: Validar que el conteo de solicitudes sea independiente por dirección IP
   * Resultado Esperado: Peticiones de una IP distinta no deben verse afectadas por el bloqueo de otra
   */
  test('[I004-RATE] Debería aislar los límites por dirección IP independientemente', () => {
    const limiter = createRateLimiter({ windowMs: 10000, max: 1 });
    const req1 = { ip: '10.0.0.1', headers: {} };
    const req2 = { ip: '10.0.0.2', headers: {} };
    const res = { set: vi.fn(), status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next1 = vi.fn();
    const next2 = vi.fn();

    limiter(req1, res, next1); // IP 1 - petición 1 ok
    limiter(req1, res, next1); // IP 1 - petición 2 bloqueada
    expect(next1).toHaveBeenCalledTimes(1);

    limiter(req2, res, next2); // IP 2 - petición 1 ok
    expect(next2).toHaveBeenCalledTimes(1);
  });

  /**
   * ID: I005-RATE
   * Descripción: Validar que el middleware soporte la cabecera x-forwarded-for cuando está detrás de proxy
   * Resultado Esperado: Debe extraer la primera dirección IP de la cabecera x-forwarded-for
   */
  test('[I005-RATE] Debería identificar la IP del cliente a través de la cabecera x-forwarded-for', () => {
    const limiter = createRateLimiter({ windowMs: 10000, max: 1 });
    const req = {
      ip: '127.0.0.1',
      headers: { 'x-forwarded-for': '200.10.20.30, 10.0.0.1' }
    };
    const res = { set: vi.fn(), status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();

    limiter(req, res, next);
    limiter(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(429);
  });
});
