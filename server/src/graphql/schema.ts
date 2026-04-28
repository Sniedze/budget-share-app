export const typeDefs = `#graphql
  type Expense {
    id: ID!
    title: String!
    amount: Float!
    createdAt: String!
    transactionDate: String!
    category: String!
    split: String!
  }

  input AddExpenseInput {
    title: String!
    amount: Float!
    transactionDate: String!
    category: String!
    split: String!
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
    split: String!
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
