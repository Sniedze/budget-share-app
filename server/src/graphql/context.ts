import type { Request } from 'express';
import { verifyAccessToken } from '../modules/auth/jwt.js';
import { getUserById } from '../modules/auth/service.js';
import type { User } from '../modules/auth/types.js';

export type GraphqlContext = {
  currentUser: User | null;
};

const extractBearerToken = (req: Request): string | null => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return null;
  }
  const [scheme, token] = authHeader.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    return null;
  }
  return token.trim();
};

export const createGraphqlContext = async (req: Request): Promise<GraphqlContext> => {
  const token = extractBearerToken(req);
  if (!token) {
    return { currentUser: null };
  }

  const claims = verifyAccessToken(token);
  if (!claims) {
    return { currentUser: null };
  }

  const currentUser = await getUserById(claims.userId);
  return { currentUser };
};
