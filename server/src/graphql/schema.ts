export const typeDefs = `#graphql
  type Expense {
    id: ID!
    title: String!
    amount: Float!
    createdAt: String!
  }

  input AddExpenseInput {
    title: String!
    amount: Float!
  }

  input DeleteExpenseInput {
    id: ID!
  }

  type Query {
    hello: String!
    expenses: [Expense!]!
  }

  type Mutation {
    addExpense(input: AddExpenseInput!): Expense!
    deleteExpense(input: DeleteExpenseInput!): Boolean!
  }
`;
