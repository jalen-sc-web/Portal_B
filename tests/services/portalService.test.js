import { describe, test, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/db/Portal.js', () => ({
  default: {
    getOwner: vi.fn(),
  }
}));

import Portal from '../../src/db/Portal.js';
import { getOwnerDetails } from '../../src/services/portalService.js';

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
});
