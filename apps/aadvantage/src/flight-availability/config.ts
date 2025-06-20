import type { CrawlingContext, HttpCrawlerOptions } from 'crawlee';
import { Log, ProxyConfiguration } from 'crawlee';
import { format, formatDate } from 'date-fns';

import type { CabinClass, SearchParams, UserData } from '@pneuma/shared-utils';
import { evomiProxyURLList, updateJobStatus } from '@pneuma/shared-utils';

import { env } from '@app/env';
import { logger } from '@pneuma/logger';

type RequestOptions = Parameters<CrawlingContext['sendRequest']>['0'];

export const journeyTypes = {
  'Multi City': 'MultiCity',
  'One Way': 'OneWay',
  'Round Trip': 'RoundTrip',
} as const;

export const generateRequest = (
  searchParams: SearchParams,
  cid?: string,
  xsrfToken?: string,
  referer?: string
) => {
  return {
    method: 'POST',
    url: 'https://www.aa.com/booking/api/search/itinerary',
    headers: {
      accept: 'application/json, text/plain, */*',
      'accept-language': 'en-GB,en;q=0.7',
      'cache-control': 'no-cache',
      'content-type': 'application/json',
      origin: 'https://www.aa.com',
      referer: referer ?? 'https://www.aa.com',
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'same-origin',
      ...(cid && { 'x-cid': cid }),
      ...(xsrfToken && { 'x-xsrf-token': xsrfToken }),
      pragma: 'no-cache',
    },
    body: JSON.stringify({
      metadata: {
        selectedProducts: [],
        tripType: 'OneWay',
        udo: {},
      },
      passengers: [
        {
          type: 'adult',
          count: 1,
        },
      ],
      requestHeader: {
        clientId: 'AAcom',
      },
      slices: [
        {
          allCarriers: true,
          cabin: '',
          departureDate: format(searchParams.fromDate, 'yyyy-MM-dd'),
          // destination: searchParams.toCity.code,
          destination: searchParams.toAirport,
          destinationNearbyAirports: false,
          maxStops: null,
          // origin: searchParams.fromCity.code,
          origin: searchParams.fromAirport,
          originNearbyAirports: false,
        },
      ],
      tripOptions: {
        corporateBooking: false,
        fareType: 'Lowest',
        locale: 'en_US',
        pointOfSale: null,
        searchType: 'Award',
      },
      loyaltyInfo: null,
      version: '',
      queryParams: {
        sliceIndex: 0,
        sessionId: '',
        solutionSet: '',
        solutionId: '',
      },
    }),
  } satisfies RequestOptions;
};

export const fareClassConfig: Record<string, (typeof CabinClass)[number]> = {
  COACH: 'Economy',
  PREMIUM_ECONOMY: 'Premium Economy',
  BUSINESS: 'Business',
  FIRST: 'First',
};

const proxyConfiguration = new ProxyConfiguration({
  proxyUrls: evomiProxyURLList,
});

export const httpCrawlerConfig = {
  minConcurrency: 10,
  maxConcurrency: 50,
  proxyConfiguration,
  log: new Log({
    // logger: new CrawleePino({
    //   pino: pino(),
    // }),
    // maxDepth: 2,
  }),
  maxRequestRetries: 2,
  sessionPoolOptions: {
    maxPoolSize: env.SESSION_COUNT,
  },
  requestHandlerTimeoutSecs: 30,
  errorHandler: ({ request, session, proxyInfo }, error) => {
    const { jobId } = request.userData as UserData;
    logger.error('Failed to process the request.', {
      jobId,
      proxyInfo,
    });
    session?.markBad();
  },
  failedRequestHandler: async ({ request }) => {
    const { jobId } = request.userData as UserData;
    logger.error(`Failed to crawl.`, {
      jobId,
    });
    await updateJobStatus(jobId, 'Failed', logger);
  },
} satisfies HttpCrawlerOptions;

export const generatePageUrl = (searchParams: SearchParams) => {
  return `https://www.aa.com/booking/search?locale=en_US&pax=1&adult=1&type=OneWay&searchType=Award&cabin=&carriers=ALL&travelType=personal&slices=[{"orig":"${searchParams.fromAirport}","origNearby":false,"dest":"${searchParams.toAirport}","destNearby":false,"date":"${formatDate(searchParams.fromDate, 'yyyy-MM-dd')}"}]`;
};
