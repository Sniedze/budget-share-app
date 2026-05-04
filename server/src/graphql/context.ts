import type { Request, Response } from 'express';
import { verifyAccessToken } from '../modules/auth/jwt.js';
import { getAccessTokenFromCookies } from '../modules/auth/cookies.js';
import { getUserById } from '../modules/auth/service.js';
import type { User } from '../modules/auth/types.js';

export type GraphqlContext = {
  req: Request;
  res: Response;
  currentUser: User | null;
  graphqlOperationName: string | null;
  requestId: string;
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

const readGraphqlOperationName = (req: Request): string | null => {
  const body = req.body as { operationName?: unknown } | undefined;
  if (!body || typeof body.operationName !== 'string') {
    return null;
  }
  const name = body.operationName.trim();
  return name.length > 0 ? name : null;
};

const readRequestId = (res: Response): string => {
  const raw = res.locals.requestId;
  return typeof raw === 'string' && raw.length > 0 ? raw : 'unknown';
};

export const createGraphqlContext = async (req: Request, res: Response): Promise<GraphqlContext> => {
  const graphqlOperationName = readGraphqlOperationName(req);
  const requestId = readRequestId(res);
  const token = extractBearerToken(req) ?? getAccessTokenFromCookies(req);
  if (!token) {
    return { req, res, currentUser: null, graphqlOperationName, requestId };
  }

  const claims = verifyAccessToken(token);
  if (!claims) {
    return { req, res, currentUser: null, graphqlOperationName, requestId };
  }

  const currentUser = await getUserById(claims.userId);
  return { req, res, currentUser, graphqlOperationName, requestId };
};
