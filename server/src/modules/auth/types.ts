export type User = {
  id: string;
  email: string;
  fullName: string;
  createdAt: string;
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

/** Tokens are also set as httpOnly cookies; fields exist for testing/tools only. */
export type AuthPayload = {
  accessToken: string;
  refreshToken: string;
  user: User;
};
