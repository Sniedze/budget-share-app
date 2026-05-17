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

export type BudgetAssumptions = {
  __typename?: 'BudgetAssumptions';
  monthlyIncomeEstimate: Scalars['Float']['output'];
  startingBalance: Scalars['Float']['output'];
};

export type BudgetAssumptionsInput = {
  monthlyIncomeEstimate: Scalars['Float']['input'];
  startingBalance: Scalars['Float']['input'];
};

export type ChangePasswordInput = {
  currentPassword: Scalars['String']['input'];
  newPassword: Scalars['String']['input'];
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
  userId: Maybe<Scalars['ID']['output']>;
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

export type ImportExpenseRowInput = {
  amount: Scalars['Float']['input'];
  category: Scalars['String']['input'];
  clientRowId: Scalars['ID']['input'];
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

export type ImportExpenseRowResult = {
  __typename?: 'ImportExpenseRowResult';
  clientRowId: Scalars['ID']['output'];
  errorCode: Maybe<Scalars['String']['output']>;
  errorMessage: Maybe<Scalars['String']['output']>;
  expense: Maybe<Expense>;
  success: Scalars['Boolean']['output'];
};

export type ImportExpensesInput = {
  rows: Array<ImportExpenseRowInput>;
};

export type ImportExpensesPayload = {
  __typename?: 'ImportExpensesPayload';
  failedCount: Scalars['Int']['output'];
  importedCount: Scalars['Int']['output'];
  results: Array<ImportExpenseRowResult>;
};

export type ImportMerchantRuleSetting = {
  __typename?: 'ImportMerchantRuleSetting';
  category: Scalars['String']['output'];
  expenseGroup: Maybe<Scalars['String']['output']>;
  flow: Scalars['String']['output'];
  groupId: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  matchType: Scalars['String']['output'];
  pattern: Scalars['String']['output'];
  split: Maybe<Scalars['String']['output']>;
  updatedAt: Scalars['String']['output'];
};

export type ImportMerchantRuleSettingInput = {
  category: Scalars['String']['input'];
  expenseGroup?: InputMaybe<Scalars['String']['input']>;
  flow: Scalars['String']['input'];
  groupId?: InputMaybe<Scalars['String']['input']>;
  id: Scalars['ID']['input'];
  matchType: Scalars['String']['input'];
  pattern: Scalars['String']['input'];
  split?: InputMaybe<Scalars['String']['input']>;
  updatedAt: Scalars['String']['input'];
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

export type MonthCategoryBudgetEntry = {
  __typename?: 'MonthCategoryBudgetEntry';
  amount: Scalars['Float']['output'];
  category: Scalars['String']['output'];
};

export type MonthCategoryBudgetEntryInput = {
  amount: Scalars['Float']['input'];
  category: Scalars['String']['input'];
};

export type Mutation = {
  __typename?: 'Mutation';
  acceptGroupInvitation: GroupInvitation;
  addExpense: Expense;
  changePassword: AuthPayload;
  createGroup: Group;
  declineExpenseGroupParticipation: Scalars['Boolean']['output'];
  declineGroupInvitation: GroupInvitation;
  deleteExpense: Scalars['Boolean']['output'];
  deleteExpenseGroup: Scalars['Boolean']['output'];
  importExpenses: ImportExpensesPayload;
  login: AuthPayload;
  logout: Scalars['Boolean']['output'];
  logoutAllDevices: Scalars['Boolean']['output'];
  recordSettlementPayment: SettlementPayment;
  refreshSession: AuthPayload;
  register: AuthPayload;
  resendGroupInvitation: GroupPendingInvitation;
  saveUserWorkspaceSettings: UserWorkspaceSettings;
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


export type MutationChangePasswordArgs = {
  input: ChangePasswordInput;
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


export type MutationImportExpensesArgs = {
  input: ImportExpensesInput;
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


export type MutationResendGroupInvitationArgs = {
  email: Scalars['String']['input'];
  groupId: Scalars['ID']['input'];
};


export type MutationSaveUserWorkspaceSettingsArgs = {
  input: SaveUserWorkspaceSettingsInput;
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
  userWorkspaceSettings: UserWorkspaceSettings;
};


export type QueryGroupSplitTemplatesArgs = {
  groupId: Scalars['ID']['input'];
};


export type QueryHouseholdSettlementsArgs = {
  period?: InputMaybe<SettlementPeriod>;
};


export type QueryUserWorkspaceSettingsArgs = {
  yearMonth: Scalars['String']['input'];
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

export type SaveMonthCategoryBudgetsInput = {
  budgets: Array<MonthCategoryBudgetEntryInput>;
  yearMonth: Scalars['String']['input'];
};

export type SaveUserWorkspaceSettingsInput = {
  budgetAssumptions?: InputMaybe<BudgetAssumptionsInput>;
  importColumnMappings?: InputMaybe<Array<SavedColumnMappingSettingInput>>;
  importCustomCategories?: InputMaybe<Array<Scalars['String']['input']>>;
  importMerchantRules?: InputMaybe<Array<ImportMerchantRuleSettingInput>>;
  monthCategoryBudgets?: InputMaybe<SaveMonthCategoryBudgetsInput>;
};

export type SavedColumnMappingSetting = {
  __typename?: 'SavedColumnMappingSetting';
  amountHeaderKey: Maybe<Scalars['String']['output']>;
  amountIndex: Scalars['Int']['output'];
  currencyHeaderKey: Maybe<Scalars['String']['output']>;
  currencyIndex: Maybe<Scalars['Int']['output']>;
  dateHeaderKey: Maybe<Scalars['String']['output']>;
  dateIndex: Scalars['Int']['output'];
  descriptionHeaderKey: Maybe<Scalars['String']['output']>;
  descriptionIndex: Maybe<Scalars['Int']['output']>;
  merchantHeaderKey: Maybe<Scalars['String']['output']>;
  merchantIndex: Scalars['Int']['output'];
  signature: Scalars['String']['output'];
};

export type SavedColumnMappingSettingInput = {
  amountHeaderKey?: InputMaybe<Scalars['String']['input']>;
  amountIndex: Scalars['Int']['input'];
  currencyHeaderKey?: InputMaybe<Scalars['String']['input']>;
  currencyIndex?: InputMaybe<Scalars['Int']['input']>;
  dateHeaderKey?: InputMaybe<Scalars['String']['input']>;
  dateIndex: Scalars['Int']['input'];
  descriptionHeaderKey?: InputMaybe<Scalars['String']['input']>;
  descriptionIndex?: InputMaybe<Scalars['Int']['input']>;
  merchantHeaderKey?: InputMaybe<Scalars['String']['input']>;
  merchantIndex: Scalars['Int']['input'];
  signature: Scalars['String']['input'];
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

export type SettlementPeriod =
  | 'CurrentMonth'
  | 'Last6Months'
  | 'Last12Months';

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

export type UserWorkspaceSettings = {
  __typename?: 'UserWorkspaceSettings';
  budgetAssumptions: BudgetAssumptions;
  importColumnMappings: Array<SavedColumnMappingSetting>;
  importCustomCategories: Array<Scalars['String']['output']>;
  importMerchantRules: Array<ImportMerchantRuleSetting>;
  monthCategoryBudgets: Array<MonthCategoryBudgetEntry>;
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

export type LogoutAllDevicesMutationVariables = Exact<{ [key: string]: never; }>;


export type LogoutAllDevicesMutation = { __typename?: 'Mutation', logoutAllDevices: boolean };

export type ChangePasswordMutationVariables = Exact<{
  input: ChangePasswordInput;
}>;


export type ChangePasswordMutation = { __typename?: 'Mutation', changePassword: { __typename?: 'AuthPayload', user: { __typename?: 'User', id: string, email: string, fullName: string, createdAt: string } } };

export type ExpenseFieldsFragment = { __typename?: 'Expense', id: string, title: string, amount: number, currency: string, createdAt: string, transactionDate: string, category: string, expenseGroup: string | null, split: SplitType, groupId: string | null, createdByUserId: string | null, paidByUserId: string | null, isPrivate: boolean, flow: ExpenseFlow, splitDetails: Array<{ __typename?: 'SplitAllocation', participant: string, ratio: number, amount: number }> };

export type GetExpensesQueryVariables = Exact<{ [key: string]: never; }>;


export type GetExpensesQuery = { __typename?: 'Query', expenses: Array<{ __typename?: 'Expense', id: string, title: string, amount: number, currency: string, createdAt: string, transactionDate: string, category: string, expenseGroup: string | null, split: SplitType, groupId: string | null, createdByUserId: string | null, paidByUserId: string | null, isPrivate: boolean, flow: ExpenseFlow, splitDetails: Array<{ __typename?: 'SplitAllocation', participant: string, ratio: number, amount: number }> }> };

export type AddExpenseMutationVariables = Exact<{
  input: AddExpenseInput;
}>;


export type AddExpenseMutation = { __typename?: 'Mutation', addExpense: { __typename?: 'Expense', id: string, title: string, amount: number, currency: string, createdAt: string, transactionDate: string, category: string, expenseGroup: string | null, split: SplitType, groupId: string | null, createdByUserId: string | null, paidByUserId: string | null, isPrivate: boolean, flow: ExpenseFlow, splitDetails: Array<{ __typename?: 'SplitAllocation', participant: string, ratio: number, amount: number }> } };

export type ImportExpensesMutationVariables = Exact<{
  input: ImportExpensesInput;
}>;


export type ImportExpensesMutation = { __typename?: 'Mutation', importExpenses: { __typename?: 'ImportExpensesPayload', importedCount: number, failedCount: number, results: Array<{ __typename?: 'ImportExpenseRowResult', clientRowId: string, success: boolean, errorCode: string | null, errorMessage: string | null, expense: { __typename?: 'Expense', id: string, title: string, amount: number, currency: string, createdAt: string, transactionDate: string, category: string, expenseGroup: string | null, split: SplitType, groupId: string | null, createdByUserId: string | null, paidByUserId: string | null, isPrivate: boolean, flow: ExpenseFlow, splitDetails: Array<{ __typename?: 'SplitAllocation', participant: string, ratio: number, amount: number }> } | null }> } };

export type UpdateExpenseMutationVariables = Exact<{
  input: UpdateExpenseInput;
}>;


export type UpdateExpenseMutation = { __typename?: 'Mutation', updateExpense: { __typename?: 'Expense', id: string, title: string, amount: number, currency: string, createdAt: string, transactionDate: string, category: string, expenseGroup: string | null, split: SplitType, groupId: string | null, createdByUserId: string | null, paidByUserId: string | null, isPrivate: boolean, flow: ExpenseFlow, splitDetails: Array<{ __typename?: 'SplitAllocation', participant: string, ratio: number, amount: number }> } | null };

export type DeleteExpenseMutationVariables = Exact<{
  input: DeleteExpenseInput;
}>;


export type DeleteExpenseMutation = { __typename?: 'Mutation', deleteExpense: boolean };

export type GetGroupsQueryVariables = Exact<{ [key: string]: never; }>;


export type GetGroupsQuery = { __typename?: 'Query', groups: Array<{ __typename?: 'Group', id: string, name: string, description: string | null, totalSpent: number, yourShare: number, expenseGroupLabels: Array<string>, pendingInvitations: Array<{ __typename?: 'GroupPendingInvitation', email: string, name: string, status: GroupInvitationStatus, emailDeliveryStatus: InvitationEmailDeliveryStatus | null }>, members: Array<{ __typename?: 'GroupMember', userId: string | null, name: string, email: string, ratio: number }>, expenses: Array<{ __typename?: 'GroupExpense', date: string, expenseGroup: string | null, category: string, description: string, paidBy: string, total: number, yourShare: number, isPrivate: boolean, currency: string }> }> };

export type GetGroupSplitTemplatesQueryVariables = Exact<{
  groupId: Scalars['ID']['input'];
}>;


export type GetGroupSplitTemplatesQuery = { __typename?: 'Query', groupSplitTemplates: Array<{ __typename?: 'SplitTemplate', id: string, groupId: string, category: string, templateName: string, splitDetails: Array<{ __typename?: 'SplitAllocation', participant: string, ratio: number }> }> };

export type CreateGroupMutationVariables = Exact<{
  input: CreateGroupInput;
}>;


export type CreateGroupMutation = { __typename?: 'Mutation', createGroup: { __typename?: 'Group', id: string, name: string, description: string | null, totalSpent: number, yourShare: number, expenseGroupLabels: Array<string>, pendingInvitations: Array<{ __typename?: 'GroupPendingInvitation', email: string, name: string, status: GroupInvitationStatus, emailDeliveryStatus: InvitationEmailDeliveryStatus | null }>, members: Array<{ __typename?: 'GroupMember', userId: string | null, name: string, email: string, ratio: number }>, expenses: Array<{ __typename?: 'GroupExpense', date: string, expenseGroup: string | null, category: string, description: string, paidBy: string, total: number, yourShare: number, isPrivate: boolean, currency: string }> } };

export type UpdateGroupMutationVariables = Exact<{
  input: UpdateGroupInput;
}>;


export type UpdateGroupMutation = { __typename?: 'Mutation', updateGroup: { __typename?: 'Group', id: string, name: string, description: string | null, totalSpent: number, yourShare: number, expenseGroupLabels: Array<string>, pendingInvitations: Array<{ __typename?: 'GroupPendingInvitation', email: string, name: string, status: GroupInvitationStatus, emailDeliveryStatus: InvitationEmailDeliveryStatus | null }>, members: Array<{ __typename?: 'GroupMember', userId: string | null, name: string, email: string, ratio: number }>, expenses: Array<{ __typename?: 'GroupExpense', date: string, expenseGroup: string | null, category: string, description: string, paidBy: string, total: number, yourShare: number, isPrivate: boolean, currency: string }> } };

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

export type ResendGroupInvitationMutationVariables = Exact<{
  groupId: Scalars['ID']['input'];
  email: Scalars['String']['input'];
}>;


export type ResendGroupInvitationMutation = { __typename?: 'Mutation', resendGroupInvitation: { __typename?: 'GroupPendingInvitation', email: string, name: string, status: GroupInvitationStatus, emailDeliveryStatus: InvitationEmailDeliveryStatus | null } };

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

export type GetHouseholdSettlementsQueryVariables = Exact<{
  period?: InputMaybe<SettlementPeriod>;
}>;


export type GetHouseholdSettlementsQuery = { __typename?: 'Query', householdSettlements: Array<{ __typename?: 'HouseholdSettlement', groupId: string, groupName: string, balances: Array<{ __typename?: 'SettlementBalance', memberName: string, amount: number }>, transfers: Array<{ __typename?: 'SettlementTransfer', fromMember: string, toMember: string, amount: number }>, expenseGroups: Array<{ __typename?: 'ExpenseGroupSettlement', expenseGroup: string, totalExpenses: number, balances: Array<{ __typename?: 'SettlementBalance', memberName: string, amount: number }>, transfers: Array<{ __typename?: 'SettlementTransfer', fromMember: string, toMember: string, amount: number }> }>, payments: Array<{ __typename?: 'SettlementPayment', id: string, groupId: string, expenseGroup: string | null, fromMember: string, toMember: string, amount: number, note: string | null, settledAt: string }> }> };

export type RecordSettlementPaymentMutationVariables = Exact<{
  input: RecordSettlementPaymentInput;
}>;


export type RecordSettlementPaymentMutation = { __typename?: 'Mutation', recordSettlementPayment: { __typename?: 'SettlementPayment', id: string, groupId: string, expenseGroup: string | null, fromMember: string, toMember: string, amount: number, note: string | null, settledAt: string } };

export type UserWorkspaceSettingsFieldsFragment = { __typename?: 'UserWorkspaceSettings', importCustomCategories: Array<string>, budgetAssumptions: { __typename?: 'BudgetAssumptions', startingBalance: number, monthlyIncomeEstimate: number }, monthCategoryBudgets: Array<{ __typename?: 'MonthCategoryBudgetEntry', category: string, amount: number }>, importMerchantRules: Array<{ __typename?: 'ImportMerchantRuleSetting', id: string, flow: string, matchType: string, pattern: string, category: string, split: string | null, groupId: string | null, expenseGroup: string | null, updatedAt: string }>, importColumnMappings: Array<{ __typename?: 'SavedColumnMappingSetting', signature: string, dateIndex: number, merchantIndex: number, amountIndex: number, currencyIndex: number | null, descriptionIndex: number | null, dateHeaderKey: string | null, merchantHeaderKey: string | null, amountHeaderKey: string | null, currencyHeaderKey: string | null, descriptionHeaderKey: string | null }> };

export type GetUserWorkspaceSettingsQueryVariables = Exact<{
  yearMonth: Scalars['String']['input'];
}>;


export type GetUserWorkspaceSettingsQuery = { __typename?: 'Query', userWorkspaceSettings: { __typename?: 'UserWorkspaceSettings', importCustomCategories: Array<string>, budgetAssumptions: { __typename?: 'BudgetAssumptions', startingBalance: number, monthlyIncomeEstimate: number }, monthCategoryBudgets: Array<{ __typename?: 'MonthCategoryBudgetEntry', category: string, amount: number }>, importMerchantRules: Array<{ __typename?: 'ImportMerchantRuleSetting', id: string, flow: string, matchType: string, pattern: string, category: string, split: string | null, groupId: string | null, expenseGroup: string | null, updatedAt: string }>, importColumnMappings: Array<{ __typename?: 'SavedColumnMappingSetting', signature: string, dateIndex: number, merchantIndex: number, amountIndex: number, currencyIndex: number | null, descriptionIndex: number | null, dateHeaderKey: string | null, merchantHeaderKey: string | null, amountHeaderKey: string | null, currencyHeaderKey: string | null, descriptionHeaderKey: string | null }> } };

export type SaveUserWorkspaceSettingsMutationVariables = Exact<{
  input: SaveUserWorkspaceSettingsInput;
}>;


export type SaveUserWorkspaceSettingsMutation = { __typename?: 'Mutation', saveUserWorkspaceSettings: { __typename?: 'UserWorkspaceSettings', importCustomCategories: Array<string>, budgetAssumptions: { __typename?: 'BudgetAssumptions', startingBalance: number, monthlyIncomeEstimate: number }, monthCategoryBudgets: Array<{ __typename?: 'MonthCategoryBudgetEntry', category: string, amount: number }>, importMerchantRules: Array<{ __typename?: 'ImportMerchantRuleSetting', id: string, flow: string, matchType: string, pattern: string, category: string, split: string | null, groupId: string | null, expenseGroup: string | null, updatedAt: string }>, importColumnMappings: Array<{ __typename?: 'SavedColumnMappingSetting', signature: string, dateIndex: number, merchantIndex: number, amountIndex: number, currencyIndex: number | null, descriptionIndex: number | null, dateHeaderKey: string | null, merchantHeaderKey: string | null, amountHeaderKey: string | null, currencyHeaderKey: string | null, descriptionHeaderKey: string | null }> } };
