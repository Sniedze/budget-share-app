import { gql } from '@apollo/client';

export const EXPORT_MY_DATA = gql`
  query ExportMyData {
    exportMyData {
      exportedAt
      format
      data
    }
  }
`;

export const DELETE_ACCOUNT = gql`
  mutation DeleteAccount($input: DeleteAccountInput!) {
    deleteAccount(input: $input)
  }
`;

/** Must match server `DELETE_ACCOUNT_CONFIRMATION`. */
export const DELETE_ACCOUNT_CONFIRMATION_PHRASE = 'delete my account';
