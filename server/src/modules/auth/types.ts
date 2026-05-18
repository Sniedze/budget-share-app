export type User = {
  id: string;
  email: string;
  fullName: string;
  createdAt: string;
  phone: string | null;
  timezone: string;
  preferredCurrency: string;
  pendingEmail: string | null;
};

export type RegisterInput = {
  email: string;
  password: string;
  fullName: string;
};

export type LoginInput = {
  email: string;
  password: string;
  rememberMe?: boolean | null;
};

export type ChangePasswordInput = {
  currentPassword: string;
  newPassword: string;
};

export type DeleteAccountInput = {
  password: string;
  confirmation: string;
};

export type UserDataExport = {
  exportedAt: string;
  format: string;
  data: string;
};

export type UpdateProfileInput = {
  fullName: string;
  email: string;
  phone?: string | null;
  timezone: string;
  preferredCurrency: string;
};

/** Tokens are also set as httpOnly cookies; fields exist for testing/tools only. */
export type AuthPayload = {
  accessToken: string;
  refreshToken: string;
  user: User;
};
