import { describe, test, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';

vi.mock('../../src/services/authService.js', () => ({
  default: {
    loginUser: vi.fn(),
    refreshToken: vi.fn(),
    getCurrentUser: vi.fn(),
    changeUserPassword: vi.fn(),
    setPasswordFromSession: vi.fn(),
    createUserByAdmin: vi.fn(),
    adminResetPassword: vi.fn(),
    emergencyOverridePassword: vi.fn(),
    requestPasswordReset: vi.fn(),
    verifyResetToken: vi.fn(),
    resetPasswordWithToken: vi.fn(),
  }
}));

import authService from '../../src/services/authService.js';
import app from '../../src/portal.js';
import { getJwtSecret } from '../../src/middlewares/authMiddleware.js';

describe('Auth Routes - Rutas de Autenticación, Sesión y Administración (HTTP)', () => {
  const adminToken = jwt.sign(
    { username: 'ADMIN_USR', role: 'ADMIN' },
    getJwtSecret(),
    { expiresIn: '1h' }
  );

  const insuredToken = jwt.sign(
    { username: 'ASEG_USR', role: 'ASEGURADO' },
    getJwtSecret(),
    { expiresIn: '1h' }
  );

  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * ID: C001-RAUT
   * Descripción: Validar que POST /login retorne HTTP 200 con token y perfil ante credenciales válidas
   * Resultado Esperado: Debe responder status 200 y contener token en el cuerpo
   */
  test('[C001-RAUT] Debería responder HTTP 200 con token al iniciar sesión exitosamente', async () => {
    authService.loginUser.mockResolvedValue({
      requireChange: false,
      token: 'jwt-auth-token-123',
      expiresIn: 28800,
      user: { username: 'V12345678', role: 'ASEGURADO' },
      message: 'Inicio de sesión exitoso.'
    });

    const res = await request(app)
      .post('/apixportal/api/v1/auth/login')
      .send({ username: 'V12345678', password: 'Password123#' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe(true);
    expect(res.body.token).toBe('jwt-auth-token-123');
  });

  /**
   * ID: C002-RAUT
   * Descripción: Validar que POST /login responda HTTP 401 si las credenciales son incorrectas
   * Resultado Esperado: Debe responder con statusCode 401 y status en false
   */
  test('[C002-RAUT] Debería responder HTTP 401 si las credenciales ingresadas son incorrectas', async () => {
    const error = new Error('Usuario o clave incorrecta.');
    error.statusCode = 401;
    error.isOperational = true;
    authService.loginUser.mockRejectedValue(error);

    const res = await request(app)
      .post('/apixportal/api/v1/auth/login')
      .send({ username: 'V12345678', password: 'ClaveErrada' });

    expect(res.status).toBe(401);
    expect(res.body.status).toBe(false);
    expect(res.body.message).toContain('incorrecta');
  });

  /**
   * ID: C003-RAUT
   * Descripción: Validar que POST /forgot-password responda HTTP 200 al solicitar recuperación válida
   * Resultado Esperado: Debe responder statusCode 200 y mensaje informativo de envío de correo
   */
  test('[C003-RAUT] Debería responder HTTP 200 al solicitar recuperación de clave válida', async () => {
    authService.requestPasswordReset.mockResolvedValue({
      status: true,
      message: 'Se ha enviado un enlace de recuperación a su correo electrónico.'
    });

    const res = await request(app)
      .post('/apixportal/api/v1/auth/forgot-password')
      .send({ identifier: 'usuario@constitucion.com' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe(true);
    expect(res.body.message).toContain('enviado un enlace');
  });

  /**
   * ID: C004-RAUT
   * Descripción: Validar que GET /me responda HTTP 401 si se intenta consultar sin autenticación
   * Resultado Esperado: Debe rechazar con statusCode 401
   */
  test('[C004-RAUT] Debería rechazar GET /me con HTTP 401 si no se envía token', async () => {
    const res = await request(app).get('/apixportal/api/v1/auth/me');

    expect(res.status).toBe(401);
  });

  /**
   * ID: C005-RAUT
   * Descripción: Validar que GET /me retorne los datos del usuario cuando el token es válido
   * Resultado Esperado: Debe responder statusCode 200 con el objeto data del usuario
   */
  test('[C005-RAUT] Debería responder HTTP 200 en GET /me ante token válido', async () => {
    authService.getCurrentUser.mockResolvedValue({
      username: 'ADMIN_USR',
      nombre: 'Administrador General',
      role: 'ADMIN'
    });

    const res = await request(app)
      .get('/apixportal/api/v1/auth/me')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe(true);
    expect(res.body.data.username).toBe('ADMIN_USR');
  });

  /**
   * ID: C006-RAUT
   * Descripción: Validar que rutas protegidas por rol ADMIN bloqueen usuarios normales con HTTP 403
   * Resultado Esperado: Debe responder statusCode 403 con mensaje de acceso denegado
   */
  test('[C006-RAUT] Debería bloquear con HTTP 403 la creación de usuarios si el rol no es ADMIN', async () => {
    const res = await request(app)
      .post('/apixportal/api/v1/auth/admin/create-user')
      .set('Authorization', `Bearer ${insuredToken}`)
      .send({ username: 'NUEVO', nombre: 'Nuevo Usr' });

    expect(res.status).toBe(403);
    expect(res.body.message).toContain('Acceso denegado');
  });

  /**
   * ID: C007-RAUT
   * Descripción: Validar que administradores puedan acceder a la ruta administrativa exitosamente
   * Resultado Esperado: Debe responder statusCode 201 o 200
   */
  test('[C007-RAUT] Debería permitir la creación de usuarios si el solicitante es ADMIN', async () => {
    authService.createUserByAdmin.mockResolvedValue({
      username: 'NUEVO_OK',
      nombre: 'Nuevo Usuario',
      role: 'ASEGURADO',
      tempPassword: 'Temporal123#'
    });

    const res = await request(app)
      .post('/apixportal/api/v1/auth/admin/create-user')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ username: 'NUEVO_OK', nombre: 'Nuevo Usuario', email: 'nuevo@constitucion.com' });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe(true);
    expect(res.body.data.username).toBe('NUEVO_OK');
  });
});
