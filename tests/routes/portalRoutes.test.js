import { describe, test, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';

vi.mock('../../src/services/portalService.js', () => ({
  default: {
    getOwnerDetails: vi.fn(),
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
});
