import { gql } from '@apollo/client';
import { GROUP_FIELDS } from './groupFields';

export { GROUP_FIELDS };

export const GET_GROUPS = gql`
  ${GROUP_FIELDS}
  query GetGroups {
    groups {
      ...GroupFields
    }
  }
`;

export const GET_GROUP_SPLIT_TEMPLATES = gql`
  query GetGroupSplitTemplates($groupId: ID!) {
    groupSplitTemplates(groupId: $groupId) {
      id
      groupId
      category
      templateName
      splitDetails {
        participant
        ratio
      }
    }
  }
`;

export const CREATE_GROUP = gql`
  ${GROUP_FIELDS}
  mutation CreateGroup($input: CreateGroupInput!) {
    createGroup(input: $input) {
      ...GroupFields
    }
  }
`;

export const UPDATE_GROUP = gql`
  ${GROUP_FIELDS}
  mutation UpdateGroup($input: UpdateGroupInput!) {
    updateGroup(input: $input) {
      ...GroupFields
    }
  }
`;

export const GET_MY_INVITATIONS = gql`
  query GetMyInvitations {
    myInvitations {
      id
      groupId
      groupName
      email
      status
      emailDeliveryStatus
      invitedAt
      acceptedAt
    }
  }
`;

export const ACCEPT_GROUP_INVITATION = gql`
  mutation AcceptGroupInvitation($id: ID!) {
    acceptGroupInvitation(id: $id) {
      id
      status
    }
  }
`;

export const DECLINE_GROUP_INVITATION = gql`
  mutation DeclineGroupInvitation($id: ID!) {
    declineGroupInvitation(id: $id) {
      id
      status
    }
  }
`;

export const RESEND_GROUP_INVITATION = gql`
  mutation ResendGroupInvitation($groupId: ID!, $email: String!) {
    resendGroupInvitation(groupId: $groupId, email: $email) {
      email
      name
      status
      emailDeliveryStatus
    }
  }
`;

export const DECLINE_EXPENSE_GROUP_PARTICIPATION = gql`
  mutation DeclineExpenseGroupParticipation($groupId: ID!, $category: String!) {
    declineExpenseGroupParticipation(groupId: $groupId, category: $category)
  }
`;

export const DELETE_EXPENSE_GROUP = gql`
  mutation DeleteExpenseGroup($groupId: ID!, $category: String!) {
    deleteExpenseGroup(groupId: $groupId, category: $category)
  }
`;

export const UPSERT_GROUP_SPLIT_TEMPLATE = gql`
  mutation UpsertGroupSplitTemplate($input: UpsertSplitTemplateInput!) {
    upsertGroupSplitTemplate(input: $input) {
      id
      groupId
      category
      templateName
      splitDetails {
        participant
        ratio
      }
    }
  }
`;
