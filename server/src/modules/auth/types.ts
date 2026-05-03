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
};

export type AuthPayload = {
  accessToken: string;
  refreshToken: string;
  user: User;
};
