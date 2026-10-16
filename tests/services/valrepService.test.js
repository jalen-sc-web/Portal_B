import { describe, test, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/db/Valrep.js', () => ({
  default: {
    getCountry: vi.fn(),
    getState: vi.fn(),
    getCity: vi.fn(),
    getMunicipality: vi.fn(),
    getLval: vi.fn()
  }
}));

import Valrep from '../../src/db/Valrep.js';
import { getCountries, getStates } from '../../src/services/valrepService.js';

describe('ValrepService - Catálogos Maestros de Acsel y Caché en Memoria', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * ID: S001-VALR
   * Descripción: Validar que getCountries consulte la base de datos la primera vez y use caché en llamadas posteriores
   * Resultado Esperado: La segunda llamada debe retornar los datos de caché sin llamar nuevamente a Valrep.getCountry
   */
  test('[S001-VALR] Debería consultar la base de datos y cachear países para subsecuentes consultas', async () => {
    const mockCountries = [{ codpais: 1, despais: 'VENEZUELA' }, { codpais: 2, despais: 'COLOMBIA' }];
    Valrep.getCountry.mockResolvedValue({ data: mockCountries });

    const firstCall = await getCountries();
    expect(firstCall).toEqual(mockCountries);
    expect(Valrep.getCountry).toHaveBeenCalledTimes(1);

    // Segunda llamada debe resolverse desde la caché en memoria
    const secondCall = await getCountries();
    expect(secondCall).toEqual(mockCountries);
    expect(Valrep.getCountry).toHaveBeenCalledTimes(1);
  });

  /**
   * ID: S002-VALR
   * Descripción: Validar que getStates exija el parámetro codpais
   * Resultado Esperado: Debe arrojar error 400 con mensaje de parámetro requerido
   */
  test('[S002-VALR] Debería rechazar la consulta de estados si no se suministra codpais', async () => {
    await expect(getStates('')).rejects.toThrow('El parámetro codpais es requerido.');
    await expect(getStates(null)).rejects.toThrow('El parámetro codpais es requerido.');
  });

  /**
   * ID: S003-VALR
   * Descripción: Validar que getStates retorne estados y maneje errores de base de datos
   * Resultado Esperado: Debe arrojar error 500 operacional si Valrep reporta falla
   */
  test('[S003-VALR] Debería propagar error operacional si la base de datos falla al consultar estados', async () => {
    Valrep.getState.mockResolvedValue({ error: 'Error de conexión Oracle en estados' });

    await expect(getStates(999)).rejects.toThrow('Error de conexión Oracle en estados');
  });
});
