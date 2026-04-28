export const typeDefs = `#graphql
  type Expense {
    id: ID!
    title: String!
    amount: Float!
    createdAt: String!
    transactionDate: String!
  }

  input AddExpenseInput {
    title: String!
    amount: Float!
    transactionDate: String!
  }

  input DeleteExpenseInput {
    id: ID!
  }

    input UpdateExpenseInput {
    id: ID!
    title: String!
    amount: Float!
    transactionDate: String!
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
