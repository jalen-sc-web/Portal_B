CREATE TABLE webportal.usuario (
   codusu    VARCHAR2(50) NOT NULL,
   nomusu    VARCHAR2(100) NOT NULL,
   clave     VARCHAR2(255) NOT NULL,
   clave_ant VARCHAR2(255),
   email     VARCHAR2(100),
   stsusu    VARCHAR2(10) DEFAULT 'ACT' NOT NULL,
   cambioclv VARCHAR2(1) DEFAULT 'S' NOT NULL,
   codperfil VARCHAR2(20) DEFAULT 'ASEGURADO' NOT NULL
);

-- ------------------------------------------------------------------------------
-- COMENTARIOS DE DOCUMENTACIÓN
-- ------------------------------------------------------------------------------
COMMENT ON TABLE webportal.usuario IS
   'Usuarios con credenciales de acceso al Portal del Asegurado';
COMMENT ON COLUMN webportal.usuario.codusu IS
   'Identificador único del usuario: Cédula o RIF en dígitos numéricos limpios (ej: 12345678) o "admin" para el administrador'
   ;
COMMENT ON COLUMN webportal.usuario.nomusu IS
   'Nombre y apellido o razón social del titular asegurado';
COMMENT ON COLUMN webportal.usuario.clave IS
   'Hash bcrypt de la contraseña activa actual';
COMMENT ON COLUMN webportal.usuario.clave_ant IS
   'Hash bcrypt de la contraseña anterior para prevenir su reutilización';
COMMENT ON COLUMN webportal.usuario.email IS
   'Correo electrónico único para inicio de sesión y recuperación de clave';
COMMENT ON COLUMN webportal.usuario.stsusu IS
   'Estado del usuario: ACT=Activo, INA=Inactivo, BLO=Bloqueado';
COMMENT ON COLUMN webportal.usuario.cambioclv IS
   'Bandera de cambio de clave obligatorio al iniciar sesión (S=Si, N=No)';
COMMENT ON COLUMN webportal.usuario.codperfil IS
   'Rol o perfil de acceso (ASEGURADO, ADMIN, etc.)';

-- ------------------------------------------------------------------------------
-- 5. REGISTRO DEL USUARIO ADMINISTRADOR INICIAL
-- ------------------------------------------------------------------------------
-- Usuario: admin
-- Clave por defecto: 123456 (Hash Bcrypt de 60 caracteres)
-- Requiere cambio de clave inicial: S
INSERT INTO webportal.usuario (
   codusu,
   nomusu,
   clave,
   clave_ant,
   email,
   stsusu,
   cambioclv,
   codperfil
) VALUES
   ( 'admin',
     'Administrador Portal Asegurados',
     '$2b$10$tpi8kco0DhzexCKvwzJyIOIRuBwOp/lqRDP8mmZX//Ag1dLWx0kR2',
     NULL,
     'soporte.portal@segurosconstitucion.com',
     'ACT',
     'S',
     'ADMIN' );

COMMIT;