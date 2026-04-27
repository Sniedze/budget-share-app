const expenses = [
  { id: '1', title: 'Groceries', amount: 54.2 },
  { id: '2', title: 'Electricity', amount: 89.99 },
];

export const resolvers = {
  Query: {
    hello: () => 'Hello from GraphQL!',
    expenses: () => expenses,
  },
  Mutation: {
    addExpense: (_parent: unknown, args: { input: { title: string; amount: number } }) => {
      const newExpense = {
        id: String(expenses.length + 1),
        title: args.input.title,
        amount: args.input.amount,
      };

      expenses.push(newExpense);

      return newExpense;
    },
  },
};
