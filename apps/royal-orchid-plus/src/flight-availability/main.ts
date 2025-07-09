import type { Source, ResponseLike, HttpResponse } from 'crawlee';
import { Dataset, HttpCrawler, } from 'crawlee';

import type {
  formatSearchJobParams,
  JobDetails,
  JobResult,
  SearchParams,
  UserData,
} from '@pneuma/shared-utils';
import { saveJobResults } from '@pneuma/shared-utils';

import { logger } from '@pneuma/logger';
import { accounts, fareClassConfig, getLoginRequest, getMilesRequest, getStarAllianceRequest, getOtpRequest, httpCrawlerConfig } from './config';
import {
  thairespSchema,
  starAllianceRespSchema,
} from './schema';
import { createStorage, type Storage } from 'unstorage';
// import sampleSize from 'lodash.samplesize';
import { waitFor } from "poll-until-promise"
import { latestOTPMsg } from './otp-server';
import { writeFileSync } from 'fs';
import { toDate, format, formatDate } from 'date-fns';

const storage = createStorage<any>()
export const poolFor = async () => !await storage.hasItem('lock')

const httpCrawler = new HttpCrawler({
  ...httpCrawlerConfig,
  async requestHandler({ request, session, sendRequest }) {
    const { searchParams, debug, ...rest } = request.userData as UserData;

    logger.info(`Processing Request...`, { jobId: rest.jobId });

    const sendMilesRequest = async () => {
      const token = await storage.get("token");
      
      // Call both APIs
      const [regularResponse, starAllianceResponse] = await Promise.allSettled([
        sendRequest(getMilesRequest(searchParams, token)),
        sendRequest(getStarAllianceRequest(searchParams, token))
      ]);

      // Save raw responses for debugging
      if (regularResponse.status === 'fulfilled') {
        require('fs').writeFileSync('./miles_response.json', regularResponse.value.body);
      } else if (regularResponse.status === 'rejected') {
        require('fs').writeFileSync('./miles_response.json', JSON.stringify({ error: String(regularResponse.reason) }, null, 2));
      }
      if (starAllianceResponse.status === 'fulfilled') {
        require('fs').writeFileSync('./star_alliance_response.json', starAllianceResponse.value.body);
      } else if (starAllianceResponse.status === 'rejected') {
        require('fs').writeFileSync('./star_alliance_response.json', JSON.stringify({ error: String(starAllianceResponse.reason) }, null, 2));
      }

      // Check if at least one request succeeded
      if (regularResponse.status === 'rejected' && starAllianceResponse.status === 'rejected') {
        throw new Error('Both regular and Star Alliance requests failed');
      }

      const results: any[] = [];
      const originalResponses: any[] = [];

      // Process regular flights
      if (regularResponse.status === 'fulfilled' && regularResponse.value.statusCode === 200) {
        const regularData = JSON.parse(regularResponse.value.body);
        const regularResult = await extractData(regularData, ...Object.values(rest) as [any, any, any]);
        results.push(...regularResult.data);
        originalResponses.push({ type: 'regular', data: regularData });
        // Save converted result for miles
        require('fs').writeFileSync('./miles_converted.json', JSON.stringify(regularResult, null, 2));
      }

      // Process Star Alliance flights
      if (starAllianceResponse.status === 'fulfilled' && starAllianceResponse.value.statusCode === 200) {
        const starData = JSON.parse(starAllianceResponse.value.body);
        const starResult = await extractStarAllianceData(starData, ...Object.values(rest) as [any, any, any], searchParams);
        results.push(...starResult.data);
        originalResponses.push({ type: 'star_alliance', data: starData });
        // Save converted result for star alliance
        require('fs').writeFileSync('./star_alliance_converted.json', JSON.stringify(starResult, null, 2));
      }

      // Create combined result
      const combinedResult: JobResult = {
        data: results,
        frequentFlyerProgramId: rest.frequentFlyerProgramId,
        isUTC: false,
        jobId: rest.jobId,
        success: true,
      };

      // Save or debug
      if (debug) {
        await Dataset.pushData({
          data: combinedResult,
          original: originalResponses,
        });
      } else {
        await saveJobResults(combinedResult, rest.jobId, logger);
      }

      // Write debug file
      writeFileSync("./data.json", JSON.stringify(combinedResult, null, 2));

      return true;
    }

    try {
      if (await storage.hasItem('lock')) {
        await waitFor(poolFor, { interval: 100, timeout: 7000, stopOnFailure: true });
      }

      let response: any | undefined;
      if (await storage.hasItem('token')) {
        try {
          await sendMilesRequest();
          return;
        } catch (error) {
          logger.warn('Failed to send miles request with existing token', { error });
          response = { statusCode: 403 }; // Assume token expired
        }
      }

      if (response && response.statusCode !== 403) {
        throw new Error("Unknown api error occurred");
      }

      // Lock until auth complete
      await storage.set('lock', true);

      const account = accounts[Math.floor(Math.random() * accounts.length)]!;
      const logResp = await sendRequest(getLoginRequest(account.user, account.pass));
      
      // Wait for message
      await new Promise(resolve => setTimeout(resolve, 4000));
      const otp = await latestOTPMsg();

      if (!otp) throw new Error("OTP not received");

      const { headers: otpHeader, body } = await sendRequest(
        getOtpRequest(
          JSON.parse(logResp.body).otpRefKey,
          otp,
          <string>logResp.headers['accesstoken']!
        )
      );
      
      logger.info("OTP response body", { body });
      await storage.set('token', otpHeader['authorization']);

      await sendMilesRequest();
    } catch (error) {
      logger.error('Request handler error', { error, jobId: rest.jobId });
      throw error;
    } finally {
      await storage.removeItem('lock');
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

const convertToISODate = (dateStr: string, timeStr: string): Date => {
  // dateStr format: DDMMYY, timeStr format: HHMM
  const day = dateStr.substring(0, 2);
  const month = dateStr.substring(2, 4);
  const year = `20${dateStr.substring(4, 6)}`; // Assuming 20xx year
  const hour = timeStr.substring(0, 2);
  const minute = timeStr.substring(2, 4);
  
  return new Date(`${year}-${month}-${day}T${hour}:${minute}:00.000Z`);
};

const extractData = async (
  json: unknown,
  jobId: string,
  frequentFlyerProgramId: string,
  providerId: string
): Promise<JobResult> => {
  logger.debug('Extracting data from response...');

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
  } = await thairespSchema.safeParseAsync(json);

  if (!success) {
    logger.error('Failed to parse the payload successfully', {
      cause: error.flatten(),
    });
    return {
      data: [],
      ...supportingInfo,
      success: false,
    };
  }

  return {
    data: validatedData.flightList.map((itinerary) => {
      const arrival = itinerary.arrivalDate.match(/\d{2}/g)!;
      const departure = itinerary.departureDate.match(/\d{2}/g)!;
      
      return {
        origin: itinerary.departure,
        destination: itinerary.arrival,
        segments: [{
          aircraftCode: itinerary.aircraftType,
          airlineCode: itinerary.mc,
          arrival: new Date(`${arrival[1]}-${arrival[0]}-${arrival[2]}`),
          departure: new Date(`${departure[1]}-${departure[0]}-${departure[2]}`),
          marketingAirlineCode: itinerary.mc,
          origin: itinerary.departure,
          destination: itinerary.arrival,
          flightNumber: itinerary.flightNum,
          marketingFlightNumber: itinerary.flightNum,
          noOfStops: 0,
          stops: []
        }],
        fareDetails: itinerary.classList
          .filter((fare) => Number(fare.availability) > 0)
          .map((fare) => ({
            seatsRemaining: Number(fare.availability),
            taxAmount: 0,
            taxCurrency: 'USD',
            milesAmount: Number(fare.miles),
            milesOnlyAmount: Number(fare.miles),
            fareClass: fareClassConfig[fare.bookingClass] ?? 'Economy',
            brandName: fare.bookingClass,
          })),
      };
    }),
    ...supportingInfo,
    success: true,
  };
};

const extractStarAllianceData = async (
  json: unknown,
  jobId: string,
  frequentFlyerProgramId: string,
  providerId: string,
  searchParams: SearchParams
): Promise<JobResult> => {
  logger.debug('Extracting Star Alliance data from response...');

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
  } = await starAllianceRespSchema.safeParseAsync(json);

  if (!success) {
    logger.error('Failed to parse the Star Alliance payload successfully', {
      cause: error.flatten(),
    });
    return {
      data: [],
      ...supportingInfo,
      success: false,
    };
  }

  return {
    data: validatedData.flightList.map((itinerary) => {
      // Create segments from flights array
      const segments = itinerary.flights.map((flight) => ({
        aircraftCode: flight.aircraftType,
        airlineCode: flight.mc,
        arrival: convertToISODate(flight.arrivalDate, flight.arrivalTime),
        departure: convertToISODate(flight.departureDate, flight.departureTime),
        marketingAirlineCode: flight.mc,
        origin: flight.departure,
        destination: flight.arrival,
        flightNumber: flight.flightNum,
        marketingFlightNumber: flight.flightNum,
        noOfStops: 0,
        stops: []
      }));

      // Create fare details from classList (only for available seats > 0)
      const fareDetails = itinerary.classList
        .filter((fare) => Number(fare.availability) > 0)
        .map((fare) => ({
          seatsRemaining: Number(fare.availability),
          taxAmount: 0,
          taxCurrency: 'USD',
          milesAmount: Number(fare.miles),
          milesOnlyAmount: Number(fare.miles),
          fareClass: fareClassConfig[fare.bookingClass] ?? 'Economy',
          brandName: fare.bookingClass,
        }));

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