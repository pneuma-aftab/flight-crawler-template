import type { CrawlingContext, HttpCrawlerOptions } from 'crawlee';
import { Log, ProxyConfiguration } from 'crawlee';
import { formatDate } from 'date-fns';

import type { CabinClass, SearchParams, UserData } from '@pneuma/shared-utils';
import { evomiProxyURLList, updateJobStatus } from '@pneuma/shared-utils';

import { env } from '@app/env';
import { logger } from '@pneuma/logger';
import axios from 'axios';


type RequestOptions = Parameters<CrawlingContext['sendRequest']>['0'];
export const accounts = [{ user: 'OD85773', pass: 'Local123' }]



export const fareClassConfig: Record<string, (typeof CabinClass)[number]> = {
  X: 'Economy',
  E: 'Premium Economy',
  I: 'Business',
  O: 'First',
};


const common_headers = {
  accept: 'application/json, text/plain, */*',
  'accept-language': 'en-GB,en;q=0.7',
  'cache-control': 'no-cache',
  'content-type': 'application/json',
  origin: 'https://www.thaiairways.com',
  referer: 'https://www.thaiairways.com/',
  'sec-fetch-dest': 'empty',
  'sec-fetch-mode': 'cors',
  'sec-fetch-site': 'same-origin',
  pragma: 'no-cache',
}

export const getMilesRequest = (
  searchParams: SearchParams,
  token: string
) => {
  return {
    method: 'POST',
    url: 'https://osci.thaiairways.com/airaward-flights/get-flight-info',
    headers: {
      ...common_headers,
      Authorization: token
    },
    body: JSON.stringify({
      "flightInfo": {
        "departure": searchParams.fromAirport,
        "arrival": searchParams.toAirport,
        "departureDate": formatDate(searchParams.fromDate, "ddMMyy")
      },
      "tripType": "O"
    }),
  } satisfies RequestOptions;
};

export const getStarAllianceRequest = (
  searchParams: SearchParams,
  token: string
) => {
  return {
    method: 'POST',
    url: 'https://osci.thaiairways.com/airaward-flights/star-get-flight-info',
    headers: {
      ...common_headers,
      Authorization: token,
      'sec-fetch-site': 'same-site',
      'hostname': 'https://www.thaiairways.com',
      'source': 'website',
      'access-control-expose-headers': 'accessToken',
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
    },
    body: JSON.stringify({
      "flightInfo": {
        "departure": searchParams.fromAirport,
        "arrival": searchParams.toAirport,
        "departureDate": formatDate(searchParams.fromDate, "ddMMyy")
      },
      "zoneDirection": "Zone3-Zone1",
      "tripType": "O"
    }),
  } satisfies RequestOptions;
};


export const getLoginRequest = (
  memberId: string,
  password: string,
) => {
  return {
    method: 'POST',
    url: 'https://osci.thaiairways.com/profile/login',
    headers: {
      ...common_headers
    },
    body: JSON.stringify({ memberId, password })
  } satisfies RequestOptions;
};

export const getOtpRequest = (otpRef: string, otpKey: string, accesstoken: string) => {
  console.log(otpRef, otpKey, accesstoken)
  return {
    method: 'POST',
    url: 'https://osci.thaiairways.com/profile/otp/submit',
    headers: {
      ...common_headers,
      accesstoken: accesstoken
    },
    body: JSON.stringify({ otpRef, otpKey })
  } satisfies RequestOptions;
}

// export const fareClassConfig: Record<string, (typeof CabinClass)[number]> = {
//   COACH: 'Economy',
//   PREMIUM_ECONOMY: 'Premium Economy',
//   BUSINESS: 'Business',
//   FIRST: 'First',
// };

const proxyConfiguration = new ProxyConfiguration({
  // proxyUrls: evomiProxyURLList,
  proxyUrls: [
    'http://252F00E22B5E-proxy-country_ANY-r_1m-s_LwHUF5D4P6:CLRrioW3@gw-us.scrapeless.io:8789'
  ]
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
  maxRequestRetries: 1,
  sessionPoolOptions: {
    maxPoolSize: env.SESSION_COUNT,
  },
  requestHandlerTimeoutSecs: 60,
  errorHandler: ({ request, session, proxyInfo }) => {
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