import { createHash } from 'node:crypto';

const HIBP_RANGE_URL = 'https://api.pwnedpasswords.com/range';

export const isHibpPasswordCheckEnabled = (): boolean => {
  const raw = process.env.HIBP_PASSWORD_CHECK?.trim().toLowerCase();
  if (raw === '0' || raw === 'false' || raw === 'off') {
    return false;
  }
  return true;
};

/** k-anonymity range API; returns true if password appears in breach corpus. */
export const isPasswordBreached = async (password: string): Promise<boolean> => {
  const sha1 = createHash('sha1').update(password, 'utf8').digest('hex').toUpperCase();
  const prefix = sha1.slice(0, 5);
  const suffix = sha1.slice(5);

  const response = await fetch(`${HIBP_RANGE_URL}/${prefix}`, {
    headers: { 'Add-Padding': 'true' },
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) {
    return false;
  }

  const body = await response.text();
  return body.split('\n').some((line) => {
    const [hashSuffix] = line.split(':');
    return hashSuffix?.trim() === suffix;
  });
};
