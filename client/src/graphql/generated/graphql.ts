export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
};

export type AddExpenseInput = {
  amount: Scalars['Float']['input'];
  category: Scalars['String']['input'];
  currency?: InputMaybe<Scalars['String']['input']>;
  expenseGroup?: InputMaybe<Scalars['String']['input']>;
  flow?: InputMaybe<ExpenseFlow>;
  groupId?: InputMaybe<Scalars['ID']['input']>;
  isPrivate?: InputMaybe<Scalars['Boolean']['input']>;
  paidByUserId?: InputMaybe<Scalars['ID']['input']>;
  split: SplitType;
  splitDetails?: InputMaybe<Array<SplitAllocationInput>>;
  title: Scalars['String']['input'];
  transactionDate: Scalars['String']['input'];
};

export type AuthPayload = {
  __typename?: 'AuthPayload';
  user: User;
};

export type CreateGroupInput = {
  description?: InputMaybe<Scalars['String']['input']>;
  members: Array<GroupMemberInput>;
  name: Scalars['String']['input'];
};

export type DeleteExpenseInput = {
  id: Scalars['ID']['input'];
};

export type Expense = {
  __typename?: 'Expense';
  amount: Scalars['Float']['output'];
  category: Scalars['String']['output'];
  createdAt: Scalars['String']['output'];
  createdByUserId: Maybe<Scalars['ID']['output']>;
  currency: Scalars['String']['output'];
  expenseGroup: Maybe<Scalars['String']['output']>;
  flow: ExpenseFlow;
  groupId: Maybe<Scalars['ID']['output']>;
  id: Scalars['ID']['output'];
  isPrivate: Scalars['Boolean']['output'];
  paidByUserId: Maybe<Scalars['ID']['output']>;
  split: SplitType;
  splitDetails: Array<SplitAllocation>;
  title: Scalars['String']['output'];
  transactionDate: Scalars['String']['output'];
};

export type ExpenseFlow =
  | 'Incoming'
  | 'Outgoing';

export type ExpenseGroupSettlement = {
  __typename?: 'ExpenseGroupSettlement';
  balances: Array<SettlementBalance>;
  expenseGroup: Scalars['String']['output'];
  totalExpenses: Scalars['Float']['output'];
  transfers: Array<SettlementTransfer>;
};

export type Group = {
  __typename?: 'Group';
  description: Maybe<Scalars['String']['output']>;
  /** Expense group names from split templates (may exist before any expense is posted). */
  expenseGroupLabels: Array<Scalars['String']['output']>;
  expenses: Array<GroupExpense>;
  id: Scalars['ID']['output'];
  members: Array<GroupMember>;
  name: Scalars['String']['output'];
  /** Pending invitees without accounts yet (for the current viewer's households). */
  pendingInvitations: Array<GroupPendingInvitation>;
  totalSpent: Scalars['Float']['output'];
  yourShare: Scalars['Float']['output'];
};

export type GroupExpense = {
  __typename?: 'GroupExpense';
  category: Scalars['String']['output'];
  currency: Scalars['String']['output'];
  date: Scalars['String']['output'];
  description: Scalars['String']['output'];
  expenseGroup: Maybe<Scalars['String']['output']>;
  isPrivate: Scalars['Boolean']['output'];
  paidBy: Scalars['String']['output'];
  total: Scalars['Float']['output'];
  yourShare: Scalars['Float']['output'];
};

export type GroupInvitation = {
  __typename?: 'GroupInvitation';
  acceptedAt: Maybe<Scalars['String']['output']>;
  email: Scalars['String']['output'];
  emailDeliveryStatus: Maybe<InvitationEmailDeliveryStatus>;
  groupId: Scalars['ID']['output'];
  groupName: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  invitedAt: Scalars['String']['output'];
  status: GroupInvitationStatus;
};

export type GroupInvitationStatus =
  | 'Accepted'
  | 'Declined'
  | 'Pending';

export type GroupMember = {
  __typename?: 'GroupMember';
  email: Scalars['String']['output'];
  name: Scalars['String']['output'];
  ratio: Scalars['Float']['output'];
};

export type GroupMemberInput = {
  email: Scalars['String']['input'];
  name: Scalars['String']['input'];
  ratio: Scalars['Float']['input'];
};

export type GroupPendingInvitation = {
  __typename?: 'GroupPendingInvitation';
  email: Scalars['String']['output'];
  emailDeliveryStatus: Maybe<InvitationEmailDeliveryStatus>;
  name: Scalars['String']['output'];
  status: GroupInvitationStatus;
};

export type HouseholdSettlement = {
  __typename?: 'HouseholdSettlement';
  balances: Array<SettlementBalance>;
  expenseGroups: Array<ExpenseGroupSettlement>;
  groupId: Scalars['ID']['output'];
  groupName: Scalars['String']['output'];
  payments: Array<SettlementPayment>;
  transfers: Array<SettlementTransfer>;
};

export type InvitationEmailDeliveryStatus =
  | 'EmailFailed'
  | 'EmailSent'
  | 'EmailSkipped'
  | 'PendingEmail';

export type LoginInput = {
  email: Scalars['String']['input'];
  password: Scalars['String']['input'];
  rememberMe?: InputMaybe<Scalars['Boolean']['input']>;
};

export type Mutation = {
  __typename?: 'Mutation';
  acceptGroupInvitation: GroupInvitation;
  addExpense: Expense;
  createGroup: Group;
  declineExpenseGroupParticipation: Scalars['Boolean']['output'];
  declineGroupInvitation: GroupInvitation;
  deleteExpense: Scalars['Boolean']['output'];
  deleteExpenseGroup: Scalars['Boolean']['output'];
  login: AuthPayload;
  logout: Scalars['Boolean']['output'];
  recordSettlementPayment: SettlementPayment;
  refreshSession: AuthPayload;
  register: AuthPayload;
  updateExpense: Maybe<Expense>;
  updateGroup: Group;
  upsertGroupSplitTemplate: SplitTemplate;
};


export type MutationAcceptGroupInvitationArgs = {
  id: Scalars['ID']['input'];
};


export type MutationAddExpenseArgs = {
  input: AddExpenseInput;
};


export type MutationCreateGroupArgs = {
  input: CreateGroupInput;
};


export type MutationDeclineExpenseGroupParticipationArgs = {
  category: Scalars['String']['input'];
  groupId: Scalars['ID']['input'];
};


export type MutationDeclineGroupInvitationArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteExpenseArgs = {
  input: DeleteExpenseInput;
};


export type MutationDeleteExpenseGroupArgs = {
  category: Scalars['String']['input'];
  groupId: Scalars['ID']['input'];
};


export type MutationLoginArgs = {
  input: LoginInput;
};


export type MutationRecordSettlementPaymentArgs = {
  input: RecordSettlementPaymentInput;
};


export type MutationRefreshSessionArgs = {
  input: RefreshSessionInput;
};


export type MutationRegisterArgs = {
  input: RegisterInput;
};


export type MutationUpdateExpenseArgs = {
  input: UpdateExpenseInput;
};


export type MutationUpdateGroupArgs = {
  input: UpdateGroupInput;
};


export type MutationUpsertGroupSplitTemplateArgs = {
  input: UpsertSplitTemplateInput;
};

export type Query = {
  __typename?: 'Query';
  expenses: Array<Expense>;
  groupSplitTemplates: Array<SplitTemplate>;
  groups: Array<Group>;
  hello: Scalars['String']['output'];
  householdSettlements: Array<HouseholdSettlement>;
  me: Maybe<User>;
  myInvitations: Array<GroupInvitation>;
};


export type QueryGroupSplitTemplatesArgs = {
  groupId: Scalars['ID']['input'];
};

export type RecordSettlementPaymentInput = {
  amount: Scalars['Float']['input'];
  expenseGroup?: InputMaybe<Scalars['String']['input']>;
  fromMember: Scalars['String']['input'];
  groupId: Scalars['ID']['input'];
  note?: InputMaybe<Scalars['String']['input']>;
  settledAt: Scalars['String']['input'];
  toMember: Scalars['String']['input'];
};

export type RefreshSessionInput = {
  refreshToken?: InputMaybe<Scalars['String']['input']>;
};

export type RegisterInput = {
  email: Scalars['String']['input'];
  fullName: Scalars['String']['input'];
  password: Scalars['String']['input'];
};

export type SettlementBalance = {
  __typename?: 'SettlementBalance';
  amount: Scalars['Float']['output'];
  memberName: Scalars['String']['output'];
};

export type SettlementPayment = {
  __typename?: 'SettlementPayment';
  amount: Scalars['Float']['output'];
  expenseGroup: Maybe<Scalars['String']['output']>;
  fromMember: Scalars['String']['output'];
  groupId: Scalars['ID']['output'];
  id: Scalars['ID']['output'];
  note: Maybe<Scalars['String']['output']>;
  settledAt: Scalars['String']['output'];
  toMember: Scalars['String']['output'];
};

export type SettlementTransfer = {
  __typename?: 'SettlementTransfer';
  amount: Scalars['Float']['output'];
  fromMember: Scalars['String']['output'];
  toMember: Scalars['String']['output'];
};

export type SplitAllocation = {
  __typename?: 'SplitAllocation';
  amount: Scalars['Float']['output'];
  participant: Scalars['String']['output'];
  ratio: Scalars['Float']['output'];
};

export type SplitAllocationInput = {
  participant: Scalars['String']['input'];
  ratio: Scalars['Float']['input'];
};

export type SplitTemplate = {
  __typename?: 'SplitTemplate';
  category: Scalars['String']['output'];
  groupId: Scalars['ID']['output'];
  id: Scalars['ID']['output'];
  splitDetails: Array<SplitAllocation>;
  templateName: Scalars['String']['output'];
};

export type SplitType =
  | 'Custom'
  | 'Personal'
  | 'Shared';

export type UpdateExpenseInput = {
  amount: Scalars['Float']['input'];
  category: Scalars['String']['input'];
  currency?: InputMaybe<Scalars['String']['input']>;
  expenseGroup?: InputMaybe<Scalars['String']['input']>;
  flow?: InputMaybe<ExpenseFlow>;
  groupId?: InputMaybe<Scalars['ID']['input']>;
  id: Scalars['ID']['input'];
  isPrivate?: InputMaybe<Scalars['Boolean']['input']>;
  paidByUserId?: InputMaybe<Scalars['ID']['input']>;
  split: SplitType;
  splitDetails?: InputMaybe<Array<SplitAllocationInput>>;
  title: Scalars['String']['input'];
  transactionDate: Scalars['String']['input'];
};

export type UpdateGroupInput = {
  description?: InputMaybe<Scalars['String']['input']>;
  id: Scalars['ID']['input'];
  members: Array<GroupMemberInput>;
  name: Scalars['String']['input'];
};

export type UpsertSplitTemplateInput = {
  category: Scalars['String']['input'];
  groupId: Scalars['ID']['input'];
  splitDetails: Array<SplitAllocationInput>;
  templateName: Scalars['String']['input'];
};

export type User = {
  __typename?: 'User';
  createdAt: Scalars['String']['output'];
  email: Scalars['String']['output'];
  fullName: Scalars['String']['output'];
  id: Scalars['ID']['output'];
};

export type MeQueryVariables = Exact<{ [key: string]: never; }>;


export type MeQuery = { __typename?: 'Query', me: { __typename?: 'User', id: string, email: string, fullName: string, createdAt: string } | null };

export type LoginMutationVariables = Exact<{
  input: LoginInput;
}>;


export type LoginMutation = { __typename?: 'Mutation', login: { __typename?: 'AuthPayload', user: { __typename?: 'User', id: string, email: string, fullName: string, createdAt: string } } };

export type RegisterMutationVariables = Exact<{
  input: RegisterInput;
}>;


export type RegisterMutation = { __typename?: 'Mutation', register: { __typename?: 'AuthPayload', user: { __typename?: 'User', id: string, email: string, fullName: string, createdAt: string } } };

export type LogoutMutationVariables = Exact<{ [key: string]: never; }>;


export type LogoutMutation = { __typename?: 'Mutation', logout: boolean };

export type ExpenseFieldsFragment = { __typename?: 'Expense', id: string, title: string, amount: number, currency: string, createdAt: string, transactionDate: string, category: string, expenseGroup: string | null, split: SplitType, groupId: string | null, createdByUserId: string | null, paidByUserId: string | null, isPrivate: boolean, flow: ExpenseFlow, splitDetails: Array<{ __typename?: 'SplitAllocation', participant: string, ratio: number, amount: number }> };

export type GetExpensesQueryVariables = Exact<{ [key: string]: never; }>;


export type GetExpensesQuery = { __typename?: 'Query', expenses: Array<{ __typename?: 'Expense', id: string, title: string, amount: number, currency: string, createdAt: string, transactionDate: string, category: string, expenseGroup: string | null, split: SplitType, groupId: string | null, createdByUserId: string | null, paidByUserId: string | null, isPrivate: boolean, flow: ExpenseFlow, splitDetails: Array<{ __typename?: 'SplitAllocation', participant: string, ratio: number, amount: number }> }> };

export type AddExpenseMutationVariables = Exact<{
  input: AddExpenseInput;
}>;


export type AddExpenseMutation = { __typename?: 'Mutation', addExpense: { __typename?: 'Expense', id: string, title: string, amount: number, currency: string, createdAt: string, transactionDate: string, category: string, expenseGroup: string | null, split: SplitType, groupId: string | null, createdByUserId: string | null, paidByUserId: string | null, isPrivate: boolean, flow: ExpenseFlow, splitDetails: Array<{ __typename?: 'SplitAllocation', participant: string, ratio: number, amount: number }> } };

export type UpdateExpenseMutationVariables = Exact<{
  input: UpdateExpenseInput;
}>;


export type UpdateExpenseMutation = { __typename?: 'Mutation', updateExpense: { __typename?: 'Expense', id: string, title: string, amount: number, currency: string, createdAt: string, transactionDate: string, category: string, expenseGroup: string | null, split: SplitType, groupId: string | null, createdByUserId: string | null, paidByUserId: string | null, isPrivate: boolean, flow: ExpenseFlow, splitDetails: Array<{ __typename?: 'SplitAllocation', participant: string, ratio: number, amount: number }> } | null };

export type DeleteExpenseMutationVariables = Exact<{
  input: DeleteExpenseInput;
}>;


export type DeleteExpenseMutation = { __typename?: 'Mutation', deleteExpense: boolean };

export type GetGroupsQueryVariables = Exact<{ [key: string]: never; }>;


export type GetGroupsQuery = { __typename?: 'Query', groups: Array<{ __typename?: 'Group', id: string, name: string, description: string | null, totalSpent: number, yourShare: number, expenseGroupLabels: Array<string>, pendingInvitations: Array<{ __typename?: 'GroupPendingInvitation', email: string, name: string, status: GroupInvitationStatus, emailDeliveryStatus: InvitationEmailDeliveryStatus | null }>, members: Array<{ __typename?: 'GroupMember', name: string, email: string, ratio: number }>, expenses: Array<{ __typename?: 'GroupExpense', date: string, expenseGroup: string | null, category: string, description: string, paidBy: string, total: number, yourShare: number, isPrivate: boolean, currency: string }> }> };

export type GetGroupSplitTemplatesQueryVariables = Exact<{
  groupId: Scalars['ID']['input'];
}>;


export type GetGroupSplitTemplatesQuery = { __typename?: 'Query', groupSplitTemplates: Array<{ __typename?: 'SplitTemplate', id: string, groupId: string, category: string, templateName: string, splitDetails: Array<{ __typename?: 'SplitAllocation', participant: string, ratio: number }> }> };

export type CreateGroupMutationVariables = Exact<{
  input: CreateGroupInput;
}>;


export type CreateGroupMutation = { __typename?: 'Mutation', createGroup: { __typename?: 'Group', id: string, name: string, description: string | null, totalSpent: number, yourShare: number, expenseGroupLabels: Array<string>, pendingInvitations: Array<{ __typename?: 'GroupPendingInvitation', email: string, name: string, status: GroupInvitationStatus, emailDeliveryStatus: InvitationEmailDeliveryStatus | null }>, members: Array<{ __typename?: 'GroupMember', name: string, email: string, ratio: number }>, expenses: Array<{ __typename?: 'GroupExpense', date: string, expenseGroup: string | null, category: string, description: string, paidBy: string, total: number, yourShare: number, isPrivate: boolean, currency: string }> } };

export type UpdateGroupMutationVariables = Exact<{
  input: UpdateGroupInput;
}>;


export type UpdateGroupMutation = { __typename?: 'Mutation', updateGroup: { __typename?: 'Group', id: string, name: string, description: string | null, totalSpent: number, yourShare: number, expenseGroupLabels: Array<string>, pendingInvitations: Array<{ __typename?: 'GroupPendingInvitation', email: string, name: string, status: GroupInvitationStatus, emailDeliveryStatus: InvitationEmailDeliveryStatus | null }>, members: Array<{ __typename?: 'GroupMember', name: string, email: string, ratio: number }>, expenses: Array<{ __typename?: 'GroupExpense', date: string, expenseGroup: string | null, category: string, description: string, paidBy: string, total: number, yourShare: number, isPrivate: boolean, currency: string }> } };

export type GetMyInvitationsQueryVariables = Exact<{ [key: string]: never; }>;


export type GetMyInvitationsQuery = { __typename?: 'Query', myInvitations: Array<{ __typename?: 'GroupInvitation', id: string, groupId: string, groupName: string, email: string, status: GroupInvitationStatus, emailDeliveryStatus: InvitationEmailDeliveryStatus | null, invitedAt: string, acceptedAt: string | null }> };

export type AcceptGroupInvitationMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type AcceptGroupInvitationMutation = { __typename?: 'Mutation', acceptGroupInvitation: { __typename?: 'GroupInvitation', id: string, status: GroupInvitationStatus } };

export type DeclineGroupInvitationMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type DeclineGroupInvitationMutation = { __typename?: 'Mutation', declineGroupInvitation: { __typename?: 'GroupInvitation', id: string, status: GroupInvitationStatus } };

export type DeclineExpenseGroupParticipationMutationVariables = Exact<{
  groupId: Scalars['ID']['input'];
  category: Scalars['String']['input'];
}>;


export type DeclineExpenseGroupParticipationMutation = { __typename?: 'Mutation', declineExpenseGroupParticipation: boolean };

export type DeleteExpenseGroupMutationVariables = Exact<{
  groupId: Scalars['ID']['input'];
  category: Scalars['String']['input'];
}>;


export type DeleteExpenseGroupMutation = { __typename?: 'Mutation', deleteExpenseGroup: boolean };

export type UpsertGroupSplitTemplateMutationVariables = Exact<{
  input: UpsertSplitTemplateInput;
}>;


export type UpsertGroupSplitTemplateMutation = { __typename?: 'Mutation', upsertGroupSplitTemplate: { __typename?: 'SplitTemplate', id: string, groupId: string, category: string, templateName: string, splitDetails: Array<{ __typename?: 'SplitAllocation', participant: string, ratio: number }> } };

export type GetHouseholdSettlementsQueryVariables = Exact<{ [key: string]: never; }>;


export type GetHouseholdSettlementsQuery = { __typename?: 'Query', householdSettlements: Array<{ __typename?: 'HouseholdSettlement', groupId: string, groupName: string, balances: Array<{ __typename?: 'SettlementBalance', memberName: string, amount: number }>, transfers: Array<{ __typename?: 'SettlementTransfer', fromMember: string, toMember: string, amount: number }>, expenseGroups: Array<{ __typename?: 'ExpenseGroupSettlement', expenseGroup: string, totalExpenses: number, balances: Array<{ __typename?: 'SettlementBalance', memberName: string, amount: number }>, transfers: Array<{ __typename?: 'SettlementTransfer', fromMember: string, toMember: string, amount: number }> }>, payments: Array<{ __typename?: 'SettlementPayment', id: string, groupId: string, expenseGroup: string | null, fromMember: string, toMember: string, amount: number, note: string | null, settledAt: string }> }> };

export type RecordSettlementPaymentMutationVariables = Exact<{
  input: RecordSettlementPaymentInput;
}>;


export type RecordSettlementPaymentMutation = { __typename?: 'Mutation', recordSettlementPayment: { __typename?: 'SettlementPayment', id: string, groupId: string, expenseGroup: string | null, fromMember: string, toMember: string, amount: number, note: string | null, settledAt: string } };
