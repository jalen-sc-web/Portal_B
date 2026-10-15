import valrepService from '../services/valrepService.js';

const getCountry = async (req, res, next) => {
    try {
        const data = await valrepService.getCountries();
        return res.status(200).json({
            status: true,
            data,
            message: "Países obtenidos exitosamente."
        });
    } catch (error) {
        next(error);
    }
};

const getState = async (req, res, next) => {
    try {
        const codpais = req.query.codpais || req.body?.codpais;
        const data = await valrepService.getStates(codpais);
        return res.status(200).json({
            status: true,
            data,
            message: "Estados obtenidos exitosamente."
        });
    } catch (error) {
        next(error);
    }
};

const getCity = async (req, res, next) => {
    try {
        const codpais = req.query.codpais || req.body?.codpais;
        const codestado = req.query.codestado || req.body?.codestado;
        const data = await valrepService.getCities(codpais, codestado);
        return res.status(200).json({
            status: true,
            data,
            message: "Ciudades obtenidas exitosamente."
        });
    } catch (error) {
        next(error);
    }
};

const getMunicipality = async (req, res, next) => {
    try {
        const codpais = req.query.codpais || req.body?.codpais;
        const codestado = req.query.codestado || req.body?.codestado;
        const codciudad = req.query.codciudad || req.body?.codciudad;
        const data = await valrepService.getMunicipalities(codpais, codestado, codciudad);
        return res.status(200).json({
            status: true,
            data,
            message: "Municipios obtenidos exitosamente."
        });
    } catch (error) {
        next(error);
    }
};

const getLval = async (req, res, next) => {
    try {
        const tipolval = req.query.tipolval || req.body?.tipolval;
        const data = await valrepService.getLvals(tipolval);
        return res.status(200).json({
            status: true,
            data,
            message: "Lista de valores obtenida exitosamente."
        });
    } catch (error) {
        next(error);
    }
};

export default {
    getCountry,
    getState,
    getCity,
    getMunicipality,
    getLval
};