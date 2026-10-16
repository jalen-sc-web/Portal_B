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

import Portal from '../../src/db/Portal.js';

describe('Portal DB - Capa de Acceso a Datos de Acsel / Clientes (Mocks)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * ID: S001-DPOR
   * Descripción: Validar que getOwner ejecute la consulta consolidada con JOINs y cierre la conexión
   * Resultado Esperado: Debe invocar execute con binds de tipoid, numid, dvid y cerrar conexión
   */
  test('[S001-DPOR] Debería consultar titular con consulta unificada y cerrar la conexión', async () => {
    const mockRow = {
      CODCLI: 555,
      NOMTER: 'ALBERTO',
      APETER: 'PEREZ',
      TIPOID: 'V',
      NUMID: 15000000,
      DVID: 0
    };
    mockConnection.execute.mockResolvedValue({ rows: [mockRow] });

    const result = await Portal.getOwner({ tipoid: 'V', numid: 15000000, dvid: 0 });

    expect(result.status).toBe(true);
    expect(result.data).toEqual(mockRow);
    expect(mockConnection.execute).toHaveBeenCalledWith(
      expect.stringContaining('LOCALCONSSEG.CLIENTE'),
      { tipoid: 'V', numid: 15000000, dvid: 0 },
      expect.anything()
    );
    expect(mockConnection.close).toHaveBeenCalledTimes(1);
  });

  /**
   * ID: S002-DPOR
   * Descripción: Validar que getOwner asigne dvid en 0 cuando no sea provisto
   * Resultado Esperado: El bind dvid debe ser 0 en la sentencia ejecutada
   */
  test('[S002-DPOR] Debería normalizar dvid en 0 cuando es nulo o indefinido', async () => {
    mockConnection.execute.mockResolvedValue({ rows: [] });

    await Portal.getOwner({ tipoid: 'V', numid: 15000000, dvid: null });

    expect(mockConnection.execute).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ dvid: 0 }),
      expect.anything()
    );
    expect(mockConnection.close).toHaveBeenCalledTimes(1);
  });

  /**
   * ID: S003-DPOR
   * Descripción: Validar que getOwner retorne status en false cuando no haya registros
   * Resultado Esperado: Debe responder status: false y data: null sin arrojar excepción
   */
  test('[S003-DPOR] Debería responder status en false y data nula cuando el titular no existe', async () => {
    mockConnection.execute.mockResolvedValue({ rows: [] });

    const result = await Portal.getOwner({ tipoid: 'V', numid: 99999999 });

    expect(result.status).toBe(false);
    expect(result.data).toBeNull();
    expect(result.message).toContain('Titular no encontrado');
    expect(mockConnection.close).toHaveBeenCalledTimes(1);
  });

  /**
   * ID: S004-DPOR
   * Descripción: Validar que getOwner capture errores de conexión o SQL y cierre la conexión
   * Resultado Esperado: Debe retornar status: false con propiedad error y cerrar la conexión en finally
   */
  test('[S004-DPOR] Debería capturar errores de Oracle y garantizar el cierre de la conexión', async () => {
    mockConnection.execute.mockRejectedValue(new Error('ORA-03113: end-of-file on communication channel'));

    const result = await Portal.getOwner({ tipoid: 'V', numid: 15000000 });

    expect(result.status).toBe(false);
    expect(result.error).toContain('Error en la base de datos');
    expect(mockConnection.close).toHaveBeenCalledTimes(1);
  });
});
