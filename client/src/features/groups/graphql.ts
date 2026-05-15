import { gql } from '@apollo/client';

export const GET_GROUPS = gql`
  query GetGroups {
    groups {
      id
      name
      description
      totalSpent
      yourShare
      expenseGroupLabels
      pendingInvitations {
        email
        name
        status
        emailDeliveryStatus
      }
      members {
        name
        email
        ratio
      }
      expenses {
        date
        expenseGroup
        category
        description
        paidBy
        total
        yourShare
        isPrivate
        currency
      }
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
  mutation CreateGroup($input: CreateGroupInput!) {
    createGroup(input: $input) {
      id
      name
      description
      totalSpent
      yourShare
      expenseGroupLabels
      pendingInvitations {
        email
        name
        status
        emailDeliveryStatus
      }
      members {
        name
        email
        ratio
      }
      expenses {
        date
        expenseGroup
        category
        description
        paidBy
        total
        yourShare
        isPrivate
        currency
      }
    }
  }
`;

export const UPDATE_GROUP = gql`
  mutation UpdateGroup($input: UpdateGroupInput!) {
    updateGroup(input: $input) {
      id
      name
      description
      totalSpent
      yourShare
      expenseGroupLabels
      pendingInvitations {
        email
        name
        status
        emailDeliveryStatus
      }
      members {
        name
        email
        ratio
      }
      expenses {
        date
        expenseGroup
        category
        description
        paidBy
        total
        yourShare
        isPrivate
        currency
      }
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

export const DECLINE_EXPENSE_GROUP_PARTICIPATION = gql`
  mutation DeclineExpenseGroupParticipation($groupId: ID!, $category: String!) {
    declineExpenseGroupParticipation(groupId: $groupId, category: $category)
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
