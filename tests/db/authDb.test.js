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
   * Descripción: Validar que getUser consulte por nombre de usuario o email retornando el registro
   * Resultado Esperado: Debe retornar data con el objeto de usuario y cerrar la conexión
   */
  test('[S001-DAUT] Debería consultar usuario por identificador y cerrar la conexión', async () => {
    const mockUser = {
      CODUSU: 'USR10',
      NOMUSU: 'Usuario Test',
      CLAVE: 'hashed',
      CLAVE_ANT: null,
      STSUSU: 'ACT'
    };
    mockConnection.execute.mockResolvedValue({ rows: [mockUser] });

    const result = await Auth.getUser('USR10');

    expect(result.data).toEqual(mockUser);
    expect(mockConnection.execute).toHaveBeenCalledWith(
      expect.stringContaining('LOWER(codusu) = LOWER(:identifier)'),
      { identifier: 'USR10' },
      expect.anything()
    );
    expect(mockConnection.close).toHaveBeenCalledTimes(1);
  });

  /**
   * ID: S002-DAUT
   * Descripción: Validar que getUser agregue la cláusula stsusu = ACT cuando onlyActive sea true
   * Resultado Esperado: La sentencia SQL ejecutada debe contener la condición de usuario activo
   */
  test('[S002-DAUT] Debería incluir filtro de usuario activo cuando onlyActive es true', async () => {
    mockConnection.execute.mockResolvedValue({ rows: [] });

    await Auth.getUser('USR11', { onlyActive: true });

    const executedSql = mockConnection.execute.mock.calls[0][0];
    expect(executedSql).toContain("stsusu = 'ACT'");
    expect(mockConnection.close).toHaveBeenCalledTimes(1);
  });

  /**
   * ID: S003-DAUT
   * Descripción: Validar que getUser capture errores de Oracle y siempre cierre la conexión
   * Resultado Esperado: Debe retornar un objeto con error y garantizar el cierre de conexión en el bloque finally
   */
  test('[S003-DAUT] Debería capturar errores de base de datos sin lanzar excepciones no controladas', async () => {
    mockConnection.execute.mockRejectedValue(new Error('ORA-12541: TNS:no listener'));

    const result = await Auth.getUser('USR12');

    expect(result).toHaveProperty('error');
    expect(result.error).toContain('Error en la base de datos');
    expect(mockConnection.close).toHaveBeenCalledTimes(1);
  });

  /**
   * ID: S004-DAUT
   * Descripción: Validar que createUser ejecute el INSERT con autoCommit y maneje requireChange
   * Resultado Esperado: Debe retornar success en true cuando rowsAffected sea 1
   */
  test('[S004-DAUT] Debería insertar un nuevo usuario con autoCommit y cerrar conexión', async () => {
    mockConnection.execute.mockResolvedValue({ rowsAffected: 1 });

    const result = await Auth.createUser({
      username: 'NUEVO_USR',
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
        username: 'NUEVO_USR',
        cambioclv: 'S'
      }),
      { autoCommit: true }
    );
    expect(mockConnection.close).toHaveBeenCalledTimes(1);
  });

  /**
   * ID: S005-DAUT
   * Descripción: Validar que updatePassword actualice CLAVE y asigne CLAVE_ANT = CLAVE
   * Resultado Esperado: La sentencia SQL debe incluir SET CLAVE_ANT = CLAVE y retornar success: true
   */
  test('[S005-DAUT] Debería rotar CLAVE_ANT = CLAVE al actualizar la contraseña', async () => {
    mockConnection.execute.mockResolvedValue({ rowsAffected: 1 });

    const result = await Auth.updatePassword('USR10', 'new_hash', { requireChange: false });

    expect(result.success).toBe(true);
    const executedSql = mockConnection.execute.mock.calls[0][0];
    expect(executedSql).toContain('CLAVE_ANT = CLAVE');
    expect(executedSql).toContain('CLAVE = :hashedPassword');
    expect(mockConnection.close).toHaveBeenCalledTimes(1);
  });
});
