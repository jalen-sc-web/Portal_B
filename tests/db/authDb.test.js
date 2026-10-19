import { describe, test, expect, vi, beforeEach } from 'vitest';

const { mockConnection } = vi.hoisted(() => ({
  mockConnection: {
    execute: vi.fn(),
    close: vi.fn().mockResolvedValue(undefined)
  }
}));

vi.mock('../../src/config/database.js', () => ({
  getConnection: vi.fn().mockResolvedValue(mockConnection),
}));

import Auth from '../../src/db/Auth.js';

describe('Auth DB - Capa de Acceso a Datos de Usuarios y Autenticación (Mocks)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * ID: S001-DAUT
   * Descripción: Validar que getUser consulte por cédula normalizada y soporte REGEXP_REPLACE en DB
   * Resultado Esperado: Debe enlazar clean y cleanDigits para hallar el match numérico
   */
  test('[S001-DAUT] Debería consultar usuario por cédula normalizada a números y cerrar la conexión', async () => {
    const mockUser = {
      CODUSU: '12345678',
      NOMUSU: 'Usuario Test',
      CLAVE: 'hashed',
      CLAVE_ANT: null,
      STSUSU: 'ACT'
    };
    mockConnection.execute.mockResolvedValue({ rows: [mockUser] });

    const result = await Auth.getUser('V-12.345.678');

    expect(result.data).toEqual(mockUser);
    expect(mockConnection.execute).toHaveBeenCalledWith(
      expect.stringContaining("REGEXP_REPLACE(codusu, '[^0-9]', '') = :cleanDigits"),
      expect.objectContaining({
        clean: 'V-12.345.678',
        cleanDigits: '12345678'
      }),
      expect.anything()
    );
    expect(mockConnection.close).toHaveBeenCalledTimes(1);
  });

  /**
   * ID: S002-DAUT
   * Descripción: Validar que getUser reconozca al usuario admin antes de normalizar
   * Resultado Esperado: Debe ejecutar consulta específica para admin sin convertirlo a números
   */
  test('[S002-DAUT] Debería consultar específicamente la cuenta admin sin filtrado numérico', async () => {
    const mockAdmin = {
      CODUSU: 'admin',
      NOMUSU: 'Administrador',
      CODPERFIL: 'ADMIN',
      STSUSU: 'ACT'
    };
    mockConnection.execute.mockResolvedValue({ rows: [mockAdmin] });

    const result = await Auth.getUser('Admin');

    expect(result.data).toEqual(mockAdmin);
    const executedSql = mockConnection.execute.mock.calls[0][0];
    expect(executedSql).toContain("LOWER(codusu) = 'admin'");
    expect(mockConnection.close).toHaveBeenCalledTimes(1);
  });

  /**
   * ID: S003-DAUT
   * Descripción: Validar que getUser agregue la cláusula stsusu = ACT cuando onlyActive sea true
   * Resultado Esperado: La sentencia SQL ejecutada debe contener la condición de usuario activo
   */
  test('[S003-DAUT] Debería incluir filtro de usuario activo cuando onlyActive es true', async () => {
    mockConnection.execute.mockResolvedValue({ rows: [] });

    await Auth.getUser('12345678', { onlyActive: true });

    const executedSql = mockConnection.execute.mock.calls[0][0];
    expect(executedSql).toContain("stsusu = 'ACT'");
    expect(mockConnection.close).toHaveBeenCalledTimes(1);
  });

  /**
   * ID: S004-DAUT
   * Descripción: Validar que getUser capture errores de Oracle y siempre cierre la conexión
   * Resultado Esperado: Debe retornar un objeto con error y garantizar el cierre de conexión en el bloque finally
   */
  test('[S004-DAUT] Debería capturar errores de base de datos sin lanzar excepciones no controladas', async () => {
    mockConnection.execute.mockRejectedValue(new Error('ORA-12541: TNS:no listener'));

    const result = await Auth.getUser('12345678');

    expect(result).toHaveProperty('error');
    expect(result.error).toContain('Error en la base de datos');
    expect(mockConnection.close).toHaveBeenCalledTimes(1);
  });

  /**
   * ID: S005-DAUT
   * Descripción: Validar que createUser guarde la cédula puramente como números en la BD
   * Resultado Esperado: Debe insertar el valor normalizado numérico en CODUSU y cerrar conexión
   */
  test('[S005-DAUT] Debería insertar un nuevo usuario persistiendo únicamente números en CODUSU', async () => {
    mockConnection.execute.mockResolvedValue({ rowsAffected: 1 });

    const result = await Auth.createUser({
      username: 'V-28.000.111',
      nombre: 'Nuevo Usuario',
      hashedPassword: 'hash',
      role: 'ASEGURADO',
      email: 'nuevo@empresa.com',
      requireChange: true
    });

    expect(result.success).toBe(true);
    expect(mockConnection.execute).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO'),
      expect.objectContaining({
        username: '28000111',
        cambioclv: 'S'
      }),
      { autoCommit: true }
    );
    expect(mockConnection.close).toHaveBeenCalledTimes(1);
  });

  /**
   * ID: S006-DAUT
   * Descripción: Validar que updatePassword actualice CLAVE y asigne CLAVE_ANT = CLAVE
   * Resultado Esperado: La sentencia SQL debe incluir SET CLAVE_ANT = CLAVE y retornar success: true
   */
  test('[S006-DAUT] Debería rotar CLAVE_ANT = CLAVE al actualizar la contraseña', async () => {
    mockConnection.execute.mockResolvedValue({ rowsAffected: 1 });

    const result = await Auth.updatePassword('12345678', 'new_hash', { requireChange: false });

    expect(result.success).toBe(true);
    const executedSql = mockConnection.execute.mock.calls[0][0];
    expect(executedSql).toContain('CLAVE_ANT = CLAVE');
    expect(executedSql).toContain('CLAVE = :hashedPassword');
    expect(mockConnection.close).toHaveBeenCalledTimes(1);
  });
});
