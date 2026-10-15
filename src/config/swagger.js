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
      },
      recoveryKeyAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'x-recovery-key',
        description: 'Llave secreta de rescate configurada en ADMIN_RECOVERY_KEY del .env'
      }
    }
  },
  paths: {
    '/apixportal/api/v1/auth/login': {
      post: {
        tags: ['Autenticación'],
        summary: 'Iniciar sesión y obtener token JWT',
        description: 'Valida credenciales con hash bcrypt contra la base de datos. Si CAMBIOCLV es S, retorna un token temporal de 15 minutos para forzar el cambio en /set-password.',
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
                    requireChange: { type: 'boolean', example: false },
                    token: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsIn...' },
                    expiresIn: { type: 'integer', example: 28800, description: 'Tiempo de vida del token en segundos' },
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
    '/apixportal/api/v1/auth/refresh-token': {
      post: {
        tags: ['Autenticación'],
        summary: 'Renovar sesión (Token Refresh)',
        security: [{ bearerAuth: [] }],
        description: 'Permite renovar el token antes de su expiración. Revoca el token actual y emite uno nuevo con TTL completo.',
        responses: {
          '200': {
            description: 'Token renovado exitosamente.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'boolean', example: true },
                    token: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsIn...' },
                    expiresIn: { type: 'integer', example: 28800 },
                    data: {
                      type: 'object',
                      properties: {
                        username: { type: 'string', example: 'admin' },
                        nombre: { type: 'string', example: 'Administrador Portal' },
                        role: { type: 'string', example: 'ADMIN' }
                      }
                    },
                    message: { type: 'string', example: 'Token renovado exitosamente.' }
                  }
                }
              }
            }
          },
          '401': {
            description: 'Token inválido o usuario inactivo.'
          }
        }
      }
    },
    '/apixportal/api/v1/auth/me': {
      get: {
        tags: ['Autenticación'],
        summary: 'Obtener datos del usuario autenticado',
        security: [{ bearerAuth: [] }],
        description: 'Retorna el perfil y estado de la sesión actual validando el token Bearer.',
        responses: {
          '200': {
            description: 'Datos del usuario.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'boolean', example: true },
                    data: {
                      type: 'object',
                      properties: {
                        username: { type: 'string', example: 'admin' },
                        nombre: { type: 'string', example: 'Administrador Portal' },
                        role: { type: 'string', example: 'ADMIN' },
                        requireChange: { type: 'boolean', example: false },
                        status: { type: 'string', example: 'ACT' }
                      }
                    }
                  }
                }
              }
            }
          },
          '401': {
            description: 'No autorizado / Token ausente o inválido.'
          }
        }
      }
    },
    '/apixportal/api/v1/auth/logout': {
      post: {
        tags: ['Autenticación'],
        summary: 'Cerrar sesión e invalidar token',
        security: [{ bearerAuth: [] }],
        description: 'Invalida el token actual en la lista negra (blocklist) del servidor para impedir su reutilización.',
        responses: {
          '200': {
            description: 'Sesión finalizada exitosamente.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'boolean', example: true },
                    message: { type: 'string', example: 'Sesión cerrada exitosamente. Token invalidado.' }
                  }
                }
              }
            }
          },
          '401': {
            description: 'Token inválido o ya revocado.'
          }
        }
      }
    },
    '/apixportal/api/v1/auth/update-password': {
      post: {
        tags: ['Autenticación'],
        summary: 'Actualizar contraseña del usuario con clave anterior',
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
    '/apixportal/api/v1/auth/set-password': {
      post: {
        tags: ['Autenticación'],
        summary: 'Establecer nueva contraseña desde sesión activa (sin clave anterior)',
        security: [{ bearerAuth: [] }],
        description: 'Permite definir una nueva contraseña sin suministrar la anterior. Utilizado para usuarios recién creados con clave temporal o cuando CAMBIOCLV es S. Emite un token definitivo con CAMBIOCLV = N.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['newPassword'],
                properties: {
                  newPassword: { type: 'string', example: 'MiClaveNuevaDefinitiva123#' }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Contraseña establecida exitosamente. Retorna token definitivo.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'boolean', example: true },
                    token: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsIn...' },
                    expiresIn: { type: 'integer', example: 28800 },
                    message: { type: 'string', example: 'Contraseña establecida exitosamente.' }
                  }
                }
              }
            }
          },
          '400': {
            description: 'Contraseña menor a 6 caracteres.'
          },
          '401': {
            description: 'Token inválido o sesión expirada.'
          }
        }
      }
    },
    '/apixportal/api/v1/auth/admin/create-user': {
      post: {
        tags: ['Administración de Usuarios'],
        summary: 'Crear nuevo usuario con clave temporal',
        security: [{ bearerAuth: [] }],
        description: 'Permite a un usuario con rol ADMIN dar de alta a un nuevo usuario (ej. ASEGURADO o ADMIN). Se le asigna una clave temporal y CAMBIOCLV = S para que en su primer inicio de sesión deba cambiarla obligatoriamente.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['username', 'nombre'],
                properties: {
                  username: { type: 'string', example: 'V12345678', description: 'Cédula o login del usuario' },
                  nombre: { type: 'string', example: 'Juan Pérez' },
                  role: { type: 'string', example: 'ASEGURADO', description: 'Rol asignado (ej. ASEGURADO o ADMIN)' },
                  tempPassword: { type: 'string', example: 'ClaveTemp123#', description: 'Opcional. Si se omite, el backend genera una aleatoria' }
                }
              }
            }
          }
        },
        responses: {
          '201': {
            description: 'Usuario creado exitosamente.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'boolean', example: true },
                    data: {
                      type: 'object',
                      properties: {
                        username: { type: 'string', example: 'V12345678' },
                        nombre: { type: 'string', example: 'Juan Pérez' },
                        role: { type: 'string', example: 'ASEGURADO' },
                        tempPassword: { type: 'string', example: 'ClaveTemp123#' }
                      }
                    },
                    message: { type: 'string', example: 'Usuario creado exitosamente con clave temporal.' }
                  }
                }
              }
            }
          },
          '400': {
            description: 'El usuario ya existe o datos incompletos.'
          },
          '403': {
            description: 'Acceso denegado: se requiere rol ADMIN.'
          }
        }
      }
    },
    '/apixportal/api/v1/auth/admin/reset-password': {
      post: {
        tags: ['Administración de Usuarios'],
        summary: 'Reseteo administrativo de clave a otro usuario',
        security: [{ bearerAuth: [] }],
        description: 'Permite a un usuario con rol ADMIN asignar una clave temporal a otro usuario. La cuenta queda configurada con CAMBIOCLV = S para forzar el cambio en su próximo inicio de sesión.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['targetUsername'],
                properties: {
                  targetUsername: { type: 'string', example: 'jperez', description: 'Nombre de usuario al que se le cambiará la clave' },
                  tempPassword: { type: 'string', example: 'TempKey#2026', description: 'Opcional. Si se omite, el backend genera una clave aleatoria segura' }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Contraseña reseteada exitosamente. Devuelve la clave temporal asignada.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'boolean', example: true },
                    targetUsername: { type: 'string', example: 'jperez' },
                    tempPassword: { type: 'string', example: 'xK9#mQ2$aP' },
                    message: { type: 'string', example: 'Contraseña reseteada exitosamente. El usuario deberá cambiarla obligatoriamente al iniciar sesión.' }
                  }
                }
              }
            }
          },
          '403': {
            description: 'Acceso denegado: el usuario no tiene rol ADMIN.'
          },
          '404': {
            description: 'Usuario destino no encontrado.'
          }
        }
      }
    },
    '/apixportal/api/v1/auth/system/override-password': {
      post: {
        tags: ['Rescate de Emergencia'],
        summary: 'Sobreescritura de clave por llave maestra (Break-Glass)',
        security: [{ recoveryKeyAuth: [] }],
        description: 'Endpoint de emergencia para recuperar acceso al administrador o a cualquier cuenta cuando se han perdido las credenciales. Requiere el encabezado x-recovery-key con el valor configurado en ADMIN_RECOVERY_KEY del .env.',
        parameters: [
          {
            name: 'x-recovery-key',
            in: 'header',
            required: true,
            schema: { type: 'string', example: 'clave_maestra_de_rescate_emergencia_minimo_16_caracteres' },
            description: 'Llave secreta de rescate'
          }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['username', 'newPassword'],
                properties: {
                  username: { type: 'string', example: 'admin' },
                  newPassword: { type: 'string', example: 'NuevaClaveAdmin2026!' }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Contraseña sobreescrita exitosamente.'
          },
          '401': {
            description: 'Llave de recuperación inválida o ausente.'
          },
          '503': {
            description: 'ADMIN_RECOVERY_KEY no está configurada en el servidor.'
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
