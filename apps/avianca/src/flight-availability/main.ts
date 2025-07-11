import type { Source } from 'crawlee';
import { Dataset, HttpCrawler } from 'crawlee';
import { writeFileSync } from 'fs';
import { join } from 'path';
import axios from 'axios';

import type {
  formatSearchJobParams,
  JobDetails,
  JobResult,
  UserData,
} from '@pneuma/shared-utils';
import { saveJobResults } from '@pneuma/shared-utils';

import { logger } from '@pneuma/logger';
import { 
  generateTokenRefreshRequest, 
  generateParHeaderRequest,
  generateFlightSearchRequest, 
  httpCrawlerConfig,
  cabinClassMapping
} from './config';
import {
  tokenRefreshResponseSchema,
  parHeaderResponseSchema,
  aviancaFlightResponseSchema,
  aviancaResponseSchema,
} from './schema';
import { env } from '@app/env';

const httpCrawler = new HttpCrawler({
  ...httpCrawlerConfig,
  async requestHandler({ request, session, sendRequest }) {
    const { jobId, frequentFlyerProgramId, providerId, debug, searchParams } =
      request.userData as UserData;

    logger.info(`Processing Request...`, { jobId });

    try {
      // Step 1: Refresh token using authorization code
      logger.debug('Refreshing access token...', { jobId });
      
      const tokenRefreshResponse = await sendRequest(
        generateTokenRefreshRequest(env.AVIANCA_AUTHORIZATION_CODE)
      );

      // Robust error handling for token refresh
      if (
        tokenRefreshResponse.statusCode !== 200 ||
        typeof tokenRefreshResponse.body !== 'string' ||
        tokenRefreshResponse.body.trim().startsWith('<')
      ) {
        logger.error('Received non-JSON response from token refresh API', {
          jobId,
          statusCode: tokenRefreshResponse.statusCode,
          bodySnippet: tokenRefreshResponse.body?.slice(0, 200),
        });
        throw new Error('Token refresh API did not return valid JSON');
      }

      const validatedTokenResponse = tokenRefreshResponseSchema.parse(
        JSON.parse(tokenRefreshResponse.body)
      );

      const accessToken = validatedTokenResponse.TokenGrantResponse.access_token;
      
      logger.debug('Access token obtained successfully', { 
        jobId,
        tokenExpiry: validatedTokenResponse.TokenGrantResponse.expires_in 
      });

      // Step 2: Get par-header data using raw axios request (bypass Crawlee)
      logger.debug('Getting par-header data with raw HTTP client...', { jobId });
      
      try {
        const parHeaderAxiosResponse = await axios({
          method: 'POST',
          url: 'https://api.lifemiles.com/svc/air-redemption-par-header-private',
          headers: {
            'accept': 'application/json',
            'accept-language': 'en-US,en;q=0.9',
            'authorization': `Bearer ${accessToken}`,
            'content-type': 'application/json',
            'origin': 'https://www.lifemiles.com',
            'priority': 'u=1, i',
            'realm': 'lifemiles',
            'referer': 'https://www.lifemiles.com/',
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
          },
          data: {
            cabin: String(cabinClassMapping[searchParams.cabinClass] || 2),
            ftNum: "",
            internationalization: {
              language: "en",
              country: "wr",
              currency: "usd"
            },
            itineraryName: "One-Way",
            itineraryType: "OW",
            numOd: 1,
            ods: [
              {
                id: 1,
                origin: {
                  cityName: searchParams.fromCity.name,
                  cityCode: searchParams.fromAirport
                },
                destination: {
                  cityName: searchParams.toCity.name,
                  cityCode: searchParams.toAirport
                }
              }
            ],
            paxNum: 1,
            selectedSearchType: "SMR"
          },
          timeout: 30000,
        });

        logger.info('Raw axios par-header request successful', { 
          jobId,
          status: parHeaderAxiosResponse.status 
        });

        const validatedParHeaderResponse = parHeaderResponseSchema.parse(
          parHeaderAxiosResponse.data
        );

        const idCotizacion = validatedParHeaderResponse.idCotizacion;
        const schHcfltrc = validatedParHeaderResponse.sch.schHcfltrc;
        
        logger.debug('Par-header data obtained successfully', { 
          jobId,
          idCotizacion,
          schHcfltrc: schHcfltrc.substring(0, 20) + '...'
        });

        logger.debug('Searching for flights...', { jobId });
        
        const flightSearchResponse = await sendRequest(
          generateFlightSearchRequest(searchParams, accessToken, idCotizacion, schHcfltrc)
        );

        if (
          flightSearchResponse.statusCode !== 200 ||
          typeof flightSearchResponse.body !== 'string' ||
          flightSearchResponse.body.trim().startsWith('<')
        ) {
          logger.error('Received non-JSON response from flight search API', {
            jobId,
            statusCode: flightSearchResponse.statusCode,
            bodySnippet: flightSearchResponse.body?.slice(0, 200),
          });
          throw new Error('Flight search API did not return valid JSON');
        }

        const parsedResponse = aviancaResponseSchema.parse(flightSearchResponse.body);

        logger.info('Raw flight search API response parsed successfully', { jobId });

        if (debug) {
          try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const debugDir = join(process.cwd(), 'debug');
            if (!require('fs').existsSync(debugDir)) {
              require('fs').mkdirSync(debugDir, { recursive: true });
            }
            const rawRespPath = join(debugDir, `raw-flightsearch-response-${jobId}-${timestamp}.json`);
            writeFileSync(rawRespPath, typeof flightSearchResponse.body === 'string' ? flightSearchResponse.body : JSON.stringify(flightSearchResponse.body, null, 2));
            logger.info('Raw flight search API response saved to file', { jobId, rawRespPath });
          } catch (fileError) {
            logger.warn('Failed to save raw flight search response to file', { jobId, error: fileError });
          }
        }
        
        // Step 4: Extract and format data
        const result = await extractData(
          parsedResponse,
          jobId,
          frequentFlyerProgramId,
          providerId
        );

        logger.info('Formatted flight search result', {
          jobId,
          resultCount: result.data.length
        });

        // Save formatted result to file for debugging
        // if (debug) {
        //   try {
        //     const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        //     const debugDir = join(process.cwd(), 'debug');
        //     if (!require('fs').existsSync(debugDir)) {
        //       require('fs').mkdirSync(debugDir, { recursive: true });
        //     }
        //     const formattedRespPath = join(debugDir, `formatted-flightsearch-result-${jobId}-${timestamp}.json`);
        //     writeFileSync(formattedRespPath, JSON.stringify(result, null, 2));
        //     logger.info('Formatted flight search result saved to file', { jobId, formattedRespPath });
        //   } catch (fileError) {
        //     logger.warn('Failed to save formatted flight search result to file', { jobId, error: fileError });
        //   }
        // }

        if (debug) {
          await Dataset.pushData({
            data: result,
            original: parsedResponse,
          });
          logger.info('Debug data pushed to dataset', { jobId });
        } else {
          await saveJobResults(result, jobId, logger);
          logger.info('Results saved to database', { jobId });
        }
        
        session?.markGood();
        logger.info('Request processed successfully', { jobId });

      } catch (axiosError: any) {
        logger.error('Axios par-header request failed', {
          jobId,
          status: axiosError.response?.status,
          statusText: axiosError.response?.statusText,
          data: axiosError.response?.data,
          message: axiosError.message,
        });
        throw new Error(`Par-header axios request failed: ${axiosError.message}`);
      }

    } catch (error) {
      logger.error('Error processing request', {
        jobId,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });
      session?.markBad();
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
    url: 'https://api.lifemiles.com/svc/air-redemption-find-flight-private',
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
  responseData: unknown,
  jobId: string,
  frequentFlyerProgramId: string,
  providerId: string
): Promise<JobResult> => {
  logger.debug('Extracting data from response...', { jobId });

  const supportingInfo = {
    frequentFlyerProgramId: frequentFlyerProgramId,
    jobId: jobId,
    isUTC: false,
  };

  try {
    // Extract only the data we need
    const filteredData = {
      tripsList: (responseData as any)?.tripsList || [],
      firstClass: (responseData as any)?.firstClass || false,
    };

    logger.debug('Filtered data for validation:', { 
      jobId, 
      tripsCount: filteredData.tripsList.length,
      firstClass: filteredData.firstClass
    });

    // If no trips found, return empty result
    if (filteredData.tripsList.length === 0) {
      logger.info('No trips found in response', { jobId });
      return {
        data: [],
        ...supportingInfo,
        success: true,
      };
    }

    // Parse the filtered flight response with our minimal schema
    const validatedData = aviancaFlightResponseSchema.parse(filteredData);

    // Transform the data according to the required output format
    const transformedData = (validatedData.tripsList || [])
      .map((trip) => {
        try {
          const segments = createSegments(trip);
          const fareDetails = createFareDetails(trip);
          
          // Only return if we have valid segments and fare details
          if (segments.length > 0 && fareDetails.length > 0) {
            return {
              origin: trip.departingCityCode,
              destination: trip.arrivalCityCode,
              segments,
              fareDetails,
            };
          }
          return null;
        } catch (tripError) {
          logger.warn('Error processing trip', { jobId, tripError });
          return null;
        }
      })
      .filter((trip): trip is NonNullable<typeof trip> => trip !== null); // Type guard to remove nulls

    logger.debug('Successfully transformed data', { 
      jobId, 
      originalCount: validatedData.tripsList?.length || 0,
      transformedCount: transformedData.length 
    });

    const result = {
      data: transformedData,
      ...supportingInfo,
      success: true,
    };

    return result;

  } catch (error) {
    logger.error('Error extracting data', {
      jobId,
      error: error instanceof Error ? error.message : 'Unknown error',
      responseKeys: Object.keys(responseData as any || {}),
    });
    
    return {
      data: [],
      ...supportingInfo,
      success: false,
    };
  }
};

// Helper function to create segments from flight data
function createSegments(trip: any): Array<{
  airlineCode: string;
  arrival: Date;
  departure: Date;
  origin: string;
  destination: string;
  flightNumber: string;
  aircraftCode: string;
  noOfStops: number;
  stops: any[];
  marketingAirlineCode: string;
  marketingFlightNumber: string;
}> {
  try {
    // Get products array, default to empty array if not present
    const products = trip.products || [];
    
    // Filter products: only include those with soldOut: false AND detailByDiscount: ""
    const validProducts = products.filter(
      (product: any) => !product.soldOut && product.detailByDiscount === ""
    );

    if (validProducts.length === 0) {
      return [];
    }

    // Use the first valid product to create segments
    const firstValidProduct = validProducts[0];
    const flights = firstValidProduct.flights || [];
    const flightsDetail = trip.flightsDetail || [];
    
    return flights.map((flight: any) => {
      try {
        // Extract airline code (first 2 letters) and flight number (remaining digits)
        const airlineCode = flight.id?.substring(0, 2) || 'XX';
        const flightNumber = flight.id?.substring(2) || '000';
        
        // Find matching flight details
        const flightDetail = flightsDetail.find((detail: any) => detail.id === flight.id);
        
        if (!flightDetail) {
          logger.warn(`Flight detail not found for flight ID: ${flight.id}`);
          return null;
        }

        // Combine date and time for departure and arrival
        const departureDateTime = new Date(`${flightDetail.departingDate}T${flightDetail.departingTime}:00`);
        const arrivalDateTime = new Date(`${flightDetail.arrivalDate}T${flightDetail.arrivalTime}:00`);

        return {
          airlineCode: airlineCode,
          arrival: arrivalDateTime,
          departure: departureDateTime,
          origin: flightDetail.departingCityCode || 'UNKNOWN',
          destination: flightDetail.arrivalCityCode || 'UNKNOWN',
          flightNumber: flightNumber,
          aircraftCode: flight.eqp || 'UNKNOWN',
          noOfStops: flightDetail.numberOfStops || 0,
          stops: [], // Hardcoded as empty array per instructions
          marketingAirlineCode: airlineCode,
          marketingFlightNumber: flightNumber,
        };
      } catch (flightError) {
        logger.warn('Error processing flight', { flightError });
        return null;
      }
    }).filter((segment: unknown): segment is NonNullable<typeof segment> => segment !== null);
  } catch (error) {
    logger.warn('Error in createSegments', { error });
    return [];
  }
}

// Helper function to create fare details
function createFareDetails(trip: any): Array<{
  milesAmount: number;
  taxAmount: number;
  milesOnlyAmount: number;
  seatsRemaining: number;
  brandName: string;
  fareClass: "Economy" | "Premium Economy" | "Business" | "First";
  taxCurrency: string;
}> {
  try {
    // Get products array, default to empty array if not present
    const products = trip.products || [];
    
    // Filter products: only include those with soldOut: false AND detailByDiscount: ""
    const validProducts = products.filter(
      (product: any) => !product.soldOut && product.detailByDiscount === ""
    );

    return validProducts.map((product: any) => {
      try {
        const flights = product.flights || [];
        
        // Find the minimum remaining seats across all flights in this product, excluding 0 seats
        const seatsAvailable = flights
          .map((flight: any) => flight.remainingSeats || 0)
          .filter((seats: number) => seats > 0); // Only consider flights with available seats
        
        const minSeatsRemaining = seatsAvailable.length > 0 ? Math.min(...seatsAvailable) : 0;
        
        // Map cabin name to fare class and brand name
        const { fareClass, brandName } = mapCabinToFareClass(product.cabinName || '');
        
        return {
          milesAmount: parseInt(product.totalMiles) || 0,
          taxAmount: parseFloat(product.totalTaxesUsd) || 0,
          milesOnlyAmount: parseInt(product.totalMiles) || 0,
          seatsRemaining: minSeatsRemaining,
          brandName: brandName,
          fareClass: fareClass,
          taxCurrency: "USD", // Hardcoded as per instructions
        };
      } catch (productError) {
        logger.warn('Error processing product', { productError });
        return null;
      }
    }).filter((fareDetail: unknown): fareDetail is NonNullable<typeof fareDetail> => fareDetail !== null); // Type guard to remove null entries
  } catch (error) {
    logger.warn('Error in createFareDetails', { error });
    return [];
  }
}

// Helper function to map cabin name to fare class and brand name
function mapCabinToFareClass(cabinName: string): { fareClass: "Economy" | "Premium Economy" | "Business" | "First"; brandName: string } {
  const lowerCabinName = cabinName.toLowerCase();
  
  if (lowerCabinName.includes('economy')) {
    if (lowerCabinName.includes('premium')) {
      return { fareClass: 'Premium Economy', brandName: 'Premium Economy' };
    }
    return { fareClass: 'Economy', brandName: 'eco' };
  } else if (lowerCabinName.includes('business')) {
    return { fareClass: 'Business', brandName: 'Business' };
  } else if (lowerCabinName.includes('first')) {
    return { fareClass: 'First', brandName: 'First' };
  } else {
    // Default to Economy if not recognized
    return { fareClass: 'Economy', brandName: 'eco' };
  }
}