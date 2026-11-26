import nodemailer from 'nodemailer';
import { logger, serializeError } from './logger.js';

export const isEmailAllowed = (email, whitelistConfig) => {
  if (!whitelistConfig || typeof whitelistConfig !== 'string' || whitelistConfig.trim() === '' || whitelistConfig.trim() === '*') {
    // Si la lista no está configurada o es '*', se permite todo (comportamiento de producción)
    return true;
  }

  const cleanEmail = String(email || '').trim().toLowerCase();
  if (!cleanEmail) return false;

  const allowedPatterns = whitelistConfig
    .split(',')
    .map(p => p.trim().toLowerCase())
    .filter(Boolean);

  return allowedPatterns.some(pattern => {
    if (pattern === '*' || pattern === cleanEmail) {
      return true;
    }
    // Soporta comodines de dominio: '*@dominio.com' o '@dominio.com'
    if (pattern.startsWith('*@')) {
      return cleanEmail.endsWith(pattern.slice(1));
    }
    if (pattern.startsWith('@')) {
      return cleanEmail.endsWith(pattern);
    }
    if (pattern.startsWith('*.')) {
      const domain = pattern.slice(2);
      return cleanEmail.endsWith(`@${domain}`) || cleanEmail.endsWith(`.${domain}`);
    }
    return cleanEmail === pattern;
  });
};

const getMailerConfig = () => {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = Number(process.env.SMTP_PORT) || 587;
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || '"Seguros Constitución" <no-reply@constitucion.com>';
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:4200';
  const whitelist = process.env.EMAIL_WHITELIST || '';

  return { host, port, secure, user, pass, from, frontendUrl, whitelist };
};

export const sendPasswordResetEmail = async ({ to, nombre, resetToken }) => {
  const config = getMailerConfig();
  const resetUrl = `${config.frontendUrl}/?reset_token=${encodeURIComponent(resetToken)}`;

  logger.info('Enlace de recuperación de contraseña generado', 'Mailer.sendPasswordResetEmail', { to, nombre: nombre || 'Usuario', resetUrl });

  // 1. Verificación de Lista Blanca (Whitelist) para evitar envíos accidentales
  if (!isEmailAllowed(to, config.whitelist)) {
    logger.warn(`Envío bloqueado por EMAIL_WHITELIST para '${to}'`, 'Mailer.sendPasswordResetEmail', { to, whitelist: config.whitelist });
    return {
      sent: false,
      blocked: true,
      reason: `Destinatario '${to}' bloqueado por EMAIL_WHITELIST`,
      resetUrl
    };
  }

  // 2. Si no hay credenciales SMTP configuradas en el .env, no intentar enviar por red
  if (!config.user || !config.pass) {
    logger.warn('SMTP_USER o SMTP_PASS no configurados; correo no enviado por red', 'Mailer.sendPasswordResetEmail', { to });
    return { sent: false, reason: 'SMTP no configurado', resetUrl };
  }

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass
    }
  });

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f4f6fa; margin: 0; padding: 20px; color: #1e3354; }
        .card { max-width: 540px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 32px; box-shadow: 0 4px 20px rgba(0,0,0,0.06); }
        .logo { font-size: 20px; font-weight: bold; color: #1f3c6e; margin-bottom: 24px; }
        h1 { font-size: 20px; color: #1f3c6e; margin-top: 0; }
        p { font-size: 14px; line-height: 1.6; color: #526077; }
        .btn { display: inline-block; background-color: #1f3c6e; color: #ffffff !important; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 14px; margin: 20px 0; }
        .footer { margin-top: 28px; font-size: 11px; color: #8e9bb0; border-top: 1px solid #edf1f7; padding-top: 16px; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="logo">Seguros Constitución</div>
        <h1>Recuperación de Contraseña</h1>
        <p>Hola <strong>${nombre || 'Asegurado'}</strong>,</p>
        <p>Hemos recibido una solicitud para restablecer la contraseña de acceso a tu cuenta en el Portal del Asegurado.</p>
        <p>Para ingresar y crear una nueva contraseña, haz clic en el siguiente botón:</p>
        <div style="text-align: center;">
          <a href="${resetUrl}" class="btn" target="_blank">Restablecer mi Contraseña</a>
        </div>
        <p style="font-size: 12px; color: #7e8da3;">Este enlace es seguro y tiene una vigencia de <strong>72 horas</strong>. Si no solicitaste este cambio, puedes ignorar este correo de forma segura.</p>
        <div class="footer">
          Seguros Constitución · Tu confianza nos mueve.<br>
          Si tienes problemas con el botón, copia y pega este enlace en tu navegador:<br>
          <a href="${resetUrl}" style="color: #1f3c6e; word-break: break-all;">${resetUrl}</a>
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    const info = await transporter.sendMail({
      from: config.from,
      to,
      subject: 'Recuperación de Contraseña - Seguros Constitución',
      text: `Hola ${nombre || 'Usuario'},\n\nPara restablecer tu contraseña en el Portal del Asegurado, ingresa al siguiente enlace (válido por 72 horas):\n${resetUrl}\n\nSi no solicitaste este cambio, ignora este mensaje.`,
      html: htmlContent
    });

    logger.info(`Correo de recuperación enviado con éxito a ${to}`, 'Mailer.sendPasswordResetEmail', { to, messageId: info.messageId });
    return { sent: true, messageId: info.messageId, resetUrl };
  } catch (err) {
    logger.error('Error al enviar correo SMTP', 'Mailer.sendPasswordResetEmail', { to, error: serializeError(err) });
    return { sent: false, error: err.message, resetUrl };
  }
};

export default {
  isEmailAllowed,
  sendPasswordResetEmail
};
