export const typeDefs = `#graphql
  type Expense {
    id: ID!
    title: String!
    amount: Float!
  }

  input AddExpenseInput {
    title: String!
    amount: Float!
  }

  type Query {
    hello: String!
    expenses: [Expense!]!
  }

  type Mutation {
    addExpense(input: AddExpenseInput!): Expense!
  }
`;
