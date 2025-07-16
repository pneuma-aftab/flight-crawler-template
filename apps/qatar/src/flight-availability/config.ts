import type { CrawlingContext, HttpCrawlerOptions } from 'crawlee';
import { Log, ProxyConfiguration } from 'crawlee';
import { formatDate } from 'date-fns';

import type { CabinClass, SearchParams, UserData } from '@pneuma/shared-utils';
import { evomiProxyURLList, updateJobStatus } from '@pneuma/shared-utils';

import { env } from '@app/env';
import { logger } from '@pneuma/logger';

type RequestOptions = Parameters<CrawlingContext['sendRequest']>['0'];

export const fareClassConfig: Record<string, (typeof CabinClass)[number]> = {
  ECONOMY: 'Economy',
  BUSINESS: 'Business',
  FIRST: 'First',
};

export const getAwardSearchRequest = (
  searchParams: SearchParams
): RequestOptions => {
  return {
    method: 'POST',
    url: 'https://www.qatarairways.com/dapi/public/bff/web/flight-search/award-flight-offers',
    headers: {
      'accept': 'application/json, text/plain, */*',
      'accept-language': 'en',
      'authorization': `Bearer ${env.BEARER_TOKEN}`,
      'content-type': 'application/json',
      'origin': 'https://www.qatarairways.com',
      'priority': 'u=1, i',
      'qr-lang': 'en',
      'referer': 'https://www.qatarairways.com/app/booking/redemption?widget=QR&searchType=F&addTaxToFare=Y&minPurTime=0&selLang=en&tripType=O&fromStation=BOM&toStation=DOH&bookingClass=E&adults=1&children=0&infants=0&ofw=0&teenager=0&flexibleDate=off&qmilesFlow=true&allowRedemption=Y&paymentMode=qmiles&redirectedFromRevenue=true',
      'request-id': '|b9884718bb5f4cb1adbb974d9f8f2c6e.74611eec8c904382',
      'sec-ch-ua': '"Not)A;Brand";v="8", "Chromium";v="138", "Google Chrome";v="138"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"',
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'same-origin',
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
      'x-assigneddeviceid': 'JqXUVgV8dCaBJY13SyFVVoa2QGmFzRoE',
    },
    body: JSON.stringify({
      channel: "WEB_DESKTOP",
      itineraries: [
        {
          origin: searchParams.fromAirport,
          destination: searchParams.toAirport,
          departureDate: formatDate(searchParams.fromDate, "yyyy-MM-dd"),
          isRequested: true
        }
      ],
      cabinClass: "ECONOMY",
      passengers: [
        {
          type: "ADT",
          count: 1
        }
      ],
      includeMixedCabin: "Yes",
      multiSegmentOffers: true
    }),
  } satisfies RequestOptions;
};

const proxyConfiguration = new ProxyConfiguration({
  proxyUrls: evomiProxyURLList,
});

export const httpCrawlerConfig = {
  minConcurrency: 10,
  maxConcurrency: 50,
  proxyConfiguration,
  log: new Log(),
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