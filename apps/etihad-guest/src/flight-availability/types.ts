import type { UserData } from '@pneuma/shared-utils';

export interface TokenResponse {
  access_token: string;
  guest_office_id: string;
}

export interface JSONResponse {
  data: { access_token: string };
  errors?: Array<{ message: string }>;
}

export interface EtihadStorage {
  token: string;
  xdt: string;
  guest_office_id: string;
}

export interface EtihadToken {
  accessToken: string;
  expiresIn: Date;
}

export interface EtihadUserData extends UserData {
  xdToken: string;
}
