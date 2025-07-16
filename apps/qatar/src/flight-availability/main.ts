import type { Source } from 'crawlee';
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
import { fareClassConfig, getAwardSearchRequest, httpCrawlerConfig } from './config';
import { qatarAirwaysResponseSchema } from './schema';
import { writeFileSync } from 'fs';

const httpCrawler = new HttpCrawler({
  ...httpCrawlerConfig,
  async requestHandler({ request, sendRequest }) {
    const { searchParams, debug, ...rest } = request.userData as UserData;

    logger.info(`Processing Request...`, { jobId: rest.jobId });

    try {
      const response = await sendRequest(getAwardSearchRequest(searchParams));

      if (debug) {
        writeFileSync('./qatar_response.json', response.body);
      }

      if (response.statusCode !== 200) {
        throw new Error(`API request failed with status: ${response.statusCode}`);
      }

      const responseData = JSON.parse(response.body);
      const result = await extractData(responseData, ...Object.values(rest) as [string, string, string], searchParams);

      if (debug) {
        await Dataset.pushData({
          data: result,
          original: responseData,
        });
      } else {
        await saveJobResults(result, rest.jobId, logger);
      }

      if (debug) {
        writeFileSync("./qatar_converted.json", JSON.stringify(result, null, 2));
      }

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

const extractFlightNumber = (flightNumber: string): string => {
  return flightNumber.replace(/[^0-9]/g, '');
};

const extractData = async (
  json: unknown,
  jobId: string,
  frequentFlyerProgramId: string,
  providerId: string,
  searchParams: SearchParams
): Promise<JobResult> => {
  logger.debug('Extracting data from Qatar Airways response...');

  const supportingInfo = {
    frequentFlyerProgramId: frequentFlyerProgramId,
    providerId: providerId,
    isUTC: false,
    jobId: jobId,
  };

  const {
    data: validatedData,
    success,
    error,
  } = await qatarAirwaysResponseSchema.safeParseAsync(json);

  // TEMPORARY DEBUG LOG
  // logger.error('Qatar Airways schema parse result', { result: { data: validatedData, success, error } });

  if (!success) {
    logger.error('Failed to parse the Qatar Airways payload successfully', {
      cause: error.flatten(),
    });
    return {
      data: [],
      ...supportingInfo,
      success: false,
    };
  }

  return {
    data: validatedData.flightOffers.map((offer) => ({
      origin: offer.origin.iataCode,
      destination: offer.destination.iataCode,
      segments: offer.segments.map((segment) => ({
        airlineCode: segment.operatorLogo.operatorCode,
        arrival: new Date(segment.arrival.dateTime),
        departure: new Date(segment.departure.dateTime),
        origin: segment.departure.origin.iataCode,
        destination: segment.arrival.destination.iataCode,
        flightNumber: extractFlightNumber(segment.flightNumber),
        aircraftCode: segment.vehicle.code,
        noOfStops: 0,
        stops: [],
        marketingAirlineCode: segment.operatorLogo.operatorCode,
        marketingFlightNumber: extractFlightNumber(segment.flightNumber)
      })),
      fareDetails: offer.fareOffers.map((fareOffer) => {
        const cabinType = fareOffer.cabinType || fareOffer.cabinOfferType || 'Economy';
        if (!fareOffer.cabinType && !fareOffer.cabinOfferType) {
          logger.warn('Missing both cabinType and cabinOfferType in fareOffer', { fareOffer });
        }
        return {
          milesAmount: fareOffer.price.base,
          taxAmount: 0,
          milesOnlyAmount: fareOffer.price.base,
          seatsRemaining: fareOffer.availableSeats,
          brandName: cabinType,
          fareClass: fareClassConfig[cabinType] ?? 'Economy',
          taxCurrency: 'USD'
        };
      }),
    })),
    ...supportingInfo,
    success: true,
  };
};