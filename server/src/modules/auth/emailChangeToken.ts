import { createHash, randomBytes } from 'node:crypto';

export const hashEmailChangeToken = (token: string): string =>
  createHash('sha256').update(token, 'utf8').digest('hex');

export const createEmailChangeToken = (): string => randomBytes(32).toString('hex');
