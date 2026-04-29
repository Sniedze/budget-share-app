import { gql } from '@apollo/client';

export const ME = gql`
  query Me {
    me {
      id
      email
      fullName
      createdAt
    }
  }
`;

export const LOGIN = gql`
  mutation Login($input: LoginInput!) {
    login(input: $input) {
      accessToken
      refreshToken
      user {
        id
        email
        fullName
        createdAt
      }
    }
  }
`;

export const REGISTER = gql`
  mutation Register($input: RegisterInput!) {
    register(input: $input) {
      accessToken
      refreshToken
      user {
        id
        email
        fullName
        createdAt
      }
    }
  }
`;
