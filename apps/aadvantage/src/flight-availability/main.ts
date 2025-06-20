import type { Source } from 'crawlee';
import { Dataset, HttpCrawler } from 'crawlee';

import type {
  formatSearchJobParams,
  JobDetails,
  JobResult,
  UserData,
} from '@pneuma/shared-utils';
import { saveJobResults } from '@pneuma/shared-utils';

import { logger } from '@pneuma/logger';
import { fareClassConfig, generateRequest, httpCrawlerConfig } from './config';
import {
  airboundsResponseSchema,
  americanAirlinesResponseSchema,
} from './schema';

// const puppeteerCrawler = new PuppeteerCrawler({
//   ...puppeteerCrawlerConfig,
//   async requestHandler({ request, page, session, sendRequest, proxyInfo }) {
//     const { jobId, frequentFlyerProgramId, providerId, debug, searchParams } =
//       request.userData as UserData;

//     logger.info({ jobId }, `Processing ${request.url}...`);

//     const cidDetails = await useStorage<AAdvantageStorage>(
//       env.SERVICE_NAME,
//     ).getItem(proxyInfo?.port.toString() ?? "cid");

//     let jsonRes: unknown;

//     if (cidDetails) {
//       logger.info("Crawling using api...");
//       const { body: data } = await sendRequest(
//         generateRequest(
//           searchParams,
//           cidDetails.cid,
//           cidDetails.xsrf,
//           cidDetails.referer,
//         ),
//       );

//       jsonRes = airboundsResponseSchema.parse(data);
//     } else {
//       logger.info("Crawling using browser...");
//       const response = page.waitForResponse(
//         (value) =>
//           value.url().endsWith("api/search/itinerary") &&
//           value.request().method() !== "OPTIONS",
//       );

//       await page.goto(generatePageUrl(searchParams));

//       const res = await response;

//       if (res.status() !== 200) {
//         logger.error(
//           { statusCode: res.status() },
//           "Failed to fetch itinerary request",
//         );
//         throw new Error(
//           "Failed to fetch itinerary request with status: " + res.status(),
//         );
//       }

//       jsonRes = (await res.json()) as unknown;

//       await useStorage<AAdvantageStorage>(env.SERVICE_NAME).setItem(
//         proxyInfo?.port.toString() ?? "cid",
//         {
//           // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
//           cid: res.request().headers()["x-cid"]!,
//           // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
//           xsrf: res.request().headers()["x-xsrf-token"]!,
//           // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
//           referer: res.request().headers().referer!,
//         },
//       );
//     }

//     const result = await extractData(
//       jsonRes,
//       jobId,
//       frequentFlyerProgramId,
//       providerId,
//     );

//     if (debug) {
//       await Dataset.pushData({
//         data: result,
//         original: jsonRes,
//       });
//     } else {
//       await saveJobResults(result, jobId, logger);
//     }
//     session?.markGood();
//   },
// });

const httpCrawler = new HttpCrawler({
  ...httpCrawlerConfig,
  async requestHandler({ request, session, sendRequest }) {
    const { jobId, frequentFlyerProgramId, providerId, debug, searchParams } =
      request.userData as UserData;

    logger.info(`Processing Request...`, {
      jobId,
    });

    
    const { body: data } = await sendRequest(generateRequest(searchParams));

    const validatedAirboundsResponse = airboundsResponseSchema.parse(data);
    const result = await extractData(
      validatedAirboundsResponse,
      jobId,
      frequentFlyerProgramId,
      providerId
    );

    if (debug) {
      await Dataset.pushData({
        data: result,
        original: validatedAirboundsResponse,
      });
    } else {

      await saveJobResults(result, jobId, logger);
    }
    session?.markGood();
  },
});

export const getFlights = async (
  jobDetails: JobDetails,
  searchParams: ReturnType<typeof formatSearchJobParams>,
  debug?: boolean
) => {
  const request = {
    url: 'https://www.aa.com/booking/api/search/itinerary',
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
  } = await americanAirlinesResponseSchema.safeParseAsync(json);

  if (!success) {
    logger.error('Failed to parse the payload successfully', {
      cause: error.flatten(),
    });
    return {
      data: [],
      ...supportingInfo,
      success: false,
    };
  } else {
    return {
      data: validatedData.slices.map((itinerary) => ({
        origin: itinerary.origin.code,
        destination: itinerary.destination.code,
        segments: itinerary.segments.map((segment) => ({
          flightNumber: segment.flight.flightNumber,
          destination: segment.destination.code,
          origin: segment.origin.code,
          aircraftCode: segment.legs[0]?.aircraftCode ?? '',
          airlineCode: segment.flight.carrierCode,
          marketingAirlineCode: segment.flight.carrierCode,
          marketingFlightNumber: segment.flight.flightNumber,
          arrival: segment.arrivalDateTime,
          departure: segment.departureDateTime,
          noOfStops: 0,
          stops: [],
        })),
        fareDetails: itinerary.pricingDetail.map((fare) => ({
          seatsRemaining: fare.seatsRemaining !== 0 ? fare.seatsRemaining : 9,
          taxAmount: fare.perPassengerTaxesAndFees.amount,
          taxCurrency: fare.perPassengerTaxesAndFees.currency,
          milesAmount: fare.perPassengerAwardPoints,
          milesOnlyAmount: fare.perPassengerAwardPoints,
          fareClass: fareClassConfig[fare.productType] ?? 'Economy',
          brandName: fare.productType,
        })).filter(val => val.milesAmount > 0),
      })),
      ...supportingInfo,
      success: true,
    };
  }
};
