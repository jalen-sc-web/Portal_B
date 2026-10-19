-- Llave primaria: CODUSU (garantiza unicidad de la cédula o identificador)
ALTER TABLE webportal.usuario ADD CONSTRAINT pk_webportal_usuario PRIMARY KEY ( codusu );

-- Unicidad del correo electrónico: impide registrar dos cuentas con el mismo correo
ALTER TABLE webportal.usuario ADD CONSTRAINT uq_usuario_email UNIQUE ( email );

-- Validación de valores permitidos para estado (STSUSU)
ALTER TABLE webportal.usuario
   ADD CONSTRAINT ck_usuario_stsusu
      CHECK ( stsusu IN ( 'ACT',
                          'INA',
                          'BLO' ) );

-- Validación de valores permitidos para cambio obligatorio de clave (CAMBIOCLV)
ALTER TABLE webportal.usuario
   ADD CONSTRAINT ck_usuario_cambioclv CHECK ( cambioclv IN ( 'S',
                                                              'N' ) );