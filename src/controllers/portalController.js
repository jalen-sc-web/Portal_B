import portalService from '../services/portalService.js';

const getOwner = async (req, res, next) => {
    try {
        const { tipoid, numid, dvid } = req.body;
        const result = await portalService.getOwnerDetails({ tipoid, numid, dvid });

        if (!result.found) {
            return res.status(404).json({
                status: false,
                data: result.data,
                message: result.message
            });
        }

        return res.status(200).json({
            status: true,
            data: result.data,
            message: result.message
        });
    } catch (error) {
        next(error);
    }
};

const getFullRate = async (req, res, next) => {
    try {
        const { codProd, indTipoPlan, familiares } = req.body;
        
        if (!familiares || !Array.isArray(familiares) || familiares.length === 0) {
            return res.status(400).json({
                status: false,
                message: "Debe proporcionar un array de familiares con su código de parentesco y fecha de nacimiento o edad."
            });
        }

        const result = await portalService.getFullRateDetails({ codProd, indTipoPlan, familiares });

        if (!result.found) {
            return res.status(404).json({
                status: false,
                data: result.data,
                message: result.message
            });
        }

        return res.status(200).json({
            status: true,
            data: result.data,
            message: result.message
        });
    } catch (error) {
        next(error);
    }
};

const saveQuote = async (req, res, next) => {
    try {
        const {
            codProd,
            nombreAseg,
            telefono,
            email,
            prima,
            sumaAseg,
            codInter,
            codOfiEmi,
            hcmPlan,
            asegurados,
            coberturas,
            codUsuCrea
        } = req.body;

        // Validaciones básicas de integridad del payload
        if (!codProd || !nombreAseg || prima === undefined || prima === null || !hcmPlan || !asegurados || !Array.isArray(asegurados) || asegurados.length === 0) {
            return res.status(400).json({
                status: false,
                message: "Faltan datos obligatorios para procesar y guardar la cotización maestra o sus dependientes."
            });
        }

        // Llamada al servicio que ejecuta la transacción o el PL/SQL en Oracle
        const result = await portalService.saveQuoteDetails({
            codProd,
            nombreAseg,
            telefono,
            email,
            prima,
            sumaAseg,
            codInter,
            codOfiEmi,
            hcmPlan,
            asegurados,
            coberturas: coberturas || [],
            codUsuCrea
        });

        if (!result.success) {
            return res.status(400).json({
                status: false,
                message: result.message || "No se pudo completar el registro de la cotización."
            });
        }

        return res.status(201).json({
            status: true,
            data: result.data,
            message: result.message || "Cotización guardada exitosamente en el esquema WEBPORTAL."
        });

    } catch (error) {
        next(error);
    }
};

const getQuote = async (req, res, next) => {
    try {
        const { codCoti } = req.params; // <-- Recibe el código interno numérico de la cotización

        if (!codCoti || isNaN(Number(codCoti))) {
            return res.status(400).json({
                status: false,
                message: "Debe proporcionar un código de cotización válido."
            });
        }

        console.log(codCoti);
        
        // Llamada al servicio que consulta la base de datos (Oracle/SQL)
        const result = await portalService.getQuoteDetails({ codCoti: Number(codCoti) });

        if (!result.found) {
            return res.status(404).json({
                status: false,
                data: null,
                message: result.message || "No se encontró la cotización especificada para la emisión."
            });
        }

        return res.status(200).json({
            status: true,
            data: result.data, // Aquí viaja el objeto con hcmPlan, asegurados, etc.
            message: result.message || "Cotización recuperada exitosamente."
        });
    } catch (error) {
        next(error);
    }
};

export default {
    getOwner,
    getFullRate,
    saveQuote,
    getQuote
};
