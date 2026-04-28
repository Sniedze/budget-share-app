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
    split: SplitType!
    splitDetails: [SplitAllocation!]!
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

  input AddExpenseInput {
    title: String!
    amount: Float!
    transactionDate: String!
    category: String!
    split: SplitType!
    splitDetails: [SplitAllocationInput!]
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
    split: SplitType!
    splitDetails: [SplitAllocationInput!]
  }

  type Query {
    hello: String!
    expenses: [Expense!]!
    groups: [Group!]!
  }

  type Mutation {
    addExpense(input: AddExpenseInput!): Expense!
    deleteExpense(input: DeleteExpenseInput!): Boolean!
    updateExpense(input: UpdateExpenseInput!): Expense
    createGroup(input: CreateGroupInput!): Group!
  }
`;
