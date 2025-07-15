import type { CrawlingContext, HttpCrawlerOptions } from 'crawlee';
import { Log, ProxyConfiguration } from 'crawlee';
import { formatDate } from 'date-fns';

import type { CabinClass, SearchParams, UserData } from '@pneuma/shared-utils';
import { evomiProxyURLList, updateJobStatus } from '@pneuma/shared-utils';

import { env } from '@app/env';
import { logger } from '@pneuma/logger';
import axios from 'axios';

type RequestOptions = Parameters<CrawlingContext['sendRequest']>['0'];

export const fareClassConfig: Record<string, { brandName: string; fareClass: (typeof CabinClass)[number] }> = {
  'AWARD-ECONOMY': { brandName: 'eco', fareClass: 'Economy' },
  'AWARD-COMFORT-PLUS-PREMIUM-ECONOMY': { brandName: 'premium eco', fareClass: 'Premium Economy' },
  'AWARD-BUSINESS-FIRST': { brandName: 'bus', fareClass: 'Business' },
};

const common_headers = {
  'accept': '*/*',
  'accept-language': 'en-US,en;q=0.9',
  'content-type': 'application/json',
  'origin': 'https://www.virginatlantic.com',
  'priority': 'u=1, i',
  'referer': 'https://www.virginatlantic.com/flights/search/slice?awardSearch=true&passengers=a1t0c0i0',
  'sec-ch-ua': '"Not)A;Brand";v="8", "Chromium";v="138", "Google Chrome";v="138"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"Windows"',
  'sec-fetch-dest': 'empty',
  'sec-fetch-mode': 'cors',
  'sec-fetch-site': 'same-origin',
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
};

const graphqlQuery = `query SearchOffers($request: FlightOfferRequestInput!) {
  searchOffers(request: $request) {
    result {
      slices {
        current
        total
        __typename
      }
      criteria {
        origin {
          code
          cityName
          countryName
          airportName
          __typename
        }
        destination {
          code
          cityName
          countryName
          airportName
          __typename
        }
        departing
        __typename
      }
      slice {
        id
        fareId
        flightsAndFares {
          flight {
            segments {
              metal {
                family
                name
                __typename
              }
              airline {
                code
                name
                __typename
              }
              flightNumber
              operatingFlightNumber
              pendingGovtApproval
              operatingAirline {
                code
                name
                __typename
              }
              origin {
                code
                cityName
                countryName
                airportName
                __typename
              }
              destination {
                code
                cityName
                countryName
                airportName
                __typename
              }
              duration
              departure
              arrival
              stopCount
              connection
              legs {
                duration
                departure
                arrival
                stopOver
                isDominantLeg
                destination {
                  code
                  cityName
                  countryName
                  airportName
                  __typename
                }
                origin {
                  code
                  cityName
                  countryName
                  airportName
                  __typename
                }
                __typename
              }
              bookingClass
              fareBasisCode
              dominantFareProduct
              __typename
            }
            duration
            origin {
              code
              cityName
              countryName
              airportName
              __typename
            }
            destination {
              code
              cityName
              countryName
              airportName
              __typename
            }
            departure
            arrival
            __typename
          }
          fares {
            availability
            id
            fareId
            content {
              cabinName
              features {
                type
                description
                __typename
              }
              __typename
            }
            price {
              awardPoints
              awardPointsDifference
              awardPointsDifferenceSign
              tax
              amountIncludingTax
              priceDifference
              priceDifferenceSign
              amount
              currency
              __typename
            }
            fareSegments {
              cabinName
              bookingClass
              isDominantLeg
              isSaverFare
              __typename
            }
            available
            fareFamilyType
            cabinSelected
            isSaverFare
            promoCodeApplied
            __typename
          }
          __typename
        }
        __typename
      }
      tripSummary {
        sliceDetails {
          sliceNumber
          selectedCabin
          selectedPrice
          __typename
        }
        currency
        totalAwardPoints
        totalPrice
        __typename
      }
      basketId
      __typename
    }
    calendar {
      fromPrices {
        fromDate
        price {
          amount
          awardPoints
          currency
          minimumPriceInWeek
          minimumPriceInMonth
          remaining
          direct
          __typename
        }
        __typename
      }
      from
      to
      __typename
    }
    priceGrid {
      criteria {
        destination {
          cityName
          __typename
        }
        __typename
      }
      returning
      departures {
        departing
        prices {
          price {
            amount
            currency
            awardPoints
            __typename
          }
          minPrice
          __typename
        }
        __typename
      }
      __typename
    }
    __typename
  }
}`;

export const getFlightSearchRequest = (
  searchParams: SearchParams,
  cookies: Record<string, string>
) => {
  const variables = {
    request: {
      pos: null,
      parties: null,
      flightSearchRequest: {
        searchOriginDestinations: [{
          origin: searchParams.fromAirport,
          destination: searchParams.toAirport,
          departureDate: formatDate(searchParams.fromDate, "yyyy-MM-dd")
        }],
        bundleOffer: false,
        awardSearch: true,
        calendarSearch: false,
        flexiDateSearch: false,
        nonStopOnly: false,
        currentTripIndexId: "0",
        checkInBaggageAllowance: false,
        carryOnBaggageAllowance: false,
        refundableOnly: false
      },
      customerDetails: [{
        custId: "ADT_0",
        ptc: "ADT"
      }]
    }
  };

  return {
    method: 'POST',
    url: 'https://www.virginatlantic.com/flights/search/api/graphql',
    headers: {
      ...common_headers,
      Cookie: Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ')
    },
    body: JSON.stringify({
      query: graphqlQuery,
      variables
    }),
  } satisfies RequestOptions;
};

export const getCookiesRequest = () => {
  return {
    method: 'GET',
    url: 'https://jsonblob.com/api/jsonBlob/1394272046229413888',
    headers: {
      'accept': 'application/json',
    },
  } satisfies RequestOptions;
};

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