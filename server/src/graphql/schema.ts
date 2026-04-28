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

  input SplitAllocationInput {
    participant: String!
    ratio: Float!
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
  }

  type Mutation {
    addExpense(input: AddExpenseInput!): Expense!
    deleteExpense(input: DeleteExpenseInput!): Boolean!
    updateExpense(input: UpdateExpenseInput!): Expense
  }
`;
