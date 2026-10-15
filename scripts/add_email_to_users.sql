-- ====================================================================
-- Script: add_email_to_users.sql
-- Propósito: Añadir columna EMAIL a la tabla de usuarios en Oracle DB.
-- Permite login tanto por nombre de usuario (cédula) como por correo,
-- y habilita el flujo de recuperación de contraseña con token de 72 horas.
-- ====================================================================

-- 1. En entorno de producción (Esquema WEBPORTAL)
DECLARE
    v_col_exists NUMBER;
BEGIN
    SELECT COUNT(*) INTO v_col_exists
    FROM all_tab_cols
    WHERE owner = 'WEBPORTAL' AND table_name = 'USUARIO' AND column_name = 'EMAIL';

    IF v_col_exists = 0 THEN
        EXECUTE IMMEDIATE 'ALTER TABLE WEBPORTAL.USUARIO ADD (EMAIL VARCHAR2(100))';
        DBMS_OUTPUT.PUT_LINE('Columna EMAIL añadida exitosamente a WEBPORTAL.USUARIO');
    ELSE
        DBMS_OUTPUT.PUT_LINE('La columna EMAIL ya existe en WEBPORTAL.USUARIO');
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        DBMS_OUTPUT.PUT_LINE('Nota WEBPORTAL: ' || SQLERRM);
END;
/

-- 2. En entorno local de desarrollo (Esquema LOCALWEBPORTAL)
DECLARE
    v_col_exists NUMBER;
BEGIN
    SELECT COUNT(*) INTO v_col_exists
    FROM all_tab_cols
    WHERE owner = 'LOCALWEBPORTAL' AND table_name = 'USUARIO' AND column_name = 'EMAIL';

    IF v_col_exists = 0 THEN
        EXECUTE IMMEDIATE 'ALTER TABLE LOCALWEBPORTAL.USUARIO ADD (EMAIL VARCHAR2(100))';
        DBMS_OUTPUT.PUT_LINE('Columna EMAIL añadida exitosamente a LOCALWEBPORTAL.USUARIO');
    ELSE
        DBMS_OUTPUT.PUT_LINE('La columna EMAIL ya existe en LOCALWEBPORTAL.USUARIO');
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        DBMS_OUTPUT.PUT_LINE('Nota LOCALWEBPORTAL: ' || SQLERRM);
END;
/

-- 3. Crear índice para optimizar búsquedas por EMAIL (case-insensitive)
BEGIN
    EXECUTE IMMEDIATE 'CREATE INDEX WEBPORTAL.IDX_USUARIO_EMAIL ON WEBPORTAL.USUARIO (LOWER(EMAIL))';
EXCEPTION
    WHEN OTHERS THEN NULL;
END;
/

BEGIN
    EXECUTE IMMEDIATE 'CREATE INDEX LOCALWEBPORTAL.IDX_USUARIO_EMAIL ON LOCALWEBPORTAL.USUARIO (LOWER(EMAIL))';
EXCEPTION
    WHEN OTHERS THEN NULL;
END;
/

-- 4. Asignar correo de prueba al usuario administrador local si existe
BEGIN
    EXECUTE IMMEDIATE 'UPDATE LOCALWEBPORTAL.USUARIO SET EMAIL = ''admin@constitucion.com'' WHERE CODUSU = ''ADMIN'' AND EMAIL IS NULL';
    COMMIT;
EXCEPTION
    WHEN OTHERS THEN NULL;
END;
/

PROMPT Migración de columna EMAIL completada exitosamente.
