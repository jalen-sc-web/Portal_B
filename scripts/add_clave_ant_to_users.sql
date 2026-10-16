-- ====================================================================
-- Script: add_clave_ant_to_users.sql
-- Propósito: Añadir columna CLAVE_ANT a la tabla de usuarios en Oracle DB
-- para almacenar el hash de la contraseña anterior e impedir su reutilización.
-- ====================================================================

-- 1. En entorno de producción (Esquema WEBPORTAL)
DECLARE
    v_col_exists NUMBER;
BEGIN
    SELECT COUNT(*) INTO v_col_exists
    FROM all_tab_cols
    WHERE owner = 'WEBPORTAL' AND table_name = 'USUARIO' AND column_name = 'CLAVE_ANT';

    IF v_col_exists = 0 THEN
        EXECUTE IMMEDIATE 'ALTER TABLE WEBPORTAL.USUARIO ADD (CLAVE_ANT VARCHAR2(100))';
        DBMS_OUTPUT.PUT_LINE('Columna CLAVE_ANT añadida exitosamente a WEBPORTAL.USUARIO');
    ELSE
        DBMS_OUTPUT.PUT_LINE('La columna CLAVE_ANT ya existe en WEBPORTAL.USUARIO');
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
    WHERE owner = 'LOCALWEBPORTAL' AND table_name = 'USUARIO' AND column_name = 'CLAVE_ANT';

    IF v_col_exists = 0 THEN
        EXECUTE IMMEDIATE 'ALTER TABLE LOCALWEBPORTAL.USUARIO ADD (CLAVE_ANT VARCHAR2(100))';
        DBMS_OUTPUT.PUT_LINE('Columna CLAVE_ANT añadida exitosamente a LOCALWEBPORTAL.USUARIO');
    ELSE
        DBMS_OUTPUT.PUT_LINE('La columna CLAVE_ANT ya existe en LOCALWEBPORTAL.USUARIO');
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        DBMS_OUTPUT.PUT_LINE('Nota LOCALWEBPORTAL: ' || SQLERRM);
END;
/

PROMPT Migración de columna CLAVE_ANT completada exitosamente.
