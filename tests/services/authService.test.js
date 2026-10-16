import { describe, test, expect, vi, beforeEach } from 'vitest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// Mocks de dependencias externas
vi.mock('../../src/db/Auth.js', () => ({
  default: {
    getUser: vi.fn(),
    updatePassword: vi.fn(),
    createUser: vi.fn(),
  }
}));

vi.mock('../../src/utils/mailer.js', () => ({
  sendPasswordResetEmail: vi.fn().mockResolvedValue(true),
  isEmailAllowed: vi.fn().mockReturnValue(true),
}));

import Auth from '../../src/db/Auth.js';
import {
  changeUserPassword,
  setPasswordFromSession,
  requestPasswordReset,
  verifyResetToken,
  resetPasswordWithToken
} from '../../src/services/authService.js';
import { getJwtSecret } from '../../src/middlewares/authMiddleware.js';

describe('AuthService - Gestión de Sesión, Contraseñas y Recuperación', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * ID: S001-AUTH
   * Descripción: Validar que changeUserPassword rechace si la contraseña actual no es correcta
   * Resultado Esperado: Debe arrojar error 401 con mensaje "La contraseña actual es incorrecta."
   */
  test('[S001-AUTH] Debería rechazar el cambio de clave si la contraseña actual no coincide', async () => {
    const currentHash = await bcrypt.hash('ClaveActual2026#', 10);
    Auth.getUser.mockResolvedValue({
      data: {
        CODUSU: 'USR01',
        CLAVE: currentHash,
        CLAVE_ANT: null
      }
    });

    await expect(
      changeUserPassword({
        username: 'USR01',
        currentPassword: 'PasswordErrada99!',
        newPassword: 'NuevaValida2026#'
      })
    ).rejects.toThrow('La contraseña actual es incorrecta.');
  });

  /**
   * ID: S002-AUTH
   * Descripción: Validar que changeUserPassword valide la fortaleza y rechace contraseñas débiles
   * Resultado Esperado: Debe arrojar error 400 por no alcanzar el nivel Aceptable o tener menos de 8 caracteres
   */
  test('[S002-AUTH] Debería rechazar la nueva contraseña si es débil o no alcanza el nivel Aceptable', async () => {
    const currentHash = await bcrypt.hash('ClaveActual2026#', 10);
    Auth.getUser.mockResolvedValue({
      data: {
        CODUSU: 'USR01',
        CLAVE: currentHash,
        CLAVE_ANT: null
      }
    });

    await expect(
      changeUserPassword({
        username: 'USR01',
        currentPassword: 'ClaveActual2026#',
        newPassword: '123'
      })
    ).rejects.toThrow('La nueva contraseña debe tener al menos 8 caracteres.');
  });

  /**
   * ID: S003-AUTH
   * Descripción: Validar que changeUserPassword impida reutilizar la contraseña anterior (CLAVE_ANT)
   * Resultado Esperado: Debe arrojar error 400 indicando que no puede reutilizar la clave anterior
   */
  test('[S003-AUTH] Debería rechazar la nueva contraseña si coincide con la clave anterior (CLAVE_ANT)', async () => {
    const currentHash = await bcrypt.hash('ClaveActual2026#', 10);
    const prevHash = await bcrypt.hash('ClaveAnterior2025!', 10);
    Auth.getUser.mockResolvedValue({
      data: {
        CODUSU: 'USR01',
        CLAVE: currentHash,
        CLAVE_ANT: prevHash
      }
    });

    await expect(
      changeUserPassword({
        username: 'USR01',
        currentPassword: 'ClaveActual2026#',
        newPassword: 'ClaveAnterior2025!'
      })
    ).rejects.toThrow('No puede reutilizar su contraseña anterior por motivos de seguridad.');
  });

  /**
   * ID: S004-AUTH
   * Descripción: Validar que changeUserPassword actualice la contraseña exitosamente al cumplir todas las reglas
   * Resultado Esperado: Debe invocar Auth.updatePassword con requireChange en false y retornar mensaje de éxito
   */
  test('[S004-AUTH] Debería actualizar la contraseña con éxito cuando todos los criterios son válidos', async () => {
    const currentHash = await bcrypt.hash('ClaveActual2026#', 10);
    Auth.getUser.mockResolvedValue({
      data: {
        CODUSU: 'USR01',
        CLAVE: currentHash,
        CLAVE_ANT: null
      }
    });
    Auth.updatePassword.mockResolvedValue({ success: true });

    const result = await changeUserPassword({
      username: 'USR01',
      currentPassword: 'ClaveActual2026#',
      newPassword: 'NuevaSegura2026#'
    });

    expect(result).toHaveProperty('message', 'Clave actualizada exitosamente.');
    expect(Auth.updatePassword).toHaveBeenCalledWith(
      'USR01',
      expect.any(String),
      { requireChange: false }
    );
  });

  /**
   * ID: S005-AUTH
   * Descripción: Validar que setPasswordFromSession requiera campos obligatorios
   * Resultado Esperado: Debe arrojar error 400 si username o newPassword no están presentes
   */
  test('[S005-AUTH] Debería rechazar setPasswordFromSession si faltan parámetros requeridos', async () => {
    await expect(
      setPasswordFromSession({ username: '', newPassword: '' })
    ).rejects.toThrow('La nueva contraseña es requerida.');
  });

  /**
   * ID: S006-AUTH
   * Descripción: Validar que setPasswordFromSession revoque el token temporal y emita token definitivo
   * Resultado Esperado: Debe revocar el token previo y retornar un nuevo JWT de sesión
   */
  test('[S006-AUTH] Debería invalidar token temporal y retornar nuevo token de sesión definitivo', async () => {
    const currentHash = await bcrypt.hash('ClaveTemporal2026!', 10);
    Auth.getUser.mockResolvedValue({
      data: {
        CODUSU: 'USR02',
        NOMUSU: 'Usuario Temporal',
        CLAVE: currentHash,
        CLAVE_ANT: null,
        CODPERFIL: 'ASEGURADO'
      }
    });
    Auth.updatePassword.mockResolvedValue({ success: true });

    const expTime = Math.floor(Date.now() / 1000) + 3600;
    const tempToken = 'jwt-temp-token-sample';

    const result = await setPasswordFromSession({
      username: 'USR02',
      newPassword: 'ClaveNuevaDefinitiva2026#',
      currentToken: tempToken,
      currentTokenExp: expTime
    });

    expect(result).toHaveProperty('token');
    expect(result).toHaveProperty('expiresIn');
    expect(result.message).toContain('exitosa');
  });

  /**
   * ID: S007-AUTH
   * Descripción: Validar que requestPasswordReset bloquee solicitudes repetidas con HTTP 429 por período de enfriamiento (cooldown)
   * Resultado Esperado: Segunda solicitud inmediata para el mismo usuario debe ser rechazada con status 429
   */
  test('[S007-AUTH] Debería activar cooldown y bloquear envíos sucesivos de recuperación con HTTP 429', async () => {
    Auth.getUser.mockResolvedValue({
      data: {
        CODUSU: 'USR03',
        NOMUSU: 'Usuario Cooldown',
        EMAIL: 'cooldown@constitucion.com'
      }
    });

    const firstRes = await requestPasswordReset('cooldown@constitucion.com');
    expect(firstRes.status).toBe(true);

    await expect(
      requestPasswordReset('cooldown@constitucion.com')
    ).rejects.toMatchObject({
      statusCode: 429,
      message: expect.stringContaining('recientemente')
    });
  });

  /**
   * ID: S008-AUTH
   * Descripción: Validar que verifyResetToken rechace tokens no suministrados o inválidos
   * Resultado Esperado: Debe arrojar error 400 o 401 si el token no existe o tiene firma errónea
   */
  test('[S008-AUTH] Debería rechazar verifyResetToken con tokens ausentes o alterados', async () => {
    await expect(verifyResetToken('')).rejects.toThrow('Token de recuperación no suministrado.');
    await expect(verifyResetToken('token-invalido-o-falso')).rejects.toThrow('El enlace de recuperación es inválido o ha expirado');
  });

  /**
   * ID: S009-AUTH
   * Descripción: Validar que verifyResetToken rechace tokens cuyo propósito no sea password_reset
   * Resultado Esperado: Debe arrojar error 401 indicando que no corresponde a recuperación de contraseña
   */
  test('[S009-AUTH] Debería rechazar tokens cuyo propósito no sea password_reset', async () => {
    const wrongPurposeToken = jwt.sign(
      { username: 'USR04', purpose: 'general_session' },
      getJwtSecret(),
      { expiresIn: '1h' }
    );

    await expect(verifyResetToken(wrongPurposeToken)).rejects.toThrow(
      'no corresponde a una recuperación de contraseña'
    );
  });

  /**
   * ID: S010-AUTH
   * Descripción: Validar que resetPasswordWithToken revoque el token de 72h tras actualizar la contraseña
   * Resultado Esperado: La contraseña debe ser actualizada y el token revocado para impedir reuso
   */
  test('[S010-AUTH] Debería restablecer la contraseña, revocar el token de recuperación y emitir sesión', async () => {
    const resetToken = jwt.sign(
      { username: 'USR05', email: 'usr05@constitucion.com', purpose: 'password_reset' },
      getJwtSecret(),
      { expiresIn: '72h' }
    );

    const oldHash = await bcrypt.hash('ClaveVieja2025#', 10);
    Auth.getUser.mockResolvedValue({
      data: {
        CODUSU: 'USR05',
        NOMUSU: 'Usuario Reseteo',
        EMAIL: 'usr05@constitucion.com',
        CODPERFIL: 'ASEGURADO',
        CLAVE: oldHash,
        CLAVE_ANT: null
      }
    });
    Auth.updatePassword.mockResolvedValue({ success: true });

    const result = await resetPasswordWithToken({
      token: resetToken,
      newPassword: 'NuevaClaveFuerteOptima2026!'
    });

    expect(result).toHaveProperty('token');
    expect(result.user.username).toBe('USR05');
    expect(Auth.updatePassword).toHaveBeenCalledWith('USR05', expect.any(String), {
      requireChange: false,
      status: 'ACT'
    });

    // Intentar reusar el mismo token debe ser rechazado por haber sido revocado
    await expect(
      resetPasswordWithToken({
        token: resetToken,
        newPassword: 'OtraClaveCualquiera2026!'
      })
    ).rejects.toThrow('Este enlace de recuperación ya ha sido utilizado.');
  });
});
