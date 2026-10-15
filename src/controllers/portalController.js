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

export default {
    getOwner
};
