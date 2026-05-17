/** Matches server `PERSONAL_CUSTOM_SETTLEMENT_GROUP_ID` (custom splits without a household). */
export const PERSONAL_CUSTOM_SETTLEMENT_GROUP_ID = 'personal-custom';

export const isPersonalCustomSettlement = (groupId: string): boolean =>
  groupId === PERSONAL_CUSTOM_SETTLEMENT_GROUP_ID;
