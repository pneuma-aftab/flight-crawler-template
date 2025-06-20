import type {
  CrawlingContext,
  HttpCrawlerOptions,
  PuppeteerCrawlerOptions,
} from 'crawlee';
import { Log, ProxyConfiguration } from 'crawlee';
import { randomUUID } from 'crypto';
import { addMonths, format, formatDate } from 'date-fns';

import type { CabinClass, SearchParams } from '@pneuma/shared-utils';
import { evomiProxyURLList, updateJobStatus } from '@pneuma/shared-utils';

import { env } from '@app/env';
import { logger } from '@pneuma/logger';
import { error } from 'console';
import { scrapeFlights, xdTokenStorage } from './main';
import type { EtihadUserData } from './types';
type RequestOptions = Parameters<CrawlingContext['sendRequest']>['0'];

export const journeyTypes = {
  'Multi City': 'mc',
  'One Way': 'ow',
  'Round Trip': 'rt',
} as const;

const formReq = {
  client_id: 'TEAP1EPUAR97S1aWCpEkWe9L3VvhtBIK',
  client_secret: 'j9sP1PK9cEJKbL1o',
  fact: '{"keyValuePairs":[{"key":"flow","value":"AWARD"},{"key":"market","value":"US"},{"key":"originCity","value":"NYC"},{"key":"originCountry","value":"US"},{"key":"channel","value":"DESKTOP"}]}',
  grant_type: 'client_credentials',
};

export const generatePageUrl = (searchParams: SearchParams) => {
  return `https://digital.etihad.com/book/search?LANGUAGE=EN&CHANNEL=DESKTOP&B_LOCATION=${searchParams.fromAirport}&E_LOCATION=${searchParams.toAirport}&TRIP_TYPE=O&CABIN=E&TRAVELERS=ADT&TRIP_FLOW_TYPE=AVAILABILITY&WDS_ENABLE_STOPOVER_HOTEL_BOOKING=TRUE&WDS_ENABLE_HOTEL_STPF=TRUE&SITE_EDITION=EN-IN&WDS_ENABLE_UPLIFT=TRUE&WDS_ENABLE_FLAGSHIP=TRUE&WDS_ELIGIBLE_FLAGSHIP_LIST=A380-800&WDS_ENABLE_KOREAN_AMOP=TRUE&DATE_1=${format(searchParams.fromDate, 'yyyyMMdd')}0000&FLOW=REVENUE`;
};

// export const generatePageUrl = (searchParams: SearchParams) => {
//   return `https://digital.etihad.com/book/search?LANGUAGE=EN&CHANNEL=MOBILEWEB&B_LOCATION=${searchParams.fromAirport}&E_LOCATION=${searchParams.toAirport}&TRIP_TYPE=O&CABIN=E&TRAVELERS=ADT&TRIP_FLOW_TYPE=AVAILABILITY&WDS_ENABLE_STOPOVER_HOTEL_BOOKING=TRUE&WDS_ENABLE_HOTEL_STPF=TRUE&WDS_ENABLE_MULTI_CURRENCY=TRUE&SITE_EDITION=EN-XB&WDS_HIDE_BASIC_FARE=TRUE&WDS_UPDATE_PASSENGER_ANALYTICS_INFO=TRUE&WDS_ENABLE_FRANCE_INSURANCE=TRUE&WDS_ENABLE_SPAIN_INSURANCE=TRUE&DATE_1=${format(searchParams.fromDate, 'yyyyMMdd')}0000&WDS_ENABLE_MILES_TOGGLE=TRUE&FLOW=AWARD`;
// };

export const generateTokenRequest = (xdToken: string) => {
  return {
    url: 'https://api-des.etihad.com/v1/security/oauth2/token/initialization',
    method: 'POST',
    headers: {
      'accept-encoding': 'gzip, deflate, br',
      accept: 'application/json',
      'accept-language': 'en-GB,en;q=0.5',
      'Content-Type': 'application/x-www-form-urlencoded',
      'x-d-token': xdToken,
      referer: 'https://digital.etihad.com/',
      origin: 'https://digital.etihad.com/',
    },
    body: Object.entries(formReq)
      .map(([k, v]) => `${k}=${v}`)
      .join('&'),
  } satisfies RequestOptions;
};

export const etihadReferer = `https://api-des.etihad.com/airlines/EY/v2/search/air-bounds`;

export const generateAirboundsRequestOptions = ({
  searchParams,
  token,
  xdToken,
}: {
  searchParams: SearchParams;
  token: string;
  xdToken: string;
}) => {
  return {
    body: JSON.stringify({
      commercialFareFamilies: ['ECONOMY', 'BUSINESS', 'FIRST'],
      itineraries: [
        {
          originLocationCode: searchParams.fromAirport,
          destinationLocationCode: searchParams.toAirport,
          departureDateTime: formatDate(
            searchParams.fromDate,
            "yyyy-MM-dd'T'00:00:00.000"
          ),
          isRequestedBound: true,
        },
      ],
      travelers: [
        {
          passengerTypeCode: 'ADT',
        },
      ],
      searchPreferences: {
        showMilesPrice: true,
        showSoldOut: false,
      },
      corporateCodes: ['264154'],
    }),
    url: 'https://api-des.etihad.com/airlines/EY/v2/search/air-bounds?guestOfficeId=&language=en&useTest=false',
    method: 'POST',
    headers: {
      accept: 'application/json',
      'accept-language': 'en-GB,en;q=0.9',
      'ama-client-ref': randomUUID() + ':h',
      origin: 'https://digital.etihad.com',
      referer: 'https://digital.etihad.com/',
      'accept-encoding': 'gzip, deflate, br',
      'content-type': 'application/json',
      'x-d-token': xdToken,
      authorization: 'Bearer ' + token,
    },
  } satisfies RequestOptions;
};

export const fareClassConfig: Record<string, (typeof CabinClass)[number]> = {
  eco: 'Economy',
  business: 'Business',
  first: 'First',
};

const proxyConfiguration = new ProxyConfiguration({
  proxyUrls: evomiProxyURLList,
});

export const crawlerOptions = {
  minConcurrency: 10,
  maxConcurrency: 50,
  log: new Log({
    maxDepth: 1,
  }),
  // persistCookiesPerSession: false,
  maxRequestRetries: 0,
  autoscaledPoolOptions: {
    desiredConcurrency: 3,
  },
  proxyConfiguration,
  requestHandlerTimeoutSecs: 30,
  errorHandler: async ({ request, session }) => {
    const { jobId } = request.userData as EtihadUserData;

    logger.error('Failed to process the request.', {
      jobId,
      error,
    });

    session?.markBad();
  },
  failedRequestHandler: async ({ request }) => {
    const { jobId, xdToken } = request.userData as EtihadUserData;
    logger.error(`Failed to crawl.`, {
      jobId,
    });

    const xdTokenList = await xdTokenStorage.getItem('xdToken');

    await xdTokenStorage.setItem(
      'xdToken',
      xdTokenList?.filter((val) => val !== xdToken) ?? []
    );

    scrapeFlights(request.userData);
  },
} satisfies HttpCrawlerOptions;

export const puppeteerCrawlerOptions = {
  minConcurrency: 10,
  maxConcurrency: 50,
  launchContext: {
    // useIncognitoPages: true,
    // useChrome: true,
    launchOptions: {
      // args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-sync'],
      defaultViewport: { width: 1366, height: 768 },
      // executablePath: '/usr/bin/chromium-browser',
    },
  },
  log: new Log({
    maxDepth: 1,
  }),
  // headless: false,
  sessionPoolOptions: {
    maxPoolSize: env.SESSION_COUNT,
  },
  maxRequestRetries: 1,
  autoscaledPoolOptions: {
    desiredConcurrency: 3,
  },
  proxyConfiguration,
  requestHandlerTimeoutSecs: 60,
  errorHandler: ({ request, session }) => {
    const { jobId } = request.userData as EtihadUserData;

    logger.error('Failed to process the request.', {
      jobId,
      error,
    });

    session?.markBad();
  },
  failedRequestHandler: async ({ request, session }) => {
    const { jobId } = request.userData as EtihadUserData;
    logger.error(`Failed to crawl.`, {
      jobId,
      error,
    });

    session?.markBad();
    await updateJobStatus(jobId, 'Failed', logger);
  },
} satisfies PuppeteerCrawlerOptions;

export const generateRecentSearchBody = (searchParams: SearchParams) => {
  return [
    {
      travelSpan: 'OW',
      formData: {
        origin: {
          IATA: searchParams.fromAirport,
          originCity: `New York, ${searchParams.fromAirport}`,
          countryCode: 'US',
          cityName: 'New York',
        },
        destination: {
          IATA: searchParams.toAirport,
          destinationCity: `Abu Dhabi, ${searchParams.toAirport}`,
          countryCode: 'AE',
          cityName: 'Abu Dhabi',
        },
        calendar: {
          departDate: format(searchParams.fromDate, 'yyyy-MM-dd'),
          returnDate: '',
        },
        selectedClass: {
          isDefault: true,
          fareClass: [
            {
              isDefault: true,
              label: 'Basic',
              isOndDependent: false,
              value: 'Ybasic',
            },
            {
              isDefault: false,
              label: 'Value',
              isOndDependent: false,
              value: 'Yvalue',
            },
            {
              isDefault: false,
              label: 'Comfort',
              isOndDependent: false,
              value: 'Ycomfort',
            },
            {
              isDefault: false,
              label: 'Deluxe',
              isOndDependent: false,
              value: 'Ydeluxe',
            },
            {
              isDefault: false,
              label: 'GuestSeat',
              isOndDependent: false,
              value: 'Yguest',
            },
          ],
          uniqueKey: 'economy',
          label: 'Economy',
          value: 'ECONOMY',
        },
        guest: { ADT: 1, CHD: 0, INF: 0, INS: 0, OFW: 0, B15: 0 },
        tripType: {
          defaultJourneyType: false,
          const1A: 'O',
          uniqueKey: 'oneWay',
          label: 'One-way',
          intCid: 'home-_-flightsearch-_-oneway-_-20190821',
        },
        channel: 'DESKTOP',
        guestTypes: [
          {
            infoText: 'You can book up to nine guests',
            showInformationText: false,
            subLabel: 'Age 12+',
            resInformationText: 'You can book up to two guests',
            defaultValue: 1,
            ptcDependenceOnCountryCode: null,
            maxRange: 9,
            label: 'Adults',
            intervalRange: 1,
            infoMessageIcon:
              '/content/dam/eag/etihadairways/etihadcom/Global/Common/passenger-info-message-icon.svg',
            placeholder: null,
            value: 'ADT',
            infoMessageIconAltText: 'Information regarding adult',
            minRange: 0,
          },
          {
            infoText: 'You can book up to eight children',
            showInformationText: false,
            subLabel: 'Age 2 – 11 years',
            resInformationText: 'You can book up to two guests',
            defaultValue: 0,
            ptcDependenceOnCountryCode: null,
            maxRange: 9,
            label: 'Children',
            intervalRange: 1,
            infoMessageIcon:
              '/content/dam/eag/etihadairways/etihadcom/Global/Common/passenger-info-message-icon.svg',
            placeholder: null,
            value: 'CHD',
            infoMessageIconAltText: 'Information regarding Children',
            minRange: 0,
          },
          {
            infoText: 'You can select up to nine infants',
            showInformationText: false,
            subLabel: 'Under 2 years',
            resInformationText: 'You can book up to two guests',
            defaultValue: 0,
            ptcDependenceOnCountryCode: null,
            maxRange: 9,
            label: 'Infants',
            intervalRange: 1,
            infoMessageIcon:
              '/content/dam/eag/etihadairways/etihadcom/Global/Common/passenger-info-message-icon.svg',
            placeholder: null,
            value: 'INF',
            infoMessageIconAltText: 'Information regarding infants',
            minRange: 0,
          },
          {
            infoText: 'You can select up to nine Infants with Seat',
            showInformationText: false,
            subLabel: 'Under 2 years',
            resInformationText: 'You can book up to two guests',
            defaultValue: 0,
            ptcDependenceOnCountryCode: null,
            maxRange: 9,
            label: 'Infants with Seat',
            intervalRange: 1,
            infoMessageIcon:
              '/content/dam/eag/etihadairways/etihadcom/Global/Common/passenger-info-message-icon.svg',
            placeholder: null,
            value: 'INS',
            infoMessageIconAltText: 'Information regarding Infant with Seat',
            minRange: 0,
          },
          {
            infoText: 'You can select up to nine Overseas Filipino Workers',
            showInformationText: false,
            subLabel: 'Age 12+',
            resInformationText: 'You can book up to two guests',
            defaultValue: 0,
            ptcDependenceOnCountryCode: ['MNL'],
            maxRange: 9,
            label: 'Overseas Filipino Workers',
            intervalRange: 1,
            infoMessageIcon:
              '/content/dam/eag/etihadairways/etihadcom/Global/Common/passenger-info-message-icon.svg',
            placeholder: null,
            value: 'OFW',
            infoMessageIconAltText:
              'Information regarding Overseas Filipino Workers',
            minRange: 0,
          },
          {
            infoText: 'You can select up to nine Young Adults',
            showInformationText: false,
            subLabel: 'Age 12 – 16 years',
            resInformationText: null,
            defaultValue: 0,
            ptcDependenceOnCountryCode: [
              'LHR',
              'MAN',
              'ABZ',
              'QQX',
              'BHD',
              'BHX',
              'UBW',
              'BRS',
              'TPB',
              'CWL',
              'MME',
              'EDI',
              'EXS',
              'EXT',
              'GLA',
              'HUY',
              'LBA',
              'NCL',
              'XNE',
              'OXF',
              'PLH',
              'XWS',
              'TTY',
              'LON',
            ],
            maxRange: 9,
            label: 'Young Adults',
            intervalRange: 1,
            infoMessageIcon:
              '/content/dam/eag/etihadairways/etihadcom/Global/Common/passenger-info-message-icon.svg',
            placeholder: null,
            value: 'B15',
            infoMessageIconAltText: 'Information regarding Young Adults',
            minRange: 0,
          },
        ],
        promoCode: '',
        isPayWithMiles: false,
        originSearchType: 'all destinations',
        destinationSearchType: 'popular destinations',
        enableCalendarPricing: true,
        currencyCode: 'USD',
        calendarPriceDetails: {
          currency: 'USD',
          roundTripDuration: '7',
          monthLowestPriceRange: [],
          monthWisePriceArr: [],
          tripType: 'one-way',
        },
        showPartnerRouteMsg: false,
      },
      pathName: '/en-in/',
      langValue: 'en',
      expires: `${format(addMonths(new Date(), 1), 'yyyy-MM-dd')}T00:00:00.000Z`,
    },
  ];
};
