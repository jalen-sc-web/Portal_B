import { describe, test, expect } from 'vitest';
import bcrypt from 'bcryptjs';
import {
  isBlacklisted,
  calculatePasswordStrength,
  validateNewPassword
} from '../../src/utils/passwordValidator.js';

describe('PasswordValidator - Validación de Fortaleza y Lista Negra', () => {
  /**
   * ID: S001-PWD
   * Descripción: Validar que contraseñas comunes o institucionales en la lista negra sean detectadas
   * Resultado Esperado: Debe retornar true para términos conocidos de la lista negra
   */
  test('[S001-PWD] Debería identificar contraseñas comunes presentes en la lista negra', () => {
    expect(isBlacklisted('123456')).toBe(true);
    expect(isBlacklisted('password')).toBe(true);
    expect(isBlacklisted('constitucion')).toBe(true);
    expect(isBlacklisted('portal2024')).toBe(true);
    expect(isBlacklisted('qwerty')).toBe(true);
  });

  /**
   * ID: S002-PWD
   * Descripción: Validar que contraseñas seguras y legítimas no sean marcadas como lista negra
   * Resultado Esperado: Debe retornar false para contraseñas que no coincidan con términos prohibidos
   */
  test('[S002-PWD] Debería permitir contraseñas legítimas fuera de la lista negra', () => {
    expect(isBlacklisted('M1Cl@veS3gur@#2026')).toBe(false);
    expect(isBlacklisted('ProtegidaOptima99!')).toBe(false);
  });

  /**
   * ID: S003-PWD
   * Descripción: Validar que contraseñas con longitud menor a 8 caracteres sean catalogadas como inseguras
   * Resultado Esperado: Debe retornar score 0, label "Insegura" y acceptable en false
   */
  test('[S003-PWD] Debería calificar con score 0 e Insegura si la longitud es inferior a 8 caracteres', () => {
    const result = calculatePasswordStrength('Ab1@');
    expect(result.score).toBe(0);
    expect(result.acceptable).toBe(false);
    expect(result.label).toBe('Insegura');
    expect(result.feedback).toContain('8 caracteres');
  });

  /**
   * ID: S004-PWD
   * Descripción: Validar que la contraseña no contenga el nombre de usuario
   * Resultado Esperado: Debe retornar score 0 e indicar que no puede contener el usuario
   */
  test('[S004-PWD] Debería rechazar contraseñas que contengan el nombre de usuario del contexto', () => {
    const result = calculatePasswordStrength('ClaveDeLcovis2026!', { username: 'lcovis' });
    expect(result.score).toBe(0);
    expect(result.acceptable).toBe(false);
    expect(result.feedback).toContain('nombre de usuario');
  });

  /**
   * ID: S005-PWD
   * Descripción: Validar que la contraseña no contenga el correo o fragmento del nombre del usuario
   * Resultado Esperado: Debe retornar score 0 e indicar el motivo de datos personales
   */
  test('[S005-PWD] Debería rechazar contraseñas con datos personales (email o nombre de pila)', () => {
    const emailResult = calculatePasswordStrength('juan123456!', { email: 'juan@empresa.com' });
    expect(emailResult.score).toBe(0);
    expect(emailResult.acceptable).toBe(false);

    const nameResult = calculatePasswordStrength('MiCarlosSeguro99!', { nombre: 'Carlos Mendoza' });
    expect(nameResult.score).toBe(0);
    expect(nameResult.acceptable).toBe(false);
  });

  /**
   * ID: S006-PWD
   * Descripción: Validar que contraseñas con longitud básica pero sin suficiente variedad reciban score Débil
   * Resultado Esperado: Debe calificar score 1, label "Débil" y acceptable en false
   */
  test('[S006-PWD] Debería calificar como Débil (score 1) cuando no combina factores requeridos', () => {
    const result = calculatePasswordStrength('sololetrasminusculas');
    expect(result.score).toBe(1);
    expect(result.acceptable).toBe(false);
    expect(result.label).toBe('Débil');
  });

  /**
   * ID: S007-PWD
   * Descripción: Validar que contraseñas que cumplan 3 factores alcancen nivel Aceptable (mínimo permitido)
   * Resultado Esperado: Debe retornar score 2, label "Aceptable" y acceptable en true
   */
  test('[S007-PWD] Debería calificar como Aceptable (score 2) con longitud >= 8, mayúsculas, minúsculas y números', () => {
    const result = calculatePasswordStrength('Abcdefgh8');
    expect(result.score).toBe(2);
    expect(result.acceptable).toBe(true);
    expect(result.label).toBe('Aceptable');
  });

  /**
   * ID: S008-PWD
   * Descripción: Validar que contraseñas con longitud extendida mayor a 24 caracteres reciban bonificación por blindaje de complejidad
   * Resultado Esperado: Debe otorgar el punto adicional permitiendo nivel Aceptable en passphrases largas
   */
  test('[S008-PWD] Debería otorgar bonificación por complejidad para contraseñas de más de 24 caracteres', () => {
    const result = calculatePasswordStrength('frasedepasomuylargasinespecial');
    expect(result.score).toBe(2);
    expect(result.acceptable).toBe(true);
    expect(result.label).toBe('Aceptable');
  });

  /**
   * ID: S009-PWD
   * Descripción: Validar que contraseñas robustas con todos los factores alcancen nivel Fuerte
   * Resultado Esperado: Debe retornar score 4, label "Fuerte" y acceptable en true
   */
  test('[S009-PWD] Debería calificar con score 4 (Fuerte) cuando cumple con todos los factores de seguridad', () => {
    const result = calculatePasswordStrength('Cl@veRobustaSegura2026!');
    expect(result.score).toBe(4);
    expect(result.acceptable).toBe(true);
    expect(result.label).toBe('Fuerte');
  });

  /**
   * ID: S010-PWD
   * Descripción: Validar que validateNewPassword rechace una contraseña idéntica a la clave actual (CLAVE)
   * Resultado Esperado: Debe arrojar error 400 indicando que no puede ser igual a la clave actual
   */
  test('[S010-PWD] Debería rechazar la nueva contraseña si coincide con la clave actual del usuario', async () => {
    const currentHash = await bcrypt.hash('MiClaveActual2026!', 10);
    const mockUser = {
      CODUSU: 'USER01',
      CLAVE: currentHash,
      CLAVE_ANT: null
    };

    await expect(validateNewPassword('MiClaveActual2026!', mockUser))
      .rejects.toThrow('La nueva contraseña no puede ser igual a su contraseña actual.');
  });

  /**
   * ID: S011-PWD
   * Descripción: Validar que validateNewPassword rechace una contraseña idéntica a la clave anterior (CLAVE_ANT)
   * Resultado Esperado: Debe arrojar error 400 indicando que no puede reutilizar la clave anterior
   */
  test('[S011-PWD] Debería rechazar la nueva contraseña si coincide con la clave anterior (CLAVE_ANT)', async () => {
    const prevHash = await bcrypt.hash('MiClaveAnterior2025!', 10);
    const currentHash = await bcrypt.hash('OtraClaveVigente2026!', 10);
    const mockUser = {
      CODUSU: 'USER01',
      CLAVE: currentHash,
      CLAVE_ANT: prevHash
    };

    await expect(validateNewPassword('MiClaveAnterior2025!', mockUser))
      .rejects.toThrow('No puede reutilizar su contraseña anterior por motivos de seguridad.');
  });

  /**
   * ID: S012-PWD
   * Descripción: Validar que validateNewPassword acepte una clave válida y distinta del historial
   * Resultado Esperado: Debe retornar true sin lanzar excepciones
   */
  test('[S012-PWD] Debería aceptar exitosamente una contraseña de nivel Aceptable o superior distinta del historial', async () => {
    const prevHash = await bcrypt.hash('Antigua2025!', 10);
    const currentHash = await bcrypt.hash('Actual2026!', 10);
    const mockUser = {
      CODUSU: 'USER01',
      CLAVE: currentHash,
      CLAVE_ANT: prevHash
    };

    const result = await validateNewPassword('TotalmenteNueva2026#', mockUser);
    expect(result).toBe(true);
  });
});
