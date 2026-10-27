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
        const { familiares } = req.body; // <-- Recibe el array de objetos: [{ codParent: "0001", edad: 25 }, ...]
        
        if (!familiares || !Array.isArray(familiares) || familiares.length === 0) {
            return res.status(400).json({
                status: false,
                message: "Debe proporcionar un array de familiares con su código de parentesco y edad."
            });
        }

        const result = await portalService.getFullRateDetails({ familiares });

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

export default {
    getOwner,
    getFullRate
};
