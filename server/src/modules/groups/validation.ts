import { z } from 'zod';
import { parseWithSchema } from '../../lib/parseWithSchema.js';
import { stripControlCharacters } from '../../lib/sanitize.js';
import { validateEmailFormat } from '../auth/validation.js';
import type {
  CreateGroupInput,
  RecordSettlementPaymentInput,
  UpdateGroupInput,
  UpsertSplitTemplateInput,
} from './types.js';

const groupMemberSchema = z.object({
  name: z.string().transform((v) => stripControlCharacters(v).trim()).pipe(z.string().min(1).max(255)),
  email: z
    .string()
    .transform((v) => stripControlCharacters(v).trim().toLowerCase())
    .pipe(z.string().min(1).max(254)),
  ratio: z.number().finite().positive(),
});

const createGroupBodySchema = z.object({
  name: z.string().transform((v) => stripControlCharacters(v).trim()).pipe(z.string().min(1).max(255)),
  description: z
    .string()
    .transform((v) => stripControlCharacters(v).trim())
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  members: z.array(groupMemberSchema).min(2).max(50),
});

export const createGroupInputSchema = createGroupBodySchema;

export const updateGroupInputSchema = createGroupBodySchema.extend({
  id: z.string().trim().min(1),
});

export const upsertSplitTemplateInputSchema = z.object({
  groupId: z.string().trim().min(1),
  category: z.string().transform((v) => stripControlCharacters(v).trim()).pipe(z.string().min(1).max(64)),
  templateName: z.string().transform((v) => stripControlCharacters(v).trim()).pipe(z.string().min(1).max(128)),
  splitDetails: z.array(
    z.object({
      participant: z.string().trim().min(1).max(255),
      ratio: z.number().finite().positive(),
    }),
  ).min(1),
});

const optionalSettlementString = () =>
  z
    .string()
    .nullish()
    .transform((value) => {
      if (value === null || value === undefined) {
        return undefined;
      }
      const trimmed = stripControlCharacters(value).trim();
      return trimmed.length > 0 ? trimmed : undefined;
    });

export const recordSettlementPaymentInputSchema = z.object({
  groupId: z.string().trim().min(1),
  expenseGroup: optionalSettlementString(),
  fromMember: z.string().transform((v) => stripControlCharacters(v).trim()).pipe(z.string().min(1).max(255)),
  toMember: z.string().transform((v) => stripControlCharacters(v).trim()).pipe(z.string().min(1).max(255)),
  amount: z.number().finite().positive(),
  note: optionalSettlementString(),
  settledAt: z.string().trim().min(1).max(32),
});

const assertMemberEmails = (members: Array<{ email: string }>): void => {
  for (const member of members) {
    validateEmailFormat(member.email, 'register');
  }
};

export const parseCreateGroupInput = (value: unknown): CreateGroupInput => {
  const parsed = parseWithSchema(createGroupInputSchema, value, 'group');
  assertMemberEmails(parsed.members);
  return parsed;
};

export const parseUpdateGroupInput = (value: unknown): UpdateGroupInput => {
  const parsed = parseWithSchema(updateGroupInputSchema, value, 'group');
  assertMemberEmails(parsed.members);
  return parsed;
};

export const parseUpsertSplitTemplateInput = (value: unknown): UpsertSplitTemplateInput =>
  parseWithSchema(upsertSplitTemplateInputSchema, value, 'split template');

export const parseRecordSettlementPaymentInput = (value: unknown): RecordSettlementPaymentInput => {
  const parsed = parseWithSchema(recordSettlementPaymentInputSchema, value, 'settlement');
  return {
    groupId: parsed.groupId,
    expenseGroup: parsed.expenseGroup ?? undefined,
    fromMember: parsed.fromMember,
    toMember: parsed.toMember,
    amount: parsed.amount,
    note: parsed.note ?? undefined,
    settledAt: parsed.settledAt,
  };
};
