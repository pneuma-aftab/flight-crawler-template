import type {
  FlightSegment,
  formatSearchJobParams,
  Itinerary,
  JobDetails,
  JobResult,
  UserData,
} from '@pneuma/shared-utils';
import {
  generateHash,
  saveJobResults,
  updateJobStatus,
} from '@pneuma/shared-utils';
import type { Source } from 'crawlee';
import { Dataset, HttpCrawler, PuppeteerCrawler } from 'crawlee';
import { addSeconds, isAfter } from 'date-fns';
import { keys, sample } from 'remeda';

import { env } from '@app/env';
import { logger } from '@pneuma/logger';
import puppeteer, { Page } from 'puppeteer';
import { createStorage } from 'unstorage';
import {
  crawlerOptions,
  fareClassConfig,
  generateAirboundsRequestOptions,
  generatePageUrl,
  generateTokenRequest,
  puppeteerCrawlerOptions,
} from './config';
import {
  airboundsResponseSchema,
  etihadErrorSchema,
  etihadResponseSchema,
  tokenResponseSchema,
} from './schema';
import type { EtihadToken, EtihadUserData } from './types';
import { blockResources } from './util';

const accessTokenStorage = createStorage<EtihadToken>({});
export const xdTokenStorage = createStorage<Array<string>>({});

const crawler = new HttpCrawler({
  ...crawlerOptions,
  async requestHandler({ request, sendRequest, session }) {
    const {
      jobId,
      frequentFlyerProgramId,
      providerId,
      debug,
      searchParams,
      xdToken,
    } = request.userData as EtihadUserData;

    logger.info(`Processing API Request...`, {
      jobId,
    });

    const tokenHash = generateHash(xdToken);

    let accessToken = await accessTokenStorage.getItem(tokenHash);

    if (!accessToken || isAfter(new Date(), accessToken.expiresIn)) {
      logger.info(`Refreshing Etihad token...`);

      const { body: tokenResponse } = await sendRequest({
        ...generateTokenRequest(xdToken),
      });

      const validatedTokenResponse = tokenResponseSchema.parse(tokenResponse);

      accessToken = {
        accessToken: validatedTokenResponse.access_token,
        expiresIn: addSeconds(new Date(), validatedTokenResponse.expires_in),
      };

      await accessTokenStorage.setItem(tokenHash, accessToken);
    }

    logger.info(`Fetching flight results...`, { jobId });

    const { body: airboundsResponse } = await sendRequest({
      ...generateAirboundsRequestOptions({
        searchParams,
        token: accessToken.accessToken,
        xdToken: xdToken,
      }),
    });

    const validatedAirboundsResponse =
      airboundsResponseSchema.parse(airboundsResponse);

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

const puppeteerCrawler = new PuppeteerCrawler({
  ...puppeteerCrawlerOptions,
  async requestHandler({ page, session, request, blockRequests, sendRequest }) {
    const { jobId, frequentFlyerProgramId, providerId, debug, searchParams } =
      request.userData as UserData;
    logger.info(`Processing Browser Request...`, {
      jobId,
    });

    await blockRequests({
      urlPatterns: [
        '.jpg',
        '.jpeg',
        '.png',
        '.svg',
        '.ico',
        'assets.adobedtm.com',
        'cdn.cookielaw.org',
        'www.googletagmanager.com',
        'pagead2.googlesyndication.com',
        'connect.facebook.net',
        // 'static.connect.travelaudience.com',
        // 'mtalk.google.com',
        // 'gum.criteo.com',
        // 'ade.googlesyndication.com',
        // 'android.clients.google.com',
        // 'www.google.com',
        // 'clients2.google.com',
      ],
    });

    const tokenReq = page.waitForResponse(
      (response) =>
        response.url().endsWith('/token/initialization') &&
        response.request().method().toUpperCase() != 'OPTIONS',
      { timeout: 60000 }
    );

    await page.goto(generatePageUrl(searchParams));
    // const randomDelay = Math.floor(Math.random() * (4000 - 2000 + 1)) + 2000;
    // await new Promise((resolve) => setTimeout(resolve, randomDelay));
    // await element?.click();

    const tokenRes = await tokenReq;
    const tokenJson = (await tokenRes.json()) as unknown;

    if (tokenRes.status() !== 200) {
      throw new Error('Token Refresh Unauthorized/Failed');
    }

    logger.info('Saving token details:', { tokenJson });
    const validatedTokenResponse = tokenResponseSchema.parse(
      await tokenRes.json()
    );

    const accessToken = {
      accessToken: validatedTokenResponse.access_token,
      expiresIn: addSeconds(new Date(), validatedTokenResponse.expires_in),
    };

    const x_d_token = tokenRes.request().headers()['x-d-token'];

    const xdTokenList = await xdTokenStorage.getItem('xdToken');

    let validatedAirboundsResponse = [];

    if (x_d_token) {
      await xdTokenStorage.setItem(
        'xdToken',
        xdTokenList ? xdTokenList.concat(x_d_token) : [x_d_token]
      );
      await accessTokenStorage.setItem(generateHash(x_d_token), accessToken);

      const { body: airboundsResponse } = await sendRequest({
        ...generateAirboundsRequestOptions({
          searchParams,
          token: accessToken.accessToken,
          xdToken: x_d_token ?? '',
        }),
      });

      const validatedAirboundsResponse =
        airboundsResponseSchema.parse(airboundsResponse);

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
    } else {
      throw new Error("Failed to crawl. Didn't receive xd token");
    }
  },
});

export const getFlights = async (
  jobDetails: JobDetails,
  searchParams: ReturnType<typeof formatSearchJobParams>,
  debug?: boolean
) => {
  const xdToken = await xdTokenStorage.getItem('xdToken');

  let currentXDToken: string | undefined = undefined;

  let request = {
    url: 'https://api-des.etihad.com/airlines/EY/v2/search/air-bounds?guestOfficeId=&language=en&useTest=false',
    userData: {
      providerId: jobDetails.providerId,
      jobId: jobDetails.jobId,
      frequentFlyerProgramId: jobDetails.frequentFlyerProgramId,
      searchParams,
      debug: !!debug,
      xdToken: '',
    },
    uniqueKey: jobDetails.jobId,
    skipNavigation: true,
  } satisfies Source;

  logger.debug('Queueing job...', { jobId: jobDetails.jobId });
  if (xdToken && xdToken.length > 0) {
    currentXDToken = sample(xdToken, 1)[0] ?? '';

    request = {
      ...request,
      userData: {
        ...request.userData,
        xdToken: currentXDToken,
      },
    };
    if (crawler.running) {
      await crawler.addRequests([request]);
    } else {
      void crawler.run([request]);
    }
  } else {
    scrapeFlights(request.userData);
  }
};

export const scrapeFlights = async (userData: UserData) => {
  logger.info('Connecting to browser...', { jobId: userData.jobId });
  const browser = await puppeteer.connect({
    browserWSEndpoint: env.BROWSER_WS,
  });

  try {
    const page = await browser.newPage();
    const client = await page.createCDPSession();

    // if (userData.debug) {
    //   await openDevtools(page, client);
    // }

    //Block unnecessary resources
    await blockResources(client);

    const tokenReq = page.waitForResponse(
      (response) =>
        response.url().endsWith('/token/initialization') &&
        response.request().method().toUpperCase() != 'OPTIONS',
      { timeout: 60000 }
    );

    // const airboundsReq = generateRequestPromise(page, 'FIRST');;

    logger.info('Navigating to site...', { jobId: userData.jobId });
    await page.goto(generatePageUrl(userData.searchParams), {
      timeout: 60_000,
    });

    logger.info('Waiting for token request...', { jobId: userData.jobId });
    const tokenRes = await tokenReq;
    const tokenJson = (await tokenRes.json()) as unknown;

    if (tokenRes.status() !== 200) {
      throw new Error('Token Refresh Unauthorized/Failed');
    }

    logger.info('Saving token details:', { tokenJson });
    const validatedTokenResponse = tokenResponseSchema.parse(
      await tokenRes.json()
    );

    const accessToken = {
      accessToken: validatedTokenResponse.access_token,
      expiresIn: addSeconds(new Date(), validatedTokenResponse.expires_in),
    };

    const x_d_token = tokenRes.request().headers()['x-d-token'];

    const xdTokenList = await xdTokenStorage.getItem('xdToken');

    if (x_d_token) {
      await xdTokenStorage.setItem(
        'xdToken',
        xdTokenList ? xdTokenList.concat(x_d_token) : [x_d_token]
      );
      await accessTokenStorage.setItem(generateHash(x_d_token), accessToken);

      let request = {
        url: 'https://api-des.etihad.com/airlines/EY/v2/search/air-bounds?guestOfficeId=&language=en&useTest=false',
        userData: {
          ...userData,
          xdToken: x_d_token ?? '',
        },
        uniqueKey: userData.jobId,
        skipNavigation: true,
      } satisfies Source;
      
      if (crawler.running) {
        await crawler.addRequests([request]);
      } else {
        void crawler.run([request]);
      }
    } else {
      throw new Error("Failed to crawl. Didn't receive xd token");
    }
    // logger.info("Waiting for button")
    // const paywithmiles = await page.waitForSelector(
    //   "input[id*='mat-mdc-checkbox']",
    //   {
    //     visible: true,
    //   }
    // );

    // const airboundsReq = generateRequestPromise(page, 'ECONOMY');

    // if (paywithmiles) {
    //   await sleep(2000);
    //   await paywithmiles.click();
    //   logger.info('Clicked "Search flights" button');
    // }

    // logger.info('Waiting for airbound request...', { jobId: userData.jobId });

    // const jsonRes = (await (await airboundsReq).json()) as unknown;

    // logger.info('Extracting Data...', { jobId: userData.jobId });
    // const result = await extractData(
    //   jsonRes,
    //   userData.jobId,
    //   userData.frequentFlyerProgramId,
    //   userData.providerId
    // );

    // if (userData.debug) {
    //   await Dataset.pushData({
    //     data: result,
    //     original: jsonRes,
    //   });
    // } else {
    //   logger.info('Saving Results...', { jobId: userData.jobId });
    //   await saveJobResults(result, userData.jobId, logger);
    // }
  } catch (err) {
    const { jobId } = userData as UserData;
    logger.error(`Failed to crawl.`, {
      jobId,
      err,
    });
    await updateJobStatus(jobId, 'Failed', logger);
  } finally {
    await browser.close();
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

  const parsedResult = await etihadResponseSchema.safeParseAsync(json);
  const errorResult = etihadErrorSchema.safeParse(json);

  if (
    errorResult.data?.errors[0]?.title === 'Invalid access token' ||
    errorResult.data?.errors[0]?.title === 'Access token expired'
  ) {
    await accessTokenStorage.removeItem('token');
    throw new Error('Access Token Expired');
  }

  if (!parsedResult.success) {
    if (errorResult.success) {
      logger.error('No flights received.', { errors: errorResult.data.errors });
      return {
        data: [],
        ...supportingInfo,
        success: true,
      };
    } else {
      logger.error('Failed to parse the payload successfully', {
        errors: parsedResult.error.errors,
      });
      return {
        data: [],
        ...supportingInfo,
        success: false,
      };
    }
  } else {
    const {
      dictionaries: { flight, currency },
      data,
    } = parsedResult.data;

    const flightResult: Array<Itinerary> = [];
    for (const d of data.airBoundGroups) {
      const flights: Array<FlightSegment> = [];
      for (const f of d.boundDetails.segments) {
        const seg = flight[f.flightId];
        if (!seg) continue;
        const {
          marketingFlightNumber: flightNumber,
          marketingAirlineCode: airlineCode,
          arrival,
          departure,
          aircraftCode,
        } = seg;
        flights.push({
          airlineCode,
          arrival: new Date(arrival.dateTime),
          departure: new Date(departure.dateTime),
          origin:
            departure.locationCode == 'XNB' ? 'DXB' : departure.locationCode,
          destination:
            arrival.locationCode == 'XNB' ? 'DXB' : arrival.locationCode,
          flightNumber: flightNumber,
          aircraftCode: aircraftCode,
          noOfStops: 0,
          stops: [],
          marketingAirlineCode: airlineCode,
          marketingFlightNumber: flightNumber,
        });
      }

      flightResult.push({
        origin: flights[0]?.origin ?? '',
        destination: flights.at(-1)?.destination ?? '',
        segments: flights,
        fareDetails: d.airBounds.map((bound) => ({
          milesAmount:
            bound.prices.unitPrices[0]?.milesConversion?.convertedMiles?.base ??
            0,
          taxAmount:
            (bound.prices.unitPrices[0]?.prices[0]?.totalTaxes ?? 0) / 100,
          milesOnlyAmount:
            (bound.prices.unitPrices[0]?.milesConversion?.convertedMiles
              ?.base ??
              0) ||
            0,
          seatsRemaining: bound.availabilityDetails[0]?.quota ?? 0,
          brandName: bound.availabilityDetails[0]?.cabin ?? '',
          fareClass:
            fareClassConfig[bound.availabilityDetails[0]?.cabin ?? ''] ??
            'Economy',
          taxCurrency: keys(currency)[0] ?? '',
        })),
      });
    }

    return {
      data: flightResult,
      ...supportingInfo,
      success: true,
    };
  }
};

const generateRequestPromise = (page: Page, cabinClass: string) => {
  return page.waitForResponse(
    async (response) => {
      // Check if the URL contains '/search/air-bounds' and it's not an OPTIONS request
      if (
        response.url().includes('/search/air-bounds') &&
        response.request().method().toUpperCase() != 'OPTIONS'
      ) {
        try {
          // Get the request that triggered this response
          const request = response.request();

          // Get the post data from the request
          const postData = request.postData();

          if (postData) {
            // Parse the JSON payload
            const payload = JSON.parse(postData);

            // Check if commercialFareFamilies exists and has "ECONOMY" as the first item
            return (
              payload.commercialFareFamilies.includes(cabinClass) &&
              payload.searchPreferences.showMilesPrice === true
            );
          }
        } catch (error) {
          console.error('Error parsing request payload:', error);
        }
      }

      return false;
    },
    { timeout: 60000 }
  );
};
