import type { ChangePasswordMutation, LoginMutation, MeQuery, RegisterMutation } from '../../graphql/generated/graphql';

export type AuthUser = NonNullable<MeQuery['me']>;

export type AuthMutationData = {
  login?: LoginMutation['login'];
  register?: RegisterMutation['register'];
  changePassword?: ChangePasswordMutation['changePassword'];
};
