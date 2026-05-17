import { gql } from '@apollo/client';

export const ME = gql`
  query Me {
    me {
      id
      email
      fullName
      createdAt
      phone
      timezone
      preferredCurrency
      pendingEmail
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
        phone
        timezone
        preferredCurrency
        pendingEmail
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
        phone
        timezone
        preferredCurrency
        pendingEmail
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
        phone
        timezone
        preferredCurrency
        pendingEmail
      }
    }
  }
`;

export const UPDATE_PROFILE = gql`
  mutation UpdateProfile($input: UpdateProfileInput!) {
    updateProfile(input: $input) {
      id
      email
      fullName
      createdAt
      phone
      timezone
      preferredCurrency
      pendingEmail
    }
  }
`;

export const CONFIRM_EMAIL_CHANGE = gql`
  mutation ConfirmEmailChange($token: String!) {
    confirmEmailChange(token: $token) {
      id
      email
      fullName
      createdAt
      phone
      timezone
      preferredCurrency
      pendingEmail
    }
  }
`;

export const CANCEL_PENDING_EMAIL_CHANGE = gql`
  mutation CancelPendingEmailChange {
    cancelPendingEmailChange {
      id
      email
      fullName
      createdAt
      phone
      timezone
      preferredCurrency
      pendingEmail
    }
  }
`;

export const RESEND_EMAIL_CHANGE_CONFIRMATION = gql`
  mutation ResendEmailChangeConfirmation {
    resendEmailChangeConfirmation {
      id
      email
      fullName
      createdAt
      phone
      timezone
      preferredCurrency
      pendingEmail
    }
  }
`;
