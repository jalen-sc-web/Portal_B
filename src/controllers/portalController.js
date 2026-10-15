import Portal from "../db/Portal.js";

const getOwner = async (req, res) => {
  try {
    const { tipoid, numid, dvid } = req.body;
    if (!tipoid || !numid) {
      return res.status(400).send({
        status: false,
        message: "Los campos tipoid y numid son requeridos.",
      });
    }

    const owner = await Portal.getOwner({ tipoid, numid, dvid });
    if (owner.permissionError) {
      return res.status(403).send({
        status: false,
        message: owner.permissionError,
      });
    }
    if (owner.error) {
      return res.status(500).send({
        status: false,
        message: owner.error,
      });
    }

    let tipocli;
    switch (tipoid) {
      case "V":
      case "E":
        tipocli = "P";
        break;
      case "G":
        tipocli = "G";
        break;
      case "M":
        tipocli = "P";
        break;
      default:
        tipocli = "E";
        break;
    }

    if (!owner || !owner.data) {
      return res.status(404).send({
        status: false,
        data: {
          tipocli: tipocli,
          indnacional: "N",
          edocivil: "S",
        },
        message: "No se encontró el titular con los datos proporcionados.",
      });
    }

    const d = owner.data;

    return res.status(200).send({
      status: true,
      data: {
        numid: req.body.numid,
        nomter: d.NOMTER ?? "",
        apeter: d.APETER ?? "",
        direc: d.DIREC ?? null,
        email: (d.EMAIL ?? null)?.toLowerCase(),
        codpais: d.CODPAIS ?? "001",
        descpais: d.DESCPAIS ?? null,
        codestado: d.CODESTADO ?? null,
        descestado: d.DESCESTADO ?? null,
        codciudad: d.CODCIUDAD ?? null,
        descciudad: d.DESCCIUDAD ?? null,
        codmunicipio: d.CODMUNICIPIO ?? null,
        descmunicipio: d.DESCMUNICIPIO ?? null,
        sexo: d.SEXO ?? null,
        fecnac: d.FECNAC ?? null,
        tipoid: d.TIPOID,
        indnacional: d.INDNACIONAL ?? "N",
        edocivil: d.EDOCIVIL ?? "S",
        titular: ((d.NOMTER ?? "") + " " + (d.APETER ?? "")).trim(),
        zip: d.ZIP ?? null,
        zip_desc: d.DESCZONAPOSTAL ?? null,
        codcli: d.CODCLI ?? null,
        telef1: d.TELEF1 ?? null,
        telef2: d.TELEF2 ?? null,
        indactcorreo: d.INDACTCORREO ?? null,
        indacttlf: d.INDACTTLF ?? null,
        fecmodcorreo: d.FECMODCORREO ?? null,
        fecmodtlf: d.FECMODTLF ?? null,
        tipocli: tipocli,
        dvid: req.body.dvid,
      },
    });
  } catch (error) {
    console.error("Error en getOwner controller:", error);
    return res.status(500).send({
      status: false,
      message: "Ocurrió un error interno en el servidor.",
    });
  }
};

export default {
  getOwner,
};
