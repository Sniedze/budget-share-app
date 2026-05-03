export type AuthUser = {
  id: string;
  email: string;
  fullName: string;
  createdAt: string;
};

export type AuthPayload = {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
};

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};
