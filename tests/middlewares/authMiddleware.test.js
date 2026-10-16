import { describe, test, expect, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import {
  verifyToken,
  requireRole,
  revokeToken,
  isTokenRevoked,
  getJwtSecret
} from '../../src/middlewares/authMiddleware.js';

describe('AuthMiddleware - Control de Acceso, JWT y Roles', () => {
  /**
   * ID: I001-AUTH
   * Descripción: Validar que verifyToken rechace solicitudes sin cabecera Authorization
   * Resultado Esperado: Debe responder HTTP 401 con mensaje de token no proporcionado
   */
  test('[I001-AUTH] Debería rechazar peticiones sin la cabecera Bearer Authorization', () => {
    const req = { headers: {} };
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();

    verifyToken(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('no proporcionado') })
    );
  });

  /**
   * ID: I002-AUTH
   * Descripción: Validar que verifyToken rechace tokens que hayan sido revocados (logout o uso único)
   * Resultado Esperado: Debe responder HTTP 401 indicando que el token fue revocado
   */
  test('[I002-AUTH] Debería rechazar peticiones con tokens previamente revocados', () => {
    const testToken = jwt.sign({ username: 'USR_REV' }, getJwtSecret(), { expiresIn: '1h' });
    revokeToken(testToken, Math.floor(Date.now() / 1000) + 3600);

    const req = { headers: { authorization: `Bearer ${testToken}` } };
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();

    verifyToken(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('revocado') })
    );
  });

  /**
   * ID: I003-AUTH
   * Descripción: Validar que verifyToken rechace tokens inválidos o manipulados
   * Resultado Esperado: Debe responder HTTP 401 con mensaje de token inválido
   */
  test('[I003-AUTH] Debería rechazar peticiones con tokens con firma errónea o expirados', () => {
    const req = { headers: { authorization: 'Bearer token_invalido_con_firma_falsa' } };
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();

    verifyToken(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  /**
   * ID: I004-AUTH
   * Descripción: Validar que verifyToken inyecte el payload de usuario en req.user si el token es válido
   * Resultado Esperado: Debe invocar next() y popular req.user y req.token
   */
  test('[I004-AUTH] Debería autenticar e inyectar req.user ante un token válido', () => {
    const validToken = jwt.sign({ username: 'USR_OK', role: 'ADMIN' }, getJwtSecret(), { expiresIn: '1h' });
    const req = { headers: { authorization: `Bearer ${validToken}` } };
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();

    verifyToken(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toBeDefined();
    expect(req.user.username).toBe('USR_OK');
    expect(req.token).toBe(validToken);
  });

  /**
   * ID: I005-AUTH
   * Descripción: Validar que requireRole bloquee usuarios con roles no autorizados
   * Resultado Esperado: Debe responder HTTP 403 con mensaje de acceso denegado
   */
  test('[I005-AUTH] Debería bloquear con HTTP 403 cuando el usuario no posee el rol exigido', () => {
    const guard = requireRole('ADMIN');
    const req = { user: { username: 'ASEG01', role: 'ASEGURADO' } };
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();

    guard(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('Acceso denegado') })
    );
  });

  /**
   * ID: I006-AUTH
   * Descripción: Validar que requireRole permita el acceso a usuarios con el rol adecuado
   * Resultado Esperado: Debe invocar next() sin modificar la respuesta
   */
  test('[I006-AUTH] Debería permitir el acceso si el usuario cuenta con el rol requerido', () => {
    const guard = requireRole('ADMIN', 'SUPERVISOR');
    const req = { user: { username: 'ADMIN01', role: 'ADMIN' } };
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();

    guard(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });
});
