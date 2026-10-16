import { describe, test, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/services/authService.js', () => ({
  default: {
    loginUser: vi.fn(),
    refreshToken: vi.fn(),
    getCurrentUser: vi.fn(),
    changeUserPassword: vi.fn(),
    setPasswordFromSession: vi.fn(),
    requestPasswordReset: vi.fn(),
    verifyResetToken: vi.fn(),
    resetPasswordWithToken: vi.fn(),
  }
}));

vi.mock('../../src/middlewares/authMiddleware.js', () => ({
  revokeToken: vi.fn(),
}));

import authService from '../../src/services/authService.js';
import { revokeToken } from '../../src/middlewares/authMiddleware.js';
import authController from '../../src/controllers/authController.js';

describe('AuthController - Controlador de Autenticación y Sesión', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * ID: C001-AUTH
   * Descripción: Validar que login responda con HTTP 200 y estructura estandarizada ante credenciales válidas
   * Resultado Esperado: Debe responder con statusCode 200, status: true, token y datos de usuario
   */
  test('[C001-AUTH] Debería retornar HTTP 200 y token de sesión cuando el login es exitoso', async () => {
    authService.loginUser.mockResolvedValue({
      requireChange: false,
      token: 'jwt-login-token-xyz',
      expiresIn: 28800,
      user: { username: 'V12345678', nombre: 'JUAN PEREZ' },
      message: 'Inicio de sesión exitoso.'
    });

    const req = { body: { username: 'V12345678', password: 'ValidPassword123#' } };
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();

    await authController.login(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: true,
        token: 'jwt-login-token-xyz',
        data: expect.objectContaining({ username: 'V12345678' })
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  /**
   * ID: C002-AUTH
   * Descripción: Validar que login delegue en next(error) ante cualquier excepción de servicio
   * Resultado Esperado: Debe invocar next pasando el error capturado
   */
  test('[C002-AUTH] Debería transferir errores a next() si el servicio de login arroja una excepción', async () => {
    const error = new Error('Credenciales inválidas');
    authService.loginUser.mockRejectedValue(error);

    const req = { body: { username: 'USR_ERR', password: 'bad' } };
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();

    await authController.login(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
    expect(res.status).not.toHaveBeenCalled();
  });

  /**
   * ID: C003-AUTH
   * Descripción: Validar que logout revoque el token de sesión y retorne HTTP 200
   * Resultado Esperado: Debe invocar revokeToken y retornar mensaje de sesión cerrada
   */
  test('[C003-AUTH] Debería revocar el token y responder HTTP 200 en el logout', async () => {
    const req = { token: 'token-to-revoke', user: { exp: 1770000000 } };
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();

    await authController.logout(req, res, next);

    expect(revokeToken).toHaveBeenCalledWith('token-to-revoke', 1770000000);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      status: true,
      message: 'Sesión cerrada exitosamente. Token invalidado.'
    });
  });

  /**
   * ID: C004-AUTH
   * Descripción: Validar que getMe retorne la identidad del usuario logueado
   * Resultado Esperado: Debe responder HTTP 200 con el objeto data del usuario
   */
  test('[C004-AUTH] Debería retornar los datos de perfil del usuario conectado en getMe', async () => {
    authService.getCurrentUser.mockResolvedValue({
      username: 'LCOVIS',
      nombre: 'LUIS COVIS',
      role: 'ADMIN'
    });

    const req = { user: { username: 'LCOVIS' } };
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();

    await authController.getMe(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      status: true,
      data: expect.objectContaining({ username: 'LCOVIS', role: 'ADMIN' })
    });
  });
});
