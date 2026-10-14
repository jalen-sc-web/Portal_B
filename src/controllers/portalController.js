import Amp from '../db/Portal.js';
import moment from 'moment-timezone';
import nodemailer from 'nodemailer';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const getOwner = async (req, res) => {
    const owner = await Amp.getOwner(req.body);
    if (owner.permissionError) {
        return res
            .status(403)
            .send({
                status: false,
                message: owner.permissionError
            });
    }
    if (owner.error) {
        return res
            .status(500)
            .send({
                status: false,
                message: owner.error
            });
    }

    let tipocli;
    switch (req.body.tipoid) {
        case 'V':
        case 'E':
            tipocli = 'P';
            break;
        case 'G':
            tipocli = 'G';
            break;
        case 'M':
            tipocli = 'P';
            break;
        default:
            tipocli = 'E';
            break;
    }

    if (!owner || !owner.data) {
        console.log(`No se encontró titular en Acsel para numid: ${req.body.numid}, tipoid: ${req.body.tipoid}.`);

        return res.status(200).send({
            status: true,
            data: {
                code: 404,
                tipocli: tipocli,
                indnacional: 'N',
                edocivil: 'S',
            },
            message: "No se encontró el titular en Acsel con los datos proporcionados. Puede rellenar los campos."
        });
    }

    return res
        .status(200)
        .send({
            status: true,
            code: 200,  
            data: {
                numid: req.body.numid,
                nomter: owner.data.NOMTER ?? '',
                apeter: owner.data.APETER ?? '', 
                direc: owner.data.DIREC ?? null,
                email: (owner.data.EMAIL ?? null)?.toLowerCase(),
                codpais: owner.data.CODPAIS ?? '001',
                descpais: owner.data.DESCPAIS ?? null,
                codestado: owner.data.CODESTADO ?? null,
                descestado: owner.data.DESCESTADO ?? null,
                codciudad: owner.data.CODCIUDAD ?? null,
                descciudad: owner.data.DESCCIUDAD ?? null,
                codmunicipio: owner.data.CODMUNICIPIO ?? null,
                descmunicipio: owner.data.DESCMUNICIPIO ?? null, 
                sexo: owner.data.SEXO ?? null,
                fecnac: owner.data.FECNAC ?? null,
                tipoid: owner.data.TIPOID,
                indnacional: owner.data.INDNACIONAL ?? 'N',
                edocivil: owner.data.EDOCIVIL ?? 'S',
                titular: ((owner.data.NOMTER ?? '') + ' ' + (owner.data.APETER ?? '')).trim(), 
                zip: owner.data.ZIP ?? null,
                zip_desc: owner.data.DESCZONAPOSTAL ?? null,
                codcli: owner.data.CODCLI ?? null,
                telef1: owner.data.TELEF1 ?? null,
                telef2: owner.data.TELEF2 ?? null,
                indactcorreo: owner.data.INDACTCORREO ?? null,
                indacttlf: owner.data.INDACTTLF ?? null,
                fecmodcorreo: owner.data.FECMODCORREO ?? null,
                fecmodtlf: owner.data.FECMODTLF ?? null,
                tipocli: tipocli,
                dvid: req.body.dvid
            }
        });
}

export default {
    getOwner
}