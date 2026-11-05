import quoteService from '../services/quoteService.js';

export const getInsuredQuotes = async (req, res, next) => {
  try {
    const user = req.user || {};
    const { search, status, codprod, email, username } = req.query;

    const result = await quoteService.listInsuredQuotes({
      username: username || user.username,
      email: email || user.email,
      numid: user.numid || user.username,
      search,
      status,
      codprod
    });

    return res.status(200).json({
      status: true,
      data: result,
      message: 'Cotizaciones del asegurado obtenidas exitosamente.'
    });
  } catch (error) {
    next(error);
  }
};

export const getIntermediaryQuotes = async (req, res, next) => {
  try {
    const user = req.user || {};
    const { search, status, codprod, codinter, sort } = req.query;

    const result = await quoteService.listIntermediaryQuotes({
      codinter: codinter || user.codinter || '000001',
      username: user.username,
      search,
      status,
      codprod,
      sort
    });

    return res.status(200).json({
      status: true,
      data: result,
      message: 'Cotizaciones del intermediario obtenidas exitosamente.'
    });
  } catch (error) {
    next(error);
  }
};

export const getQuoteById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const detail = await quoteService.getQuoteDetail(id);

    return res.status(200).json({
      status: true,
      data: detail,
      message: 'Detalle de la cotización obtenido exitosamente.'
    });
  } catch (error) {
    next(error);
  }
};

export default {
  getInsuredQuotes,
  getIntermediaryQuotes,
  getQuoteById
};
