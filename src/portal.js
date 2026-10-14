import express from 'express';
import dotenv from 'dotenv/config';
import cors from 'cors';
import bodyParser from 'body-parser';
import { initializePool, closePoolAndExit } from './config/database.js';

import v1ValrepRouter from './v1/valrepRoutes.js';
import v1PortalRouter from './v1/portalRoutes.js';
import v1AuthRoutes from './v1/authRoutes.js';

const app = express();
dotenv;

app.use(cors({
  origin: '*',
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  optionsSuccessStatus: 204,
  credentials: true ,
  allowedHeaders: ['Content-Type', 'Authorization', 'x-client-channel'],

}));

app.use(cors());

app.use(express.json({ limit: '10mb' }));

app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

app.use('/apixportal/api/v1/auth', v1AuthRoutes);
app.use("/apixportal/api/v1/valrep", v1ValrepRouter); 
app.use("/apixportal/api/v1/portal", v1PortalRouter);

const PORT = process.env.PORT

async function startApplication() {
    try {
        await initializePool();        
        console.log(`🚀 API (HTTP) escuchando en puerto ${PORT}`);
    } catch (error) {
        console.error('❌ Error fatal al iniciar la aplicación:', error);
        await closePoolAndExit();
        process.exit(1);
    }
}

startApplication();