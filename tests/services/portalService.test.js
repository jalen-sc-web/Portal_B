import { describe, test, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/db/Portal.js', () => ({
  default: {
    getOwner: vi.fn(),
    getFullRate: vi.fn(),
    getFuneralRate: vi.fn(),
    saveQuote: vi.fn()
  }
}));

import Portal from '../../src/db/Portal.js';
import { getOwnerDetails, getFullRateDetails } from '../../src/services/portalService.js';

describe('PortalService - Consulta de Titulares y Clientes Acsel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * ID: S001-PORT
   * Descripción: Validar que getOwnerDetails requiera tipoid y numid obligatoriamente
   * Resultado Esperado: Debe arrojar error 400 si tipoid o numid están ausentes
   */
  test('[S001-PORT] Debería rechazar la consulta si faltan tipoid o numid', async () => {
    await expect(getOwnerDetails({ tipoid: '', numid: '12345' }))
      .rejects.toThrow('Los campos tipoid y numid son requeridos.');
    await expect(getOwnerDetails({ tipoid: 'V', numid: '' }))
      .rejects.toThrow('Los campos tipoid y numid son requeridos.');
  });

  /**
   * ID: S002-PORT
   * Descripción: Validar mapeo correcto de tipoid a tipocli (P para V/E, G para G, E por defecto)
   * Resultado Esperado: tipocli debe asignarse acordemente según el tipo de documento
   */
  test('[S002-PORT] Debería mapear correctamente tipoid a la clasificación tipocli de Acsel', async () => {
    Portal.getOwner.mockResolvedValue({ data: null });

    const resV = await getOwnerDetails({ tipoid: 'V', numid: '1000' });
    expect(resV.data.tipocli).toBe('P');

    const resG = await getOwnerDetails({ tipoid: 'G', numid: '2000' });
    expect(resG.data.tipocli).toBe('G');

    const resJ = await getOwnerDetails({ tipoid: 'J', numid: '3000' });
    expect(resJ.data.tipocli).toBe('E');
  });

  /**
   * ID: S003-PORT
   * Descripción: Validar que retorne estructura limpia con found en false cuando el titular no existe
   * Resultado Esperado: Debe retornar found: false y mensaje informativo sin lanzar excepciones
   */
  test('[S003-PORT] Debería retornar found en false cuando el titular no existe en la base de datos', async () => {
    Portal.getOwner.mockResolvedValue({ data: null });

    const result = await getOwnerDetails({ tipoid: 'V', numid: '99999999' });

    expect(result.found).toBe(false);
    expect(result.message).toContain('No se encontró el titular');
    expect(result.data.indnacional).toBe('N');
  });

  /**
   * ID: S004-PORT
   * Descripción: Validar que retorne datos completos del titular cuando existe en Acsel
   * Resultado Esperado: Debe retornar found: true y los datos consolidados del cliente
   */
  test('[S004-PORT] Debería retornar los datos completos del titular cuando es localizado', async () => {
    const mockData = {
      CODCLI: 101,
      TIPOID: 'V',
      NUMID: 12345678,
      DVID: 0,
      NOMTER: 'GONZALEZ',
      APETER: 'PEDRO',
      EMAIL: 'pedro@correo.com'
    };
    Portal.getOwner.mockResolvedValue({ data: mockData });

    const result = await getOwnerDetails({ tipoid: 'V', numid: '12345678' });

    expect(result.found).toBe(true);
    expect(result.data.codcli).toBe(101);
    expect(result.data.nomter).toBe('GONZALEZ');
  });

  test('[S005-PORT] Debería calcular tarifas funerarias individuales para codProd 1010', async () => {
    Portal.getFuneralRate.mockResolvedValue({
      status: true,
      data: [
        {
          CODPLAN: '80',
          REVPLAN: '001',
          INDTIPOPLAN: 'I',
          DESCPLAN: '1.000$ TITULAR SOLO SERVFUNER',
          CODCOBERT: '1001',
          DESCCOBERT: 'GASTOS FUNERARIOS',
          DEDUCIBLE: 0,
          ID_FAMILIAR: 1,
          CODPARENT: '0001',
          EDADFAMILIAR: 36,
          PRIMACOBERT: 21,
          SUMAASEG: 1000,
          MAXPARENT: 1
        }
      ]
    });

    const result = await getFullRateDetails({
      codProd: '1010',
      indTipoPlan: 'I',
      familiares: [{ codParent: '0001', fechanac: '1990-01-10' }]
    });

    expect(result.found).toBe(true);
    expect(result.data.planes).toHaveLength(1);
    expect(result.data.planes[0]).toMatchObject({
      codPlan: '80',
      revPlan: '001',
      primaTotal: 21,
      sumaAsegurada: 1000,
      indTipoPlan: 'I'
    });
  });

  test('[S006-PORT] Debería calcular tarifas funerarias familiares y excluir planes con edad fuera de rango', async () => {
    Portal.getFuneralRate.mockResolvedValue({
      status: true,
      data: [
        {
          CODPLAN: '80',
          REVPLAN: '002',
          INDTIPOPLAN: 'G',
          DESCPLAN: '1.000$ GRUPO FAMILIAR',
          CODCOBERT: '1001',
          DESCCOBERT: 'GASTOS FUNERARIOS',
          DEDUCIBLE: 0,
          ID_FAMILIAR: 1,
          CODPARENT: '0001',
          EDADFAMILIAR: 40,
          PRIMACOBERT: 74,
          SUMAASEG: 1000,
          MAXPARENT: 1
        },
        {
          CODPLAN: '80',
          REVPLAN: '002',
          INDTIPOPLAN: 'G',
          DESCPLAN: '1.000$ GRUPO FAMILIAR',
          CODCOBERT: '1001',
          DESCCOBERT: 'GASTOS FUNERARIOS',
          DEDUCIBLE: 0,
          ID_FAMILIAR: 2,
          CODPARENT: '0008',
          EDADFAMILIAR: 77,
          PRIMACOBERT: 0,
          SUMAASEG: 1000,
          MAXPARENT: 1
        },
        {
          CODPLAN: '80',
          REVPLAN: '004',
          INDTIPOPLAN: 'G',
          DESCPLAN: '3.000$ GRUPO FAMILIAR',
          CODCOBERT: '1001',
          DESCCOBERT: 'GASTOS FUNERARIOS',
          DEDUCIBLE: 0,
          ID_FAMILIAR: 1,
          CODPARENT: '0001',
          EDADFAMILIAR: 40,
          PRIMACOBERT: 122,
          SUMAASEG: 3000,
          MAXPARENT: 1
        },
        {
          CODPLAN: '80',
          REVPLAN: '004',
          INDTIPOPLAN: 'G',
          DESCPLAN: '3.000$ GRUPO FAMILIAR',
          CODCOBERT: '1001',
          DESCCOBERT: 'GASTOS FUNERARIOS',
          DEDUCIBLE: 0,
          ID_FAMILIAR: 2,
          CODPARENT: '0008',
          EDADFAMILIAR: 77,
          PRIMACOBERT: null,
          SUMAASEG: null,
          MAXPARENT: null
        }
      ]
    });

    const result = await getFullRateDetails({
      codProd: '1010',
      indTipoPlan: 'G',
      familiares: [
        { codParent: '0001', edad: 40 },
        { codParent: '0008', edad: 77 }
      ]
    });

    expect(result.found).toBe(true);
    expect(result.data.planes).toHaveLength(1);
    expect(result.data.planes[0].codPlan).toBe('80');
    expect(result.data.planes[0].revPlan).toBe('002');
  });

  test('[S007-PORT] Debería rechazar titular menor de 18 años o más de 6 asegurados en Funerario', async () => {
    const anioMenor = new Date().getFullYear() - 15;
    await expect(
      getFullRateDetails({
        codProd: '1010',
        indTipoPlan: 'I',
        familiares: [{ codParent: '0001', fechanac: `${anioMenor}-01-01` }]
      })
    ).rejects.toThrow('mayor de edad');

    await expect(
      getFullRateDetails({
        codProd: '1010',
        indTipoPlan: 'G',
        familiares: [
          { codParent: '0001', edad: 40 },
          { codParent: '0004', edad: 38 },
          { codParent: '0005', edad: 12 },
          { codParent: '0006', edad: 10 },
          { codParent: '0007', edad: 65 },
          { codParent: '0008', edad: 63 },
          { codParent: '0009', edad: 25 }
        ]
      })
    ).rejects.toThrow('máximo de 6 asegurados');
  });
});
