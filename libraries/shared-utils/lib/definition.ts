import type { formatSearchJobParams } from './job';

export interface ProviderResult {
  currency: string;
  flights: Flight[];
  duration: string;
  classes: {
    economy?: FareDetails[];
    premium_economy?: FareDetails[];
    business?: FareDetails[];
    first?: FareDetails[];
  };
}

export interface Flight {
  id: string;
  flightNo: string;
  airlineCode: string;
  departDateTime: string;
  arriveDateTime: string;
  origin: string;
  dest: string;
  aircraft: string;
}

interface FareDetails {
  miles: number;
  tax: number;
}

export type NonEmptyArray<T> = [T, ...T[]];

export function isNonEmpty<T>(arr: Array<T>): arr is NonEmptyArray<T> {
  return arr.length > 0;
}

export type SearchParams = ReturnType<typeof formatSearchJobParams>;

export interface UserData {
  jobId: string;
  providerId: string;
  frequentFlyerProgramId: string;
  searchParams: SearchParams;
  debug: boolean;
}

export interface JobDetails {
  providerId: string;
  frequentFlyerProgramId: string;
  jobId: string;
}
