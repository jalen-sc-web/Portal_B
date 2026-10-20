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