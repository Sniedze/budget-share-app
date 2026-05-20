import { gql } from '@apollo/client';

export const USER_WORKSPACE_SETTINGS_FIELDS = gql`
  fragment UserWorkspaceSettingsFields on UserWorkspaceSettings {
    budgetAssumptions {
      startingBalance
      monthlyIncomeEstimate
    }
    categoryBudgetDefaults {
      category
      amount
    }
    monthCategoryBudgets {
      category
      amount
    }
    budgetCustomCategories
    budgetCategoryMappings {
      expenseCategory
      budgetCategory
    }
    importMerchantRules {
      id
      flow
      matchType
      pattern
      category
      split
      groupId
      expenseGroup
      updatedAt
    }
    importColumnMappings {
      signature
      dateIndex
      merchantIndex
      amountIndex
      currencyIndex
      descriptionIndex
      dateHeaderKey
      merchantHeaderKey
      amountHeaderKey
      currencyHeaderKey
      descriptionHeaderKey
    }
    importCustomCategories
  }
`;

export const GET_USER_WORKSPACE_SETTINGS = gql`
  ${USER_WORKSPACE_SETTINGS_FIELDS}
  query GetUserWorkspaceSettings($yearMonth: String!) {
    userWorkspaceSettings(yearMonth: $yearMonth) {
      ...UserWorkspaceSettingsFields
    }
  }
`;

export const SAVE_USER_WORKSPACE_SETTINGS = gql`
  ${USER_WORKSPACE_SETTINGS_FIELDS}
  mutation SaveUserWorkspaceSettings($input: SaveUserWorkspaceSettingsInput!) {
    saveUserWorkspaceSettings(input: $input) {
      ...UserWorkspaceSettingsFields
    }
  }
`;
