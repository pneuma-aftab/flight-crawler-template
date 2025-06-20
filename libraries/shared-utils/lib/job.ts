import type { Logger } from '@pneuma/logger';
import { ofetch } from 'ofetch';
import { z } from 'zod';

import { env } from './env';
import type {
  JobStatus,
  fareOptionSchema,
  flightSegmentSchema,
  itinerarySchema,
  jobResultSchema,
} from './validators/job';
import type { searchDetailsSchema } from './validators/search';

export const formatSearchJobParams = (
  searchParams: z.infer<typeof searchDetailsSchema>
) => {
  return {
    id: searchParams.id,
    journeyType: searchParams.journeyType,
    cabinClass: searchParams.cabinClass,
    fromDate: searchParams.fromDate,
    toDate: searchParams.toDate,
    fromDestinationType: searchParams.fromDestinationType,
    toDestinationType: searchParams.toDestinationType,
    fromAirport: searchParams.fromAirport.iataCode,
    toAirport: searchParams.toAirport.iataCode,
    fromCity: {
      name: searchParams.fromCity.name,
      code: searchParams.fromCity.code,
      countryCode: searchParams.fromCity.country.isoCode2,
      countryName: searchParams.fromCity.country.name,
    },
    toCity: {
      name: searchParams.toCity.name,
      code: searchParams.toCity.code,
      countryCode: searchParams.toCity.country.isoCode2,
      countryName: searchParams.toCity.country.name,
    },
  };
};

export const updateJobStatus = async (
  jobId: string,
  status: (typeof JobStatus)[number],
  logger: Logger
) => {
  logger.info('Updating job status...', { jobId, status });
  try {
    return await ofetch<UpdateJobStatusResponse>('/job/update-status', {
      baseURL: env.REWARD_SEAT_TRACKER_ENDPOINT,
      body: {
        jobId: jobId,
        status: status,
      },
      method: 'POST',
    });
  } catch (error) {
    logger.info('Failed to update job status.', { error });
  }
};

export const saveJobResults = async (
  data: JobResult,
  jobId: string,
  logger: Logger
) => {
  logger.info('Saving job details...', { jobId });
  return await ofetch<UpdateJobStatusResponse>('/job/save-results', {
    baseURL: env.REWARD_SEAT_TRACKER_ENDPOINT,
    body: data,
    method: 'POST',
  }).catch(({ data: errorData }: { data: unknown }) =>
    logger.error('Error Saving Job Results!', { error: errorData })
  );
};

export interface UpdateJobStatusResponse {
  data: {
    id: string;
    message: string;
  };
  error: unknown;
}

export type JobResult = z.infer<typeof jobResultSchema>;
export type Itinerary = z.infer<typeof itinerarySchema>;
export type FareOption = z.infer<typeof fareOptionSchema>;
export type FlightSegment = z.infer<typeof flightSegmentSchema>;
