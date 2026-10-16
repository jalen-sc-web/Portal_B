import { describe, test, expect, vi } from 'vitest';
import { notFoundHandler, errorHandler } from '../../src/middlewares/errorMiddleware.js';

describe('ErrorMiddleware - Manejador Centralizado de Errores y Rutas', () => {
  /**
   * ID: I001-ERR
   * Descripción: Validar que notFoundHandler capture rutas inexistentes con HTTP 404
   * Resultado Esperado: Debe responder statusCode 404 y detallar método y url solicitada
   */
  test('[I001-ERR] Debería retornar HTTP 404 cuando la ruta no existe', () => {
    const req = { method: 'GET', originalUrl: '/api/v1/ruta-inexistente' };
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();

    notFoundHandler(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      status: false,
      message: 'Ruta no encontrada: GET /api/v1/ruta-inexistente'
    });
  });

  /**
   * ID: I002-ERR
   * Descripción: Validar que errorHandler oculte errores internos de base de datos o fallos no controlados
   * Resultado Esperado: Debe responder HTTP 500 con mensaje genérico seguro sin filtrar trazas
   */
  test('[I002-ERR] Debería ocultar detalles de errores no controlados y responder con mensaje genérico', () => {
    const internalError = new Error('ORA-00942: table or view does not exist SELECT * FROM USERS');
    const req = { method: 'POST', originalUrl: '/api/v1/consulta' };
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn(), set: vi.fn() };
    const next = vi.fn();

    errorHandler(internalError, req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      status: false,
      statusCode: 500,
      message: 'Ocurrió un error interno en el servidor.'
    });
  });

  /**
   * ID: I003-ERR
   * Descripción: Validar que errorHandler transmita mensajes controlados cuando isOperational es true
   * Resultado Esperado: Debe responder con el statusCode y mensaje específico del error operacional
   */
  test('[I003-ERR] Debería retornar el mensaje específico cuando el error es marcado como operacional', () => {
    const operationalError = new Error('El usuario no tiene un correo registrado.');
    operationalError.statusCode = 400;
    operationalError.isOperational = true;

    const req = { method: 'POST', originalUrl: '/api/v1/auth/forgot-password' };
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn(), set: vi.fn() };
    const next = vi.fn();

    errorHandler(operationalError, req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      status: false,
      statusCode: 400,
      message: 'El usuario no tiene un correo registrado.'
    });
  });

  /**
   * ID: I004-ERR
   * Descripción: Validar que errorHandler configure la cabecera Retry-After cuando el error la especifique
   * Resultado Esperado: Debe invocar res.set('Retry-After', ...) con los segundos correspondientes
   */
  test('[I004-ERR] Debería inyectar la cabecera Retry-After en errores con limitación de tiempo', () => {
    const rateError = new Error('Cooldown activo.');
    rateError.statusCode = 429;
    rateError.isOperational = true;
    rateError.retryAfter = 120;

    const req = { method: 'POST', originalUrl: '/api/v1/auth/forgot-password' };
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn(), set: vi.fn() };
    const next = vi.fn();

    errorHandler(rateError, req, res, next);

    expect(res.set).toHaveBeenCalledWith('Retry-After', '120');
    expect(res.status).toHaveBeenCalledWith(429);
  });
});
