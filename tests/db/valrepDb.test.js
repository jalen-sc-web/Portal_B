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

import Valrep from '../../src/db/Valrep.js';

describe('Valrep DB - Capa de Acceso a Datos de Catálogos Acsel (Mocks)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * ID: S001-DVAL
   * Descripción: Validar que getCountry consulte la tabla PAIS y cierre la conexión
   * Resultado Esperado: Debe retornar el arreglo de países obtenido de rows y cerrar la conexión
   */
  test('[S001-DVAL] Debería consultar la lista de países y cerrar la conexión', async () => {
    const mockRows = [{ CODPAIS: '001', DESCPAIS: 'VENEZUELA' }];
    mockConnection.execute.mockResolvedValue({ rows: mockRows });

    const result = await Valrep.getCountry();

    expect(result.data).toEqual(mockRows);
    expect(mockConnection.execute).toHaveBeenCalledWith(
      expect.stringContaining('LOCALCONSSEG."PAIS"'),
      {},
      expect.anything()
    );
    expect(mockConnection.close).toHaveBeenCalledTimes(1);
  });

  /**
   * ID: S002-DVAL
   * Descripción: Validar que getState consulte la tabla ESTADO filtrando por codpais
   * Resultado Esperado: Debe enlazar el bind codpais y retornar la lista de estados
   */
  test('[S002-DVAL] Debería consultar estados asociados al país correspondiente', async () => {
    const mockRows = [{ CODESTADO: '01', DESCESTADO: 'DISTRITO CAPITAL' }];
    mockConnection.execute.mockResolvedValue({ rows: mockRows });

    const result = await Valrep.getState({ codpais: '001' });

    expect(result.data).toEqual(mockRows);
    expect(mockConnection.execute).toHaveBeenCalledWith(
      expect.stringContaining('LOCALCONSSEG."ESTADO"'),
      { codpais: '001' },
      expect.anything()
    );
    expect(mockConnection.close).toHaveBeenCalledTimes(1);
  });

  /**
   * ID: S003-DVAL
   * Descripción: Validar que getCity consulte la tabla CIUDAD con binds codpais y codestado
   * Resultado Esperado: Debe pasar los binds correctos y cerrar la conexión
   */
  test('[S003-DVAL] Debería consultar ciudades vinculando país y estado', async () => {
    const mockRows = [{ CODCIUDAD: '001', DESCCIUDAD: 'CARACAS' }];
    mockConnection.execute.mockResolvedValue({ rows: mockRows });

    const result = await Valrep.getCity({ codpais: '001', codestado: '01' });

    expect(result.data).toEqual(mockRows);
    expect(mockConnection.execute).toHaveBeenCalledWith(
      expect.stringContaining('LOCALCONSSEG."CIUDAD"'),
      { codpais: '001', codestado: '01' },
      expect.anything()
    );
    expect(mockConnection.close).toHaveBeenCalledTimes(1);
  });

  /**
   * ID: S004-DVAL
   * Descripción: Validar que getMunicipality consulte la tabla MUNICIPIO con sus 3 parámetros
   * Resultado Esperado: Debe enlazar codpais, codestado, codciudad y cerrar la conexión
   */
  test('[S004-DVAL] Debería consultar municipios con sus parámetros jerárquicos', async () => {
    const mockRows = [{ CODMUNICIPIO: '001', DESCMUNICIPIO: 'LIBERTADOR' }];
    mockConnection.execute.mockResolvedValue({ rows: mockRows });

    const result = await Valrep.getMunicipality({ codpais: '001', codestado: '01', codciudad: '001' });

    expect(result.data).toEqual(mockRows);
    expect(mockConnection.execute).toHaveBeenCalledWith(
      expect.stringContaining('LOCALCONSSEG."MUNICIPIO"'),
      { codpais: '001', codestado: '01', codciudad: '001' },
      expect.anything()
    );
    expect(mockConnection.close).toHaveBeenCalledTimes(1);
  });

  /**
   * ID: S005-DVAL
   * Descripción: Validar que getLval consulte la tabla LVAL con el bind tipolval
   * Resultado Esperado: Debe enlazar tipolval y retornar la lista de valores
   */
  test('[S005-DVAL] Debería consultar tablas de valores referenciales LVAL', async () => {
    const mockRows = [{ CODLVAL: 'M', DESCLVAL: 'MASCULINO' }];
    mockConnection.execute.mockResolvedValue({ rows: mockRows });

    const result = await Valrep.getLval({ tipolval: 'SEXO' });

    expect(result.data).toEqual(mockRows);
    expect(mockConnection.execute).toHaveBeenCalledWith(
      expect.stringContaining('LOCALCONSSEG.LVAL'),
      { tipolval: 'SEXO' },
      expect.anything()
    );
    expect(mockConnection.close).toHaveBeenCalledTimes(1);
  });

  /**
   * ID: S006-DVAL
   * Descripción: Validar que errores en consultas de catálogos sean capturados cerrando la conexión
   * Resultado Esperado: Debe retornar { error: ... } y garantizar el cierre de conexión
   */
  test('[S006-DVAL] Debería capturar errores de base de datos en catálogos y cerrar conexión', async () => {
    mockConnection.execute.mockRejectedValue(new Error('ORA-01017: invalid username/password'));

    const result = await Valrep.getCountry();

    expect(result).toHaveProperty('error');
    expect(mockConnection.close).toHaveBeenCalledTimes(1);
  });
});
