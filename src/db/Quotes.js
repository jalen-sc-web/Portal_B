import { getPortalConnection, portalTable } from '../config/database.js';
import oracledb from 'oracledb';

/**
 * Mapeo de códigos de producto a nombres legibles
 */
export const PRODUCT_NAMES = {
  '1007': 'Salud HCM Individual',
  '1010': 'Servicios Funerarios Individual',
  '1001': 'Vida Individual',
  '1005': 'Accidentes Personales',
  'AUT': 'Automóvil'
};

/**
 * Consulta todas las cotizaciones de un asegurado.
 * Puede filtrar por su nombre de usuario (CODUSUCREA), email, o número de identificación.
 */
export const getQuotesByInsured = async ({ username, email, numid, search, status, codprod }) => {
  let connection;
  try {
    connection = await getPortalConnection();
    const cotizTable = portalTable('COTIZACIONES');
    const hcmTable = portalTable('COTIZACION_HCM');
    const asegTable = portalTable('COTIZACION_HCM_ASEG');

    const cleanUser = String(username || '').trim().toUpperCase();
    const cleanEmail = String(email || '').trim().toUpperCase();
    const cleanNumId = String(numid || '').trim();

    const conditions = [];
    const binds = {};

    // Condición de pertenencia al asegurado:
    // Si viene username o email, matchea por CODUSUCREA o EMAIL o parte del nombre
    const userMatch = [];
    if (cleanUser && cleanUser !== 'ADMIN') {
      userMatch.push('UPPER(c.CODUSUCREA) = :username');
      binds.username = cleanUser;
    }
    if (cleanEmail) {
      userMatch.push('UPPER(c.EMAIL) = :email');
      binds.email = cleanEmail;
    }
    if (cleanNumId) {
      userMatch.push('UPPER(c.CODUSUCREA) = :numid');
      binds.numid = cleanNumId;
    }

    if (userMatch.length > 0) {
      conditions.push(`(${userMatch.join(' OR ')})`);
    }

    // Filtros opcionales
    if (status && status !== 'ALL') {
      conditions.push('UPPER(c.STSCOT) = :status');
      binds.status = status.toUpperCase();
    }

    if (codprod && codprod !== 'ALL') {
      conditions.push('c.CODPROD = :codprod');
      binds.codprod = String(codprod);
    }

    if (search && search.trim()) {
      conditions.push(`(
        UPPER(c.CODCOTI_REF) LIKE :search OR
        UPPER(c.NOMBRE_ASEG) LIKE :search OR
        UPPER(NVL(h.NOMBREPLAN, '')) LIKE :search
      )`);
      binds.search = `%${search.trim().toUpperCase()}%`;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const sql = `
      SELECT 
        c.CODCOTI,
        c.CODCOTI_REF,
        c.CODPROD,
        c.NOMBRE_ASEG,
        c.TELEFONO,
        c.EMAIL,
        c.PRIMA AS PRIMA_TOTAL,
        c.SUMA_ASEG,
        c.CODINTER,
        c.CODOFIEMI,
        c.STSCOT,
        c.FECHACREA,
        c.CODUSUCREA,
        h.CODPLAN,
        h.REVPLAN,
        h.NOMBREPLAN,
        h.DEDUCIBLE,
        (
          SELECT COUNT(*) 
          FROM ${asegTable} a 
          WHERE a.CODCOTI = c.CODCOTI
        ) AS TOTAL_INTEGRANTES
      FROM ${cotizTable} c
      LEFT JOIN ${hcmTable} h ON h.CODCOTI = c.CODCOTI
      ${whereClause}
      ORDER BY c.CODCOTI DESC
    `;

    const result = await connection.execute(sql, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    const rows = result.rows || [];

    // Si para el usuario específico no hay registros (ej. usuario nuevo o no ha cotizado aún),
    // pero se requiere visualización, retornamos lo encontrado.
    return rows.map(formatQuoteRow);
  } catch (error) {
    console.error('[Quotes DB] Error en getQuotesByInsured:', error);
    throw error;
  } finally {
    if (connection) {
      try { await connection.close(); } catch (e) { /* ignore */ }
    }
  }
};

/**
 * Consulta todas las cotizaciones gestionadas por el intermediario.
 */
export const getQuotesByIntermediary = async ({ codinter, username, search, status, codprod, sort = 'DESC' }) => {
  let connection;
  try {
    connection = await getPortalConnection();
    const cotizTable = portalTable('COTIZACIONES');
    const hcmTable = portalTable('COTIZACION_HCM');
    const asegTable = portalTable('COTIZACION_HCM_ASEG');

    const cleanInter = String(codinter || '').trim();
    const cleanUser = String(username || '').trim().toUpperCase();

    const conditions = [];
    const binds = {};

    // Si se especifica un código de intermediario específico
    if (cleanInter && cleanInter !== 'ALL') {
      conditions.push('(c.CODINTER = :codinter OR UPPER(c.CODUSUCREA) = :cleanUser)');
      binds.codinter = cleanInter;
      binds.cleanUser = cleanUser;
    }

    // Filtros opcionales
    if (status && status !== 'ALL') {
      conditions.push('UPPER(c.STSCOT) = :status');
      binds.status = status.toUpperCase();
    }

    if (codprod && codprod !== 'ALL') {
      conditions.push('c.CODPROD = :codprod');
      binds.codprod = String(codprod);
    }

    if (search && search.trim()) {
      conditions.push(`(
        UPPER(c.CODCOTI_REF) LIKE :search OR
        UPPER(c.NOMBRE_ASEG) LIKE :search OR
        UPPER(NVL(c.EMAIL, '')) LIKE :search OR
        UPPER(NVL(c.TELEFONO, '')) LIKE :search OR
        UPPER(NVL(h.NOMBREPLAN, '')) LIKE :search
      )`);
      binds.search = `%${search.trim().toUpperCase()}%`;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const orderDirection = sort === 'ASC' ? 'ASC' : 'DESC';

    const sql = `
      SELECT 
        c.CODCOTI,
        c.CODCOTI_REF,
        c.CODPROD,
        c.NOMBRE_ASEG,
        c.TELEFONO,
        c.EMAIL,
        c.PRIMA AS PRIMA_TOTAL,
        c.SUMA_ASEG,
        c.CODINTER,
        c.CODOFIEMI,
        c.STSCOT,
        c.FECHACREA,
        c.CODUSUCREA,
        h.CODPLAN,
        h.REVPLAN,
        h.NOMBREPLAN,
        h.DEDUCIBLE,
        (
          SELECT COUNT(*) 
          FROM ${asegTable} a 
          WHERE a.CODCOTI = c.CODCOTI
        ) AS TOTAL_INTEGRANTES
      FROM ${cotizTable} c
      LEFT JOIN ${hcmTable} h ON h.CODCOTI = c.CODCOTI
      ${whereClause}
      ORDER BY c.CODCOTI ${orderDirection}
    `;

    const result = await connection.execute(sql, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    return (result.rows || []).map(formatQuoteRow);
  } catch (error) {
    console.error('[Quotes DB] Error en getQuotesByIntermediary:', error);
    throw error;
  } finally {
    if (connection) {
      try { await connection.close(); } catch (e) { /* ignore */ }
    }
  }
};

/**
 * Consulta el detalle completo de una cotización: cabecera, plan HCM, asegurados y coberturas.
 */
export const getQuoteDetail = async (codcoti) => {
  let connection;
  try {
    connection = await getPortalConnection();
    const cotizTable = portalTable('COTIZACIONES');
    const hcmTable = portalTable('COTIZACION_HCM');
    const asegTable = portalTable('COTIZACION_HCM_ASEG');
    const cobTable = portalTable('COTIZACION_HCM_COB');

    // 1. Cabecera
    const headerSql = `
      SELECT 
        c.CODCOTI,
        c.CODCOTI_REF,
        c.CODPROD,
        c.NOMBRE_ASEG,
        c.TELEFONO,
        c.EMAIL,
        c.PRIMA AS PRIMA_TOTAL,
        c.SUMA_ASEG,
        c.CODINTER,
        c.CODOFIEMI,
        c.STSCOT,
        c.FECHACREA,
        c.CODUSUCREA,
        h.CODHCM,
        h.CODPLAN,
        h.REVPLAN,
        h.NOMBREPLAN,
        h.PRIMA AS PRIMA_PLAN,
        h.SUMA_ASEG AS SUMA_ASEG_PLAN,
        h.DEDUCIBLE
      FROM ${cotizTable} c
      LEFT JOIN ${hcmTable} h ON h.CODCOTI = c.CODCOTI
      WHERE c.CODCOTI = :codcoti
    `;

    const headerRes = await connection.execute(headerSql, { codcoti }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    const header = headerRes.rows?.[0];
    if (!header) return null;

    // 2. Asegurados / Integrantes familiares
    const asegSql = `
      SELECT 
        CODASEG,
        CODPARENT,
        EDAD,
        PRIMA,
        FECHACREA
      FROM ${asegTable}
      WHERE CODCOTI = :codcoti
      ORDER BY CODPARENT ASC
    `;
    const asegRes = await connection.execute(asegSql, { codcoti }, { outFormat: oracledb.OUT_FORMAT_OBJECT });

    // 3. Coberturas
    const cobSql = `
      SELECT 
        CODCOB,
        CODCOBERT,
        DESCCOBERT,
        SUMAASEG_COB,
        DEDUCIBLE,
        PRIMA_COB
      FROM ${cobTable}
      WHERE CODCOTI = :codcoti
      ORDER BY CODCOB ASC
    `;
    const cobRes = await connection.execute(cobSql, { codcoti }, { outFormat: oracledb.OUT_FORMAT_OBJECT });

    const formatted = formatQuoteRow(header);
    return {
      ...formatted,
      hcm: {
        codPlan: header.CODPLAN,
        revPlan: header.REVPLAN,
        nombrePlan: header.NOMBREPLAN,
        prima: Number(header.PRIMA_PLAN || header.PRIMA_TOTAL || 0),
        sumaAsegurada: Number(header.SUMA_ASEG_PLAN || header.SUMA_ASEG || 0),
        deducible: header.DEDUCIBLE != null ? Number(header.DEDUCIBLE) : null
      },
      familiares: (asegRes.rows || []).map(a => ({
        codAseg: a.CODASEG,
        codParent: a.CODPARENT,
        descParent: getParentescoDescription(a.CODPARENT),
        edad: Number(a.EDAD),
        prima: Number(a.PRIMA)
      })),
      coberturas: (cobRes.rows || []).map(c => ({
        codCob: c.CODCOB,
        codCobert: c.CODCOBERT,
        descCobert: c.DESCCOBERT,
        sumaAsegurada: Number(c.SUMAASEG_COB || 0),
        deducible: Number(c.DEDUCIBLE || 0),
        prima: Number(c.PRIMA_COB || 0)
      }))
    };
  } catch (error) {
    console.error('[Quotes DB] Error en getQuoteDetail:', error);
    throw error;
  } finally {
    if (connection) {
      try { await connection.close(); } catch (e) { /* ignore */ }
    }
  }
};

/**
 * Normaliza y formatea una fila de cotización para consumo estándar del frontend.
 */
function formatQuoteRow(row) {
  const statusRaw = String(row.STSCOT || 'VAL').toUpperCase();
  let statusLabel = 'Válida';
  let statusTone = 'success';

  switch (statusRaw) {
    case 'VAL':
    case 'ACT':
      statusLabel = 'Válida';
      statusTone = 'success';
      break;
    case 'EMI':
    case 'GAN':
      statusLabel = 'Emitida';
      statusTone = 'primary';
      break;
    case 'PEN':
      statusLabel = 'Pendiente';
      statusTone = 'warning';
      break;
    case 'VEN':
      statusLabel = 'Vencida';
      statusTone = 'neutral';
      break;
    default:
      statusLabel = statusRaw;
      statusTone = 'neutral';
      break;
  }

  const codprod = String(row.CODPROD || '1007');
  const productoNombre = PRODUCT_NAMES[codprod] || 'Salud HCM';

  return {
    id: Number(row.CODCOTI),
    ref: row.CODCOTI_REF,
    codProd: codprod,
    producto: productoNombre,
    nombreAsegurado: row.NOMBRE_ASEG,
    telefono: row.TELEFONO,
    email: row.EMAIL,
    primaTotal: Number(row.PRIMA_TOTAL || 0),
    sumaAsegurada: Number(row.SUMA_ASEG || 0),
    deducible: row.DEDUCIBLE != null ? Number(row.DEDUCIBLE) : null,
    nombrePlan: row.NOMBREPLAN || 'Plan Salud Estándar',
    codPlan: row.CODPLAN,
    revPlan: row.REVPLAN,
    codInter: row.CODINTER,
    codOfiEmi: row.CODOFIEMI,
    status: statusRaw,
    statusLabel,
    statusTone,
    fechaCreacion: row.FECHACREA,
    creadoPor: row.CODUSUCREA,
    totalIntegrantes: Number(row.TOTAL_INTEGRANTES || 1)
  };
}

function getParentescoDescription(codParent) {
  switch (String(codParent)) {
    case '0001': return 'Titular (Masculino)';
    case '0002': return 'Titular (Femenino)';
    case '0003': return 'Cónyuge (Masculino)';
    case '0004': return 'Cónyuge (Femenino)';
    case '0005': return 'Hijo';
    case '0006': return 'Hija';
    case '0007': return 'Padre';
    case '0008': return 'Madre';
    default: return `Familiar (${codParent})`;
  }
}

export default {
  getQuotesByInsured,
  getQuotesByIntermediary,
  getQuoteDetail
};
