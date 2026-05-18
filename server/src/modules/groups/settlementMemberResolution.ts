import type { GroupMember } from './types.js';

/** Map payer/participant names to canonical group_members.name for settlement math. */
export const resolveSettlementMemberName = (
  rawName: string,
  members: GroupMember[],
): string | undefined => {
  const normalized = rawName.trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }

  const exact = members.find((member) => member.name.trim().toLowerCase() === normalized);
  if (exact) {
    return exact.name;
  }

  const firstToken = normalized.split(/\s+/)[0];
  const byFirstToken = members.filter((member) => {
    const memberKey = member.name.trim().toLowerCase();
    return memberKey === firstToken || memberKey.startsWith(`${firstToken} `);
  });
  if (byFirstToken.length === 1) {
    return byFirstToken[0].name;
  }

  const bySubstring = members.filter((member) => {
    const memberKey = member.name.trim().toLowerCase();
    return memberKey.includes(normalized) || normalized.includes(memberKey);
  });
  if (bySubstring.length === 1) {
    return bySubstring[0].name;
  }

  return undefined;
};
