-- Índice basado en función para búsquedas case-insensitive por correo electrónico
CREATE INDEX webportal.idx_usuario_email_lower ON
   webportal.usuario ( lower(email) );

-- Índice para acelerar filtros de usuarios activos
CREATE INDEX webportal.idx_usuario_stsusu ON
   webportal.usuario (
      stsusu
   );