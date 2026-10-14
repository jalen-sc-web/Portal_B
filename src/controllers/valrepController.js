import Valrep from '../db/Valrep.js';

const getCountry = async (req, res) => {
    const country = await Valrep.getCountry();
    if (country.permissionError) {
        return res
            .status(403)
            .send({
                status: false,
                message: country.permissionError
            });
    }
    if (country.error) {
        return res
            .status(500)
            .send({
                status: false,
                message: country.error
            });
    }
    return res
        .status(200)
        .send({
            status: true,
            country: country
        });
}

const getState = async (req, res) => {
    const state = await Valrep.getState(req.body);
    if (state.permissionError) {
        return res
            .status(403)
            .send({
                status: false,
                message: state.permissionError
            });
    }
    if (state.error) {
        return res
            .status(500)
            .send({
                status: false,
                message: state.error
            });
    }
    return res
        .status(200)
        .send({
            status: true,
            state: state
        });
}

const getCity = async (req, res) => {
    const city = await Valrep.getCity(req.body);
    if (city.permissionError) {
        return res
            .status(403)
            .send({
                status: false,
                message: city.permissionError
            });
    }
    if (city.error) {
        return res
            .status(500)
            .send({
                status: false,
                message: city.error
            });
    }
    return res
        .status(200)
        .send({
            status: true,
            city: city
        });
}

const getMunicipality = async (req, res) => {
    const municipality = await Valrep.getMunicipality(req.body);
    if (municipality.permissionError) {
        return res
            .status(403)
            .send({
                status: false,
                message: municipality.permissionError
            });
    }
    if (municipality.error) {
        return res
            .status(500)
            .send({
                status: false,
                message: municipality.error
            });
    }
    return res
        .status(200)
        .send({
            status: true,
            municipality: municipality
        });
}

const getLval = async (req, res) => {
    try {
        const lval = await Valrep.getLval(req.body);

        if (lval.error) {
            return res.status(500).send({
                status: false,
                message: lval.error
            });
        }

        return res.status(200).send({
            status: true,
            lval: lval
        });
    } catch (error) {
        return res.status(500).send({
            status: false,
            message: 'Ocurrió un error en el servidor.'
        });
    }
};

export default {
    getCountry,
    getState,
    getCity,
    getMunicipality, 
    getLval
}