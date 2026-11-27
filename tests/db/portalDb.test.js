import { describe, test, expect, vi, beforeEach } from 'vitest';

const { mockConnection } = vi.hoisted(() => ({
  mockConnection: {
    execute: vi.fn(),
    close: vi.fn().mockResolvedValue(undefined)
  }
}));

vi.mock('../../src/config/database.js', () => ({
  getConnection: vi.fn().mockResolvedValue(mockConnection),
  getAcselConnection: vi.fn().mockResolvedValue(mockConnection),
  getPortalConnection: vi.fn().mockResolvedValue(mockConnection),
  portalTable: (table) => `WEBPORTAL.${table}`,
  acselTable: (table) => `CONSSEG.${table}`,
  SCHEMAS: { ACSEL: 'CONSSEG', PORTAL: 'WEBPORTAL' }
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
      expect.stringContaining('.CLIENTE'),
      { tipoid: 'V', numid: 15000000, dvid: 0 },
      expect.anything()
    );
    expect(mockConnection.close).toHaveBeenCalledTimes(1);
  });

  /**
   * ID: S002-DPOR
   * Descripción: Validar que getOwner asigne dvid = 0 por defecto cuando no se provee
   * Resultado Esperado: Bind de dvid debe ser 0 numérico
   */
  test('[S002-DPOR] Debería asignar dvid = 0 si no es proporcionado', async () => {
    mockConnection.execute.mockResolvedValue({ rows: [{ NUMID: 100 }] });

    await Portal.getOwner({ tipoid: 'V', numid: 100, dvid: null });

    expect(mockConnection.execute).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ dvid: 0 }),
      expect.anything()
    );
  });

  /**
   * ID: S003-DPOR
   * Descripción: Validar respuesta de no encontrado cuando la consulta devuelve arreglo vacío
   * Resultado Esperado: status: false, data: null y mensaje descriptivo
   */
  test('[S003-DPOR] Debería responder status false si no existe el registro en Acsel', async () => {
    mockConnection.execute.mockResolvedValue({ rows: [] });

    const result = await Portal.getOwner({ tipoid: 'V', numid: 99999999, dvid: 0 });

    expect(result.status).toBe(false);
    expect(result.data).toBeNull();
    expect(result.message).toBe('Titular no encontrado');
    expect(mockConnection.close).toHaveBeenCalledTimes(1);
  });

  /**
   * ID: S004-DPOR
   * Descripción: Validar captura de excepciones de base de datos garantizando el cierre de conexión
   * Resultado Esperado: Debe retornar error operacional y cerrar la conexión
   */
  test('[S004-DPOR] Debería capturar errores de Oracle y garantizar el cierre de la conexión', async () => {
    mockConnection.execute.mockRejectedValue(new Error('ORA-03113: end-of-file on communication channel'));

    const result = await Portal.getOwner({ tipoid: 'V', numid: 15000000, dvid: 0 });

    expect(result.status).toBe(false);
    expect(result.error).toBeDefined();
    expect(mockConnection.close).toHaveBeenCalledTimes(1);
  });

  test('[S005-DPOR] Debería consultar tarifas funerarias en Acsel y cerrar la conexión', async () => {
    const mockRows = [{ CODPLAN: '80', REVPLAN: '001', PRIMACOBERT: 21, SUMAASEG: 1000 }];
    mockConnection.execute.mockResolvedValue({ rows: mockRows });

    const result = await Portal.getFuneralRate({ indTipoPlan: 'I', familiares: '0001:1988-06-15' });

    expect(result.status).toBe(true);
    expect(result.data).toEqual(mockRows);
    expect(mockConnection.execute).toHaveBeenCalledWith(
      expect.stringContaining('PRIMA_COBERT_PROD'),
      { indTipoPlan: 'I', familiares: '0001:1988-06-15' },
      expect.anything()
    );
    expect(mockConnection.close).toHaveBeenCalledTimes(1);
  });

  test('[S006-DPOR] Debería capturar errores de Oracle en getFuneralRate con rawError y cerrar la conexión', async () => {
    mockConnection.execute.mockRejectedValue(new Error('ORA-00942: table or view does not exist'));

    const result = await Portal.getFuneralRate({ indTipoPlan: 'G', familiares: '0001:1988-06-15' });

    expect(result.status).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.rawError).toBeDefined();
    expect(mockConnection.close).toHaveBeenCalledTimes(1);
  });

  test('[S007-DPOR] Debería registrar la cotización insertando FECNAC en COTIZACION_HCM_ASEG', async () => {
    mockConnection.commit = vi.fn().mockResolvedValue(undefined);
    mockConnection.rollback = vi.fn().mockResolvedValue(undefined);
    mockConnection.execute
      .mockResolvedValueOnce({ outBinds: { codcoti: [201] } })
      .mockResolvedValue({});

    const result = await Portal.saveQuote({
      codProd: '1010',
      nombreAseg: 'MARIA LOPEZ',
      prima: 74,
      sumaAseg: 1000,
      hcmPlan: { codProd: '1010', codPlan: '80', revPlan: '002', nombrePlan: 'FUNERARIO', prima: 74, sumaAseg: 1000, deducible: 0 },
      asegurados: [{ codParent: '0002', fecnac: '1988-06-15', prima: 74 }],
      coberturas: [{ codCobert: '1001', descCobert: 'GASTOS FUNERARIOS', sumaAsegCob: 1000, deducible: 0, primaCob: 74 }]
    });

    expect(result.status).toBe(true);
    expect(result.data).toEqual({ codCoti: 201, codCotiRef: '1010-201' });
    expect(mockConnection.execute).toHaveBeenCalledWith(
      expect.stringContaining('FECNAC'),
      expect.objectContaining({ codCoti: 201, codParent: '0002', fecnac: '1988-06-15' })
    );
    expect(mockConnection.commit).toHaveBeenCalledTimes(1);
    expect(mockConnection.close).toHaveBeenCalledTimes(1);
  });
});
