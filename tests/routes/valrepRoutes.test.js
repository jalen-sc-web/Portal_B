import { describe, test, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

vi.mock('../../src/services/valrepService.js', () => ({
  default: {
    getCountries: vi.fn(),
    getStates: vi.fn(),
    getCities: vi.fn(),
    getMunicipalities: vi.fn(),
    getLval: vi.fn()
  }
}));

import valrepService from '../../src/services/valrepService.js';
import app from '../../src/portal.js';

describe('Valrep Routes - Rutas de Catálogos Maestros Acsel (HTTP)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * ID: C001-VALR
   * Descripción: Validar que GET /country retorne HTTP 200 y la lista de países
   * Resultado Esperado: Debe responder status 200 y el array de países
   */
  test('[C001-VALR] Debería retornar HTTP 200 y lista de países en GET /country', async () => {
    const mockCountries = [{ codpais: 1, despais: 'VENEZUELA' }];
    valrepService.getCountries.mockResolvedValue(mockCountries);

    const res = await request(app).get('/apixportal/api/v1/valrep/country');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe(true);
    expect(res.body.data).toEqual(mockCountries);
  });

  /**
   * ID: C002-VALR
   * Descripción: Validar que GET /state retorne HTTP 200 cuando se incluye el query param codpais
   * Resultado Esperado: Debe responder statusCode 200 con la lista de estados del país solicitado
   */
  test('[C002-VALR] Debería retornar HTTP 200 y lista de estados en GET /state con codpais', async () => {
    const mockStates = [{ codpais: 1, codestado: 1, descestado: 'MIRANDA' }];
    valrepService.getStates.mockResolvedValue(mockStates);

    const res = await request(app).get('/apixportal/api/v1/valrep/state?codpais=1');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe(true);
    expect(res.body.data).toEqual(mockStates);
  });

  /**
   * ID: C003-VALR
   * Descripción: Validar que GET /state retorne HTTP 400 cuando falta el parámetro codpais
   * Resultado Esperado: Debe responder con statusCode 400 y mensaje de error operacional
   */
  test('[C003-VALR] Debería retornar HTTP 400 cuando se omite codpais en GET /state', async () => {
    const err = new Error('El parámetro codpais es requerido.');
    err.statusCode = 400;
    err.isOperational = true;
    valrepService.getStates.mockRejectedValue(err);

    const res = await request(app).get('/apixportal/api/v1/valrep/state');

    expect(res.status).toBe(400);
    expect(res.body.status).toBe(false);
    expect(res.body.message).toContain('codpais');
  });

  /**
   * ID: C004-VALR
   * Descripción: Validar soporte retrocompatible de endpoints mediante método POST
   * Resultado Esperado: Debe responder con statusCode 200 en POST /country
   */
  test('[C004-VALR] Debería responder exitosamente con HTTP 200 en llamadas POST retrocompatibles', async () => {
    valrepService.getCountries.mockResolvedValue([{ codpais: 1, despais: 'VENEZUELA' }]);

    const res = await request(app).post('/apixportal/api/v1/valrep/country');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe(true);
  });
});
