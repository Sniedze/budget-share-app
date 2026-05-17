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
      user {
        id
        email
        fullName
        createdAt
      }
    }
  }
`;

export const LOGOUT = gql`
  mutation Logout {
    logout
  }
`;

export const LOGOUT_ALL_DEVICES = gql`
  mutation LogoutAllDevices {
    logoutAllDevices
  }
`;

export const CHANGE_PASSWORD = gql`
  mutation ChangePassword($input: ChangePasswordInput!) {
    changePassword(input: $input) {
      user {
        id
        email
        fullName
        createdAt
      }
    }
  }
`;
