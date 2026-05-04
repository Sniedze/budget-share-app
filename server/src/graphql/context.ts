import type { Request, Response } from 'express';
import { verifyAccessToken } from '../modules/auth/jwt.js';
import { getAccessTokenFromCookies } from '../modules/auth/cookies.js';
import { getUserById } from '../modules/auth/service.js';
import type { User } from '../modules/auth/types.js';

export type GraphqlContext = {
  req: Request;
  res: Response;
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

export const createGraphqlContext = async (req: Request, res: Response): Promise<GraphqlContext> => {
  const token = extractBearerToken(req) ?? getAccessTokenFromCookies(req);
  if (!token) {
    return { req, res, currentUser: null };
  }

  const claims = verifyAccessToken(token);
  if (!claims) {
    return { req, res, currentUser: null };
  }

  const currentUser = await getUserById(claims.userId);
  return { req, res, currentUser };
};
