import { describe, test, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';

vi.mock('../../src/services/portalService.js', () => ({
  default: {
    getOwnerDetails: vi.fn(),
    getFullRateDetails: vi.fn(),
    saveQuoteDetails: vi.fn()
  }
}));

import portalService from '../../src/services/portalService.js';
import app from '../../src/portal.js';
import { getJwtSecret } from '../../src/middlewares/authMiddleware.js';

describe('Portal Routes - Rutas de Consulta de Titulares Acsel (HTTP)', () => {
  const validToken = jwt.sign(
    { username: 'LCOVIS', role: 'ADMIN' },
    getJwtSecret(),
    { expiresIn: '1h' }
  );

  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * ID: C001-PORT
   * Descripción: Validar que la ruta rechace solicitudes sin token Bearer con HTTP 401
   * Resultado Esperado: Debe responder status 401 y status: false
   */
  test('[C001-PORT] Debería rechazar la consulta de titular sin cabecera de autenticación con 401', async () => {
    const res = await request(app)
      .post('/apixportal/api/v1/portal/search-owner')
      .send({ tipoid: 'V', numid: 12345678 });

    expect(res.status).toBe(401);
    expect(res.body.status).toBe(false);
  });

  /**
   * ID: C002-PORT
   * Descripción: Validar que responda HTTP 200 cuando el titular es encontrado exitosamente
   * Resultado Esperado: Debe retornar statusCode 200, status: true y los datos del titular
   */
  test('[C002-PORT] Debería retornar HTTP 200 y los datos del cliente ante consulta válida', async () => {
    const mockData = {
      numid: 12345678,
      nomter: 'JUAN',
      apeter: 'PEREZ',
      titular: 'JUAN PEREZ',
      tipocli: 'P'
    };
    portalService.getOwnerDetails.mockResolvedValue({
      found: true,
      data: mockData,
      message: 'Titular obtenido exitosamente.'
    });

    const res = await request(app)
      .post('/apixportal/api/v1/portal/search-owner')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ tipoid: 'V', numid: 12345678, dvid: 0 });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe(true);
    expect(res.body.data.titular).toBe('JUAN PEREZ');
  });

  /**
   * ID: C003-PORT
   * Descripción: Validar que responda HTTP 404 cuando el titular no existe en la base de datos
   * Resultado Esperado: Debe responder statusCode 404, status: false y mensaje descriptivo
   */
  test('[C003-PORT] Debería retornar HTTP 404 cuando el titular no es encontrado en Acsel', async () => {
    portalService.getOwnerDetails.mockResolvedValue({
      found: false,
      data: { tipocli: 'P', indnacional: 'N' },
      message: 'No se encontró el titular con los datos proporcionados.'
    });

    const res = await request(app)
      .post('/apixportal/api/v1/portal/search-owner')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ tipoid: 'V', numid: 99999999 });

    expect(res.status).toBe(404);
    expect(res.body.status).toBe(false);
    expect(res.body.message).toContain('No se encontró el titular');
  });

  /**
   * ID: C004-PORT
   * Descripción: Validar que responda HTTP 400 cuando se omiten parámetros requeridos
   * Resultado Esperado: Debe retornar statusCode 400 con mensaje de validación operacional
   */
  test('[C004-PORT] Debería retornar HTTP 400 cuando faltan tipoid o numid en el payload', async () => {
    const error = new Error('Los campos tipoid y numid son requeridos.');
    error.statusCode = 400;
    error.isOperational = true;
    portalService.getOwnerDetails.mockRejectedValue(error);

    const res = await request(app)
      .post('/apixportal/api/v1/portal/search-owner')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ tipoid: '' });

    expect(res.status).toBe(400);
    expect(res.body.status).toBe(false);
    expect(res.body.message).toContain('requeridos');
  });

  test('[C005-PORT] Debería retornar HTTP 200 con planes funerarios en POST /full-rate para codProd 1010', async () => {
    portalService.getFullRateDetails.mockResolvedValue({
      found: true,
      data: {
        planes: [{ codPlan: '80', revPlan: '001', descPlan: '1.000$ TITULAR SOLO SERVFUNER', primaTotal: 21, sumaAsegurada: 1000, deducible: 0 }],
        coberturas: [],
        tarifasIndividuales: []
      },
      message: 'Tarifas funerarias obtenidas exitosamente.'
    });

    const res = await request(app)
      .post('/apixportal/api/v1/portal/full-rate')
      .send({
        codProd: '1010',
        indTipoPlan: 'I',
        familiares: [{ codParent: '0001', fechanac: '1988-06-15' }]
      });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe(true);
    expect(res.body.data.planes[0].codPlan).toBe('80');
    expect(portalService.getFullRateDetails).toHaveBeenCalledWith({
      codProd: '1010',
      indTipoPlan: 'I',
      familiares: [{ codParent: '0001', fechanac: '1988-06-15' }]
    });
  });

  test('[C006-PORT] Debería retornar HTTP 201 al guardar cotización funeraria en POST /save-quote', async () => {
    portalService.saveQuoteDetails.mockResolvedValue({
      success: true,
      data: { codCoti: 205, codCotiRef: '1010-205' },
      message: 'Cotización almacenada satisfactoriamente en el esquema WEBPORTAL.'
    });

    const res = await request(app)
      .post('/apixportal/api/v1/portal/save-quote')
      .send({
        codProd: '1010',
        nombreAseg: 'MARIA LOPEZ',
        prima: 74,
        sumaAseg: 1000,
        hcmPlan: { codProd: '1010', codPlan: '80', revplan: '002', nombrePlan: '1.000$ GRUPO FAMILIAR', prima: 74, sumaAseg: 1000, deducible: 0 },
        asegurados: [{ codParent: '0002', fechanac: '1988-06-15', prima: 74 }],
        coberturas: [{ codCobert: '1001', descCobert: 'GASTOS FUNERARIOS', sumaAsegCob: 1000, deducible: 0, primaCob: 74 }]
      });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe(true);
    expect(res.body.data.codCotiRef).toBe('1010-205');
  });
});
