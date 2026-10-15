import express from 'express';
import valrepController from '../controllers/valrepController.js';

const router = express.Router();

router
    // Endpoints REST estándar (GET)
    .get("/country", valrepController.getCountry)
    .get("/state", valrepController.getState)
    .get("/city", valrepController.getCity)
    .get("/municipality", valrepController.getMunicipality)
    .get("/lval", valrepController.getLval)

    // Soporte retrocompatible (POST)
    .post("/country", valrepController.getCountry)
    .post("/state", valrepController.getState)
    .post("/city", valrepController.getCity)
    .post("/municipality", valrepController.getMunicipality)
    .post("/lval", valrepController.getLval);
       
export default router;