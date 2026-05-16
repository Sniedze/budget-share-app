import { z } from 'zod';
import { parseWithSchema } from '../../lib/parseWithSchema.js';
import { stripControlCharacters } from '../../lib/sanitize.js';
import type { CreateExpenseInput, ImportExpenseRowInput, UpdateExpenseInput } from './types.js';

const splitTypeSchema = z.enum(['Personal', 'Shared', 'Custom']);
const expenseFlowSchema = z.enum(['Outgoing', 'Incoming']);

const splitAllocationInputSchema = z.object({
  participant: z.string().trim().min(1).max(255),
  ratio: z.number().finite(),
});

const createExpenseBodySchema = z.object({
  title: z.string().transform((v) => stripControlCharacters(v).trim()).pipe(z.string().min(1).max(255)),
  amount: z.number().finite().positive(),
  transactionDate: z.string().trim().min(1).max(64),
  category: z.string().transform((v) => stripControlCharacters(v).trim()).pipe(z.string().min(1).max(64)),
  expenseGroup: z
    .string()
    .transform((v) => stripControlCharacters(v).trim())
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  split: splitTypeSchema,
  splitDetails: z.array(splitAllocationInputSchema).optional(),
  groupId: z.string().trim().min(1).optional(),
  paidByUserId: z.string().trim().min(1).optional(),
  isPrivate: z.boolean().optional(),
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/)
    .optional(),
  flow: expenseFlowSchema.optional(),
});

export const createExpenseInputSchema = createExpenseBodySchema;

export const updateExpenseInputSchema = createExpenseBodySchema.extend({
  id: z.string().trim().min(1),
});

export const deleteExpenseInputSchema = z.object({
  id: z.string().trim().min(1),
});

export const importExpenseRowInputSchema = createExpenseBodySchema.extend({
  clientRowId: z.string().trim().min(1).max(128),
});

export const importExpensesInputSchema = z.object({
  rows: z.array(importExpenseRowInputSchema).min(1).max(1000),
});

export const parseCreateExpenseInput = (value: unknown): CreateExpenseInput =>
  parseWithSchema(createExpenseInputSchema, value, 'expense');

export const parseUpdateExpenseInput = (value: unknown): UpdateExpenseInput =>
  parseWithSchema(updateExpenseInputSchema, value, 'expense');

export const parseDeleteExpenseId = (value: unknown): string =>
  parseWithSchema(deleteExpenseInputSchema, value, 'expense').id;

export const parseImportExpenseRows = (value: unknown): ImportExpenseRowInput[] =>
  parseWithSchema(importExpensesInputSchema, value, 'import').rows;
