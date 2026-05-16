import type { z } from 'zod';
import { appError, ErrorCode } from '../graphql/appError.js';

export const parseWithSchema = <T>(schema: z.ZodType<T>, value: unknown, label = 'input'): T => {
  const result = schema.safeParse(value);
  if (result.success) {
    return result.data;
  }
  const details = result.error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join('.') : 'value';
      return `${path}: ${issue.message}`;
    })
    .join('; ');
  throw appError(ErrorCode.BAD_USER_INPUT, details ? `${label}: ${details}` : `Invalid ${label}.`);
};
