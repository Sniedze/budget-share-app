import nodemailer from 'nodemailer';
import type { ResolvedSmtpSettings } from './smtpConfig.js';

let cachedKey: string | null = null;
let cachedTransporter: nodemailer.Transporter | null = null;

const transporterKey = (smtp: ResolvedSmtpSettings): string =>
  `${smtp.host}:${smtp.port}:${smtp.secure ? '1' : '0'}:${smtp.user}`;

export const getSmtpTransporter = (smtp: ResolvedSmtpSettings): nodemailer.Transporter => {
  const key = transporterKey(smtp);
  if (cachedTransporter && cachedKey === key) {
    return cachedTransporter;
  }
  cachedKey = key;
  cachedTransporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: { user: smtp.user, pass: smtp.pass },
  });
  return cachedTransporter;
};

export const resetSmtpTransporterForTests = (): void => {
  cachedKey = null;
  cachedTransporter = null;
};
