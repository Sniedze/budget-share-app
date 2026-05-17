export const PROFILE_CURRENCY_OPTIONS = ['DKK', 'EUR', 'USD', 'GBP', 'SEK', 'NOK', 'CHF', 'PLN'] as const;

const FALLBACK_TIMEZONES = [
  'UTC',
  'Europe/Copenhagen',
  'Europe/London',
  'Europe/Berlin',
  'Europe/Paris',
  'Europe/Stockholm',
  'Europe/Oslo',
  'America/New_York',
  'America/Chicago',
  'America/Los_Angeles',
  'Asia/Tokyo',
  'Asia/Singapore',
  'Australia/Sydney',
] as const;

export const getProfileTimezoneOptions = (): string[] => {
  const intlWithSupportedValues = Intl as typeof Intl & {
    supportedValuesOf?: (key: string) => string[];
  };
  if (typeof intlWithSupportedValues.supportedValuesOf === 'function') {
    return intlWithSupportedValues.supportedValuesOf('timeZone');
  }
  return [...FALLBACK_TIMEZONES];
};

export const getDefaultProfileTimezone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'UTC';
  }
};
