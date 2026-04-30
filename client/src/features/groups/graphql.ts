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
        expenseGroup
        category
        description
        paidBy
        total
        yourShare
        isPrivate
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
      }
    }
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
