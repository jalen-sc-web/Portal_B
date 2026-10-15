/**
 * Especificación OpenAPI 3.0 para Portal del Asegurado (Portal B)
 */

export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Portal del Asegurado - Backend API',
    version: '1.0.0',
    description: 'Documentación interactiva de la API REST del Portal del Asegurado integrada con la base de datos de Acsel.'
  },
  servers: [
    {
      url: 'http://localhost:5610',
      description: 'Servidor Local (Desarrollo)'
    }
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Ingrese el token JWT obtenido en /login con el formato: Bearer <token>'
      }
    }
  },
  paths: {
    '/apixportal/api/v1/auth/login': {
      post: {
        tags: ['Autenticación'],
        summary: 'Iniciar sesión y obtener token JWT',
        description: 'Valida credenciales con hash bcrypt contra la base de datos y retorna un JWT de 8 horas.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['username', 'password'],
                properties: {
                  username: { type: 'string', example: 'admin' },
                  password: { type: 'string', example: '123456' }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Acceso exitoso o requerimiento de cambio de clave.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'boolean', example: true },
                    token: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsIn...' },
                    data: {
                      type: 'object',
                      properties: {
                        username: { type: 'string', example: 'admin' },
                        nombre: { type: 'string', example: 'Administrador Portal' },
                        role: { type: 'string', example: 'ADMIN' }
                      }
                    },
                    message: { type: 'string', example: 'Acceso exitoso.' }
                  }
                }
              }
            }
          },
          '401': {
            description: 'Credenciales inválidas.'
          }
        }
      }
    },
    '/apixportal/api/v1/auth/update-password': {
      post: {
        tags: ['Autenticación'],
        summary: 'Actualizar contraseña del usuario',
        security: [{ bearerAuth: [] }],
        description: 'Actualiza la contraseña del usuario previa validación de la contraseña actual. Requiere token Bearer.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['currentPassword', 'newPassword'],
                properties: {
                  username: { type: 'string', example: 'admin', description: 'Opcional si viene en el token JWT' },
                  currentPassword: { type: 'string', example: '123456' },
                  newPassword: { type: 'string', example: 'nueva_clave_segura_2026' }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Clave actualizada exitosamente.'
          },
          '400': {
            description: 'Datos faltantes o contraseña nueva menor a 6 caracteres.'
          },
          '401': {
            description: 'Token inválido o contraseña actual incorrecta.'
          }
        }
      }
    },
    '/apixportal/api/v1/portal/search-owner': {
      post: {
        tags: ['Titulares (Portal)'],
        summary: 'Consultar titular en Acsel por documento de identidad',
        security: [{ bearerAuth: [] }],
        description: 'Realiza una consulta consolidada con JOIN a las tablas de Acsel (CLIENTE, TERCERO, PAIS, ESTADO, CIUDAD, MUNICIPIO, ZONA_POSTAL).',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['tipoid', 'numid'],
                properties: {
                  tipoid: { type: 'string', example: 'V', description: 'Tipo de documento: V, E, J, G' },
                  numid: { type: 'integer', example: 12345678, description: 'Número de cédula o identificación' },
                  dvid: { type: 'integer', example: 0, description: 'Dígito verificador (opcional, por defecto 0)' }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Titular encontrado con datos completos y descripciones geográficas.'
          },
          '404': {
            description: 'Titular no encontrado en la base de datos de Acsel.'
          },
          '401': {
            description: 'No autorizado / Token ausente o expirado.'
          }
        }
      }
    },
    '/apixportal/api/v1/valrep/country': {
      get: {
        tags: ['Catálogos (Valrep)'],
        summary: 'Obtener catálogo de países',
        description: 'Retorna la lista de países desde CONSSEG.PAIS con respuesta en caché en memoria.',
        responses: {
          '200': {
            description: 'Lista de países obtenida exitosamente.'
          }
        }
      }
    },
    '/apixportal/api/v1/valrep/state': {
      get: {
        tags: ['Catálogos (Valrep)'],
        summary: 'Obtener catálogo de estados',
        description: 'Retorna los estados para un país específico desde CONSSEG.ESTADO.',
        parameters: [
          {
            name: 'codpais',
            in: 'query',
            required: true,
            schema: { type: 'string', example: '001' },
            description: 'Código del país'
          }
        ],
        responses: {
          '200': {
            description: 'Lista de estados.'
          },
          '400': {
            description: 'Parámetro codpais faltante.'
          }
        }
      }
    },
    '/apixportal/api/v1/valrep/city': {
      get: {
        tags: ['Catálogos (Valrep)'],
        summary: 'Obtener catálogo de ciudades',
        description: 'Retorna las ciudades para un país y estado específicos desde CONSSEG.CIUDAD.',
        parameters: [
          {
            name: 'codpais',
            in: 'query',
            required: true,
            schema: { type: 'string', example: '001' }
          },
          {
            name: 'codestado',
            in: 'query',
            required: true,
            schema: { type: 'string', example: '01' }
          }
        ],
        responses: {
          '200': {
            description: 'Lista de ciudades.'
          }
        }
      }
    },
    '/apixportal/api/v1/valrep/municipality': {
      get: {
        tags: ['Catálogos (Valrep)'],
        summary: 'Obtener catálogo de municipios',
        description: 'Retorna los municipios según país, estado y ciudad desde CONSSEG.MUNICIPIO.',
        parameters: [
          {
            name: 'codpais',
            in: 'query',
            required: true,
            schema: { type: 'string', example: '001' }
          },
          {
            name: 'codestado',
            in: 'query',
            required: true,
            schema: { type: 'string', example: '01' }
          },
          {
            name: 'codciudad',
            in: 'query',
            required: true,
            schema: { type: 'string', example: '01' }
          }
        ],
        responses: {
          '200': {
            description: 'Lista de municipios.'
          }
        }
      }
    },
    '/apixportal/api/v1/valrep/lval': {
      get: {
        tags: ['Catálogos (Valrep)'],
        summary: 'Obtener lista de valores (LVAL)',
        description: 'Retorna los valores de un catálogo según su categoría (ej. SEXO, EDOCIVIL) desde CONSSEG.LVAL.',
        parameters: [
          {
            name: 'tipolval',
            in: 'query',
            required: true,
            schema: { type: 'string', example: 'SEXO' },
            description: 'Categoría de la lista de valores'
          }
        ],
        responses: {
          '200': {
            description: 'Valores del catálogo.'
          }
        }
      }
    }
  }
};
