import type { Source, ResponseLike, HttpResponse } from 'crawlee';
import { Dataset, HttpCrawler } from 'crawlee';

import type {
  formatSearchJobParams,
  JobDetails,
  JobResult,
  SearchParams,
  UserData,
} from '@pneuma/shared-utils';
import { saveJobResults } from '@pneuma/shared-utils';

import { logger } from '@pneuma/logger';
import { fareClassConfig, getFlightSearchRequest, getCookiesRequest, httpCrawlerConfig } from './config';
import {
  virginAtlanticResponseSchema,
  cookiesResponseSchema,
} from './schema';
import { writeFileSync } from 'fs';

// Utility function to extract flight number without airline prefix
const extractFlightNumber = (flightNumber: string): string => {
  const match = flightNumber.match(/[A-Z]{1,3}(\d+)/);
  return match?.[1] ?? flightNumber;
};

const httpCrawler = new HttpCrawler({
  ...httpCrawlerConfig,
  async requestHandler({ request, session, sendRequest }) {
    const { searchParams, debug, ...rest } = request.userData as UserData;

    logger.info(`Processing Request...`, { jobId: rest.jobId });

    try {
      // Step 1: Get cookies from jsonblob
      logger.info('Fetching cookies from jsonblob...');
      const cookiesResponse = await sendRequest(getCookiesRequest());
      
      const {
        data: cookiesData,
        success: cookiesSuccess,
        error: cookiesError,
      } = await cookiesResponseSchema.safeParseAsync(JSON.parse(cookiesResponse.body));

      if (!cookiesSuccess) {
        logger.error('Failed to parse cookies response', {
          cause: cookiesError.flatten(),
          jobId: rest.jobId,
        });
        throw new Error('Failed to get cookies');
      }

      // Step 2: Make flight search request
      logger.info('Making flight search request...');
      const flightResponse = await sendRequest(getFlightSearchRequest(searchParams, cookiesData.cookies));

      if (flightResponse.statusCode !== 200) {
        throw new Error(`Flight search request failed with status ${flightResponse.statusCode}`);
      }

      // Step 3: Parse and extract data
      const flightData = JSON.parse(flightResponse.body);
      const result = await extractData(flightData, ...Object.values(rest) as [any, any, any], searchParams);

      // Step 4: Save or debug
      if (debug) {
        await Dataset.pushData({
          data: result,
          original: flightData,
        });
      } else {
        await saveJobResults(result, rest.jobId, logger);
      }

      // Write debug file
      // writeFileSync("./data.json", JSON.stringify(result, null, 2));

    } catch (error) {
      logger.error('Request handler error', { error, jobId: rest.jobId });
      throw error;
    }
  },
});

export const getFlights = async (
  jobDetails: JobDetails,
  searchParams: ReturnType<typeof formatSearchJobParams>,
  debug?: boolean
) => {
  const request = {
    url: 'https://example.com',
    userData: {
      providerId: jobDetails.providerId,
      jobId: jobDetails.jobId,
      frequentFlyerProgramId: jobDetails.frequentFlyerProgramId,
      searchParams,
      debug,
    },
    uniqueKey: jobDetails.jobId,
    skipNavigation: true,
  } satisfies Source;
  
  logger.debug('Queueing job...', { jobId: jobDetails.jobId });
  
  if (httpCrawler.running) {
    await httpCrawler.addRequests([request]);
  } else {
    void httpCrawler.run([request]);
  }
};

const extractData = async (
  json: unknown,
  jobId: string,
  frequentFlyerProgramId: string,
  providerId: string,
  searchParams: SearchParams
): Promise<JobResult> => {
  logger.debug('Extracting data from Virgin Atlantic response...');

  const supportingInfo = {
    frequentFlyerProgramId: frequentFlyerProgramId,
    isUTC: true,
    jobId: jobId,
  };

  const {
    data: validatedData,
    success,
    error,
  } = await virginAtlanticResponseSchema.safeParseAsync(json);

  if (!success) {
    logger.error('Failed to parse the Virgin Atlantic payload successfully', {
      cause: error.flatten(),
    });
    return {
      data: [],
      ...supportingInfo,
      success: false,
    };
  }

  const flightsAndFares = validatedData.data.searchOffers.result.slice.flightsAndFares;
  
  return {
    data: flightsAndFares.map((flightAndFare) => {
      // Extract segments from flight
      const segments = flightAndFare.flight.segments.map((segment) => ({
        airlineCode: segment.airline.code,
        arrival: new Date(segment.arrival),
        departure: new Date(segment.departure),
        origin: segment.origin.code,
        destination: segment.destination.code,
        flightNumber: extractFlightNumber(segment.flightNumber),
        aircraftCode: segment.metal[0]?.family || 'Unknown',
        noOfStops: 0, // Hardcoded as per requirements
        stops: [], // Hardcoded as per requirements
        marketingAirlineCode: segment.airline.code,
        marketingFlightNumber: extractFlightNumber(segment.flightNumber),
      }));

      // Extract fare details, filtering out sold out fares
      const fareDetails = flightAndFare.fares
        .filter((fare) => fare.availability !== 'SOLD_OUT' && fare.price !== null)
        .map((fare) => {
          const fareConfig = fareClassConfig[fare.fareFamilyType];
          
          return {
            milesAmount: Number(fare.price!.awardPoints),
            taxAmount: fare.price!.tax,
            milesOnlyAmount: Number(fare.price!.awardPoints),
            seatsRemaining: 10, // Hardcoded as per requirements
            brandName: fareConfig?.brandName || 'unknown',
            fareClass: fareConfig?.fareClass || 'Economy',
            taxCurrency: fare.price!.currency,
          };
        });

      return {
        origin: searchParams.fromAirport,
        destination: searchParams.toAirport,
        segments,
        fareDetails,
      };
    }),
    ...supportingInfo,
    success: true,
  };
};