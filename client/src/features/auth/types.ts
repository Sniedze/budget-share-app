export type AuthUser = {
  id: string;
  email: string;
  fullName: string;
  createdAt: string;
};

export type AuthPayload = {
  user: AuthUser;
};
