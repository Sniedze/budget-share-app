import { gql } from '@apollo/client';

export const GET_GROUPS = gql`
  query GetGroups {
    groups {
      id
      name
      description
      totalSpent
      yourShare
      members {
        name
        email
        ratio
      }
      expenses {
        date
        description
        paidBy
        total
        yourShare
      }
    }
  }
`;

export const CREATE_GROUP = gql`
  mutation CreateGroup($input: CreateGroupInput!) {
    createGroup(input: $input) {
      id
      name
      description
      totalSpent
      yourShare
      members {
        name
        email
        ratio
      }
      expenses {
        date
        description
        paidBy
        total
        yourShare
      }
    }
  }
`;
