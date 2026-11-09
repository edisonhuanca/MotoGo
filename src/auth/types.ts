export type AccountRole = 'pasajero' | 'conductor';
export type SocialProvider = 'google' | 'facebook';

export type Registration = {
  name: string;
  email: string;
  password: string;
  role: AccountRole;
};
