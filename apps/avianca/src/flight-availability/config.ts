import type { CrawlingContext, HttpCrawlerOptions } from 'crawlee';
import { Log, ProxyConfiguration } from 'crawlee';
import { format } from 'date-fns';

import type { CabinClass, SearchParams, UserData } from '@pneuma/shared-utils';
import { evomiProxyURLList, updateJobStatus } from '@pneuma/shared-utils';

import { env } from '@app/env';
import { logger } from '@pneuma/logger';

type RequestOptions = Parameters<CrawlingContext['sendRequest']>['0'];

export const cabinClassMapping: Record<string, number> = {
  'Economy': 2,
  'Premium Economy': 3,
  'Business': 1,
  'First': 4,
};

export const generateTokenRefreshRequest = (authorizationCode: string) => {
  const request = {
    method: 'POST',
    url: 'https://oauth.lifemiles.com/authentication/token/refresh',
    headers: {
      'accept': 'application/json',
      'accept-language': 'en-US,en;q=0.9',
      'content-type': 'application/json',
      'origin': 'https://www.lifemiles.com',
      'referer': 'https://www.lifemiles.com/',
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'same-site',
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
    },
    body: JSON.stringify({
      authorizationCode: authorizationCode,
      applicationID: "lm"
    }),
  } satisfies RequestOptions;
  logger.debug('Token refresh request:', { request });
  return request;
};

export const generateFlightSearchRequest = (
  searchParams: SearchParams,
  accessToken: string
) => {
  const request = {
    method: 'POST',
    url: 'https://api.lifemiles.com/svc/air-redemption-find-flight-private',
    headers: {
      'accept': 'application/json',
      'accept-language': 'en-US,en;q=0.9',
      'authorization': `Bearer ${accessToken}`,
      'content-type': 'application/json',
      'origin': 'https://www.lifemiles.com',
      'realm': 'lifemiles',
      'referer': 'https://www.lifemiles.com/',
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'same-site',
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
    },
    body: JSON.stringify({
      internationalization: {
        language: "en",
        country: "us",
        currency: "usd"
      },
      currencies: [
        {
          currency: "USD",
          decimal: 2,
          rateUsd: 1
        }
      ],
      passengers: 1,
      od: {
        orig: searchParams.fromAirport,
        dest: searchParams.toAirport,
        departingCity: searchParams.fromCity.name,
        arrivalCity: searchParams.toCity.name,
        depDate: format(searchParams.fromDate, 'yyyy-MM-dd'),
        depTime: ""
      },
      filter: false,
      codPromo: null,
      idCoti: "951144430946153141", // This might need to be dynamic
      officeId: "",
      ftNum: "",
      discounts: [],
      promotionCodes: [],
      context: "D",
      channel: "COM",
      ccabin: String(cabinClassMapping[searchParams.cabinClass] || 2),
      itinerary: "OW", // One Way for now
      odNum: 1,
      usdTaxValue: "0",
      getQuickSummary: false,
      ods: "",
      searchType: "SMR",
      searchTypePrioritized: "SSA",
      sch: {
        schHcfltrc: "5P9uEE6mRzWI99HyWw+bdLVac7N5WeG14I6EQWB0kas=",
        schLmidLtrc: "5P9uEE6mRzW1SxFy60BXagGA8RBVCkg2",
        schPIR: "5P9uEE6mRzV/3cUWLnwRMs/DUHY9LjvUiDSb8J201wc=",
        schPcFlt: "5P9uEE6mRzV7CQwbTfDHZQ==",
        schTr: "5P9uEE6mRzV7CQwbTfDHZQ=="
      },
      posCountry: "IN", // This might need to be dynamic based on user location
      odAp: [
        {
          org: searchParams.fromAirport,
          dest: searchParams.toAirport,
          cabin: cabinClassMapping[searchParams.cabinClass] || 2,
        }
      ],
      suscriptionPaymentStatus: ""
    }),
  } satisfies RequestOptions;
  logger.debug('Flight search request:', { request });
  return request;
};

const proxyConfiguration = new ProxyConfiguration({
  proxyUrls: evomiProxyURLList,
});

export const httpCrawlerConfig = {
  minConcurrency: 10,
  maxConcurrency: 50,
  proxyConfiguration,
  log: new Log({
    // Custom logging configuration can be added here
  }),
  maxRequestRetries: 2,
  sessionPoolOptions: {
    maxPoolSize: env.SESSION_COUNT,
  },
  requestHandlerTimeoutSecs: 60, // Increased timeout for token refresh + flight search
  errorHandler: ({ request, session, proxyInfo }, error) => {
    const { jobId } = request.userData as UserData;
    logger.error('Failed to process the request.', {
      jobId,
      proxyInfo,
      error: error.message,
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