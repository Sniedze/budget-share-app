import { logAuthzDenied } from '../logger.js';
import type { User } from '../modules/auth/types.js';
import type { GraphqlContext } from './context.js';

export const requireAuth = (context: GraphqlContext): User => {
  if (!context.currentUser) {
    logAuthzDenied('authentication_required', {
      operationName: context.graphqlOperationName,
      requestId: context.requestId,
    });
    throw new Error('Authentication required.');
  }
  return context.currentUser;
};
