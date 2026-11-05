import Quotes from '../db/Quotes.js';

export const listInsuredQuotes = async ({ username, email, numid, search, status, codprod }) => {
  const quotes = await Quotes.getQuotesByInsured({ username, email, numid, search, status, codprod });

  // Métricas para el asegurado
  const total = quotes.length;
  const validas = quotes.filter(q => q.status === 'VAL' || q.status === 'ACT').length;
  const vencidas = quotes.filter(q => q.status === 'VEN').length;
  const primaTotal = quotes.reduce((acc, q) => acc + (q.primaTotal || 0), 0);
  const promedioPrima = total > 0 ? Math.round((primaTotal / total) * 100) / 100 : 0;

  return {
    items: quotes,
    stats: {
      total,
      validas,
      vencidas,
      primaTotal,
      promedioPrima
    }
  };
};

export const listIntermediaryQuotes = async ({ codinter, username, search, status, codprod, sort }) => {
  const quotes = await Quotes.getQuotesByIntermediary({ codinter, username, search, status, codprod, sort });

  // Métricas analíticas para el intermediario
  const total = quotes.length;
  const uniqueClients = new Set(
    quotes.map(q => (q.nombreAsegurado || q.email || String(q.id)).trim().toUpperCase())
  );
  const clientesUnicos = uniqueClients.size;
  const validas = quotes.filter(q => q.status === 'VAL' || q.status === 'ACT').length;
  const emitidas = quotes.filter(q => q.status === 'EMI' || q.status === 'GAN').length;
  const vencidas = quotes.filter(q => q.status === 'VEN').length;
  const primaTotal = quotes.reduce((acc, q) => acc + (q.primaTotal || 0), 0);

  return {
    items: quotes,
    stats: {
      total,
      clientesUnicos,
      validas,
      emitidas,
      vencidas,
      primaTotal
    }
  };
};

export const getQuoteDetail = async (id) => {
  const quoteId = Number(id);
  if (isNaN(quoteId) || quoteId <= 0) {
    const error = new Error('El ID de cotización debe ser un número válido.');
    error.statusCode = 400;
    error.isOperational = true;
    throw error;
  }

  const detail = await Quotes.getQuoteDetail(quoteId);
  if (!detail) {
    const error = new Error('Cotización no encontrada.');
    error.statusCode = 404;
    error.isOperational = true;
    throw error;
  }

  return detail;
};

export default {
  listInsuredQuotes,
  listIntermediaryQuotes,
  getQuoteDetail
};
