import type { CodegenConfig } from '@graphql-codegen/cli';

const config: CodegenConfig = {
  overwrite: true,
  schema: '../server/src/graphql/schema.graphql',
  documents: ['src/**/*.{ts,tsx}'],
  ignoreNoDocuments: true,
  generates: {
    'src/graphql/generated/graphql.ts': {
      plugins: ['typescript', 'typescript-operations'],
      config: {
        enumsAsTypes: true,
        avoidOptionals: {
          field: true,
          inputValue: false,
          object: false,
        },
        scalars: {
          ID: 'string',
        },
      },
    },
  },
};

export default config;
