export const typeDefs = `#graphql
  enum SplitType {
    Personal
    Shared
    Custom
  }

  type Expense {
    id: ID!
    title: String!
    amount: Float!
    createdAt: String!
    transactionDate: String!
    category: String!
    expenseGroup: String
    split: SplitType!
    splitDetails: [SplitAllocation!]!
    groupId: ID
    createdByUserId: ID
    paidByUserId: ID
  }

  type SplitAllocation {
    participant: String!
    ratio: Float!
    amount: Float!
  }

  type GroupMember {
    name: String!
    email: String!
    ratio: Float!
  }

  type GroupExpense {
    date: String!
    expenseGroup: String
    category: String!
    description: String!
    paidBy: String!
    total: Float!
    yourShare: Float!
  }

  type Group {
    id: ID!
    name: String!
    description: String
    members: [GroupMember!]!
    totalSpent: Float!
    yourShare: Float!
    expenses: [GroupExpense!]!
  }

  enum GroupInvitationStatus {
    Pending
    Accepted
  }

  type GroupInvitation {
    id: ID!
    groupId: ID!
    groupName: String!
    email: String!
    status: GroupInvitationStatus!
    invitedAt: String!
    acceptedAt: String
  }

  type SplitTemplate {
    id: ID!
    groupId: ID!
    category: String!
    templateName: String!
    splitDetails: [SplitAllocation!]!
  }

  type User {
    id: ID!
    email: String!
    fullName: String!
    createdAt: String!
  }

  type AuthPayload {
    accessToken: String!
    refreshToken: String!
    user: User!
  }

  input SplitAllocationInput {
    participant: String!
    ratio: Float!
  }

  input GroupMemberInput {
    name: String!
    email: String!
    ratio: Float!
  }

  input CreateGroupInput {
    name: String!
    description: String
    members: [GroupMemberInput!]!
  }

  input UpdateGroupInput {
    id: ID!
    name: String!
    description: String
    members: [GroupMemberInput!]!
  }

  input RegisterInput {
    email: String!
    password: String!
    fullName: String!
  }

  input LoginInput {
    email: String!
    password: String!
  }

  input RefreshSessionInput {
    refreshToken: String!
  }

  input UpsertSplitTemplateInput {
    groupId: ID!
    category: String!
    templateName: String!
    splitDetails: [SplitAllocationInput!]!
  }

  input AddExpenseInput {
    title: String!
    amount: Float!
    transactionDate: String!
    category: String!
    expenseGroup: String
    split: SplitType!
    splitDetails: [SplitAllocationInput!]
    groupId: ID
    paidByUserId: ID
  }

  input DeleteExpenseInput {
    id: ID!
  }

  input UpdateExpenseInput {
    id: ID!
    title: String!
    amount: Float!
    transactionDate: String!
    category: String!
    expenseGroup: String
    split: SplitType!
    splitDetails: [SplitAllocationInput!]
    groupId: ID
    paidByUserId: ID
  }

  type Query {
    hello: String!
    me: User
    expenses: [Expense!]!
    groups: [Group!]!
    myInvitations: [GroupInvitation!]!
    groupSplitTemplates(groupId: ID!): [SplitTemplate!]!
  }

  type Mutation {
    addExpense(input: AddExpenseInput!): Expense!
    deleteExpense(input: DeleteExpenseInput!): Boolean!
    updateExpense(input: UpdateExpenseInput!): Expense
    createGroup(input: CreateGroupInput!): Group!
    updateGroup(input: UpdateGroupInput!): Group!
    register(input: RegisterInput!): AuthPayload!
    login(input: LoginInput!): AuthPayload!
    refreshSession(input: RefreshSessionInput!): AuthPayload!
    upsertGroupSplitTemplate(input: UpsertSplitTemplateInput!): SplitTemplate!
  }
`;
