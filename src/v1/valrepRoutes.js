import express from 'express';

import valrepController from '../../src/controllers/valrepController.js';

const router = express.Router();

router

    .post("/country", valrepController.getCountry)
    .post("/state", valrepController.getState)
    .post("/city", valrepController.getCity)
    .post("/municipality", valrepController.getMunicipality)
    .post("/lval", valrepController.getLval)
       
export default router;