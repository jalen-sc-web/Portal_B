import { describe, test, expect } from 'vitest';
import { isEmailAllowed } from '../../src/utils/mailer.js';

describe('Mailer Utility - Validación de Lista Blanca (Whitelist)', () => {
  /**
   * ID: S001-MAIL
   * Descripción: Validar que todos los correos sean permitidos cuando no se configure lista blanca
   * Resultado Esperado: Debe retornar true para cualquier correo cuando la whitelist esté vacía o no definida
   */
  test('[S001-MAIL] Debería permitir cualquier correo si la lista blanca no está configurada o es asterisco', () => {
    expect(isEmailAllowed('usuario@cualquiera.com', '')).toBe(true);
    expect(isEmailAllowed('usuario@cualquiera.com', '*')).toBe(true);
    expect(isEmailAllowed('usuario@cualquiera.com', undefined)).toBe(true);
  });

  /**
   * ID: S002-MAIL
   * Descripción: Validar coincidencia exacta de correos autorizados en la lista blanca
   * Resultado Esperado: Debe retornar true si el correo está explícitamente en la lista
   */
  test('[S002-MAIL] Debería permitir envíos a direcciones de correo especificadas de forma exacta', () => {
    const whitelist = 'dev@empresa.com, qa@empresa.com';
    expect(isEmailAllowed('dev@empresa.com', whitelist)).toBe(true);
    expect(isEmailAllowed('qa@empresa.com', whitelist)).toBe(true);
    expect(isEmailAllowed('otro@empresa.com', whitelist)).toBe(false);
  });

  /**
   * ID: S003-MAIL
   * Descripción: Validar autorización de correos basados en comodines de dominio (*@dominio o @dominio)
   * Resultado Esperado: Debe retornar true para correos pertenecientes al dominio autorizado
   */
  test('[S003-MAIL] Debería permitir correos que coincidan con comodines de dominio empresarial', () => {
    const whitelist = '*@constitucion.com, @seguros.com';
    expect(isEmailAllowed('juan.perez@constitucion.com', whitelist)).toBe(true);
    expect(isEmailAllowed('soporte@seguros.com', whitelist)).toBe(true);
    expect(isEmailAllowed('juan.perez@gmail.com', whitelist)).toBe(false);
  });

  /**
   * ID: S004-MAIL
   * Descripción: Validar bloqueo de envíos hacia dominios no autorizados cuando la whitelist está activa
   * Resultado Esperado: Debe retornar false protegiendo de envíos accidentales a clientes
   */
  test('[S004-MAIL] Debería rechazar correos no autorizados evitando envíos accidentales', () => {
    const whitelist = '*@constitucion.com';
    expect(isEmailAllowed('cliente_real@hotmail.com', whitelist)).toBe(false);
    expect(isEmailAllowed('destinatario@yahoo.es', whitelist)).toBe(false);
  });

  /**
   * ID: S005-MAIL
   * Descripción: Validar manejo de valores nulos o vacíos en el correo destino
   * Resultado Esperado: Debe retornar false de forma segura sin excepciones no controladas
   */
  test('[S005-MAIL] Debería retornar false cuando el correo destino sea nulo o vacío', () => {
    const whitelist = '*@constitucion.com';
    expect(isEmailAllowed('', whitelist)).toBe(false);
    expect(isEmailAllowed(null, whitelist)).toBe(false);
    expect(isEmailAllowed(undefined, whitelist)).toBe(false);
  });
});
