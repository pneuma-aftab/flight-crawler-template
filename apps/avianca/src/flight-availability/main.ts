import type { Source } from 'crawlee';
import { Dataset, HttpCrawler } from 'crawlee';
import { writeFileSync } from 'fs';
import { join } from 'path';

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
  generateFlightSearchRequest, 
  httpCrawlerConfig 
} from './config';
import {
  tokenRefreshResponseSchema,
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

      const validatedTokenResponse = tokenRefreshResponseSchema.parse(
        JSON.parse(tokenRefreshResponse.body)
      );

      const accessToken = validatedTokenResponse.TokenGrantResponse.access_token;
      
      logger.debug('Access token obtained successfully', { 
        jobId,
        tokenExpiry: validatedTokenResponse.TokenGrantResponse.expires_in 
      });

      // Step 2: Search for flights using the access token
      logger.debug('Searching for flights...', { jobId });
      
      const flightSearchResponse = await sendRequest(
        generateFlightSearchRequest(searchParams, accessToken)
      );

      // Parse the response first using the general schema
      const parsedResponse = aviancaResponseSchema.parse(flightSearchResponse.body);
      
      // Save raw response to file for debugging
      // try {
      //   const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      //   const filename = `avianca-response-${timestamp}.json`;
      //   const filepath = join(process.cwd(), 'debug', filename);
      //   
      //   // Ensure debug directory exists
      //   const fs = require('fs');
      //   if (!fs.existsSync(join(process.cwd(), 'debug'))) {
      //     fs.mkdirSync(join(process.cwd(), 'debug'), { recursive: true });
      //   }
      //   
      //   writeFileSync(filepath, JSON.stringify(parsedResponse, null, 2));
      //   logger.info(`Raw response saved to: ${filepath}`, { jobId });
      // } catch (fileError) {
      //   logger.warn('Failed to save response to file', { jobId, error: fileError });
      // }
      
      // Step 3: Extract and format data
      const result = await extractData(
        parsedResponse,
        jobId,
        frequentFlyerProgramId,
        providerId
      );

      // Step 4: Save or push data based on debug flag
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

    } catch (error) {
      logger.error('Error processing request', {
        jobId,
        error: error instanceof Error ? error.message : 'Unknown error',
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
    providerId: providerId,
    isUTC: false,
    jobId: jobId,
  };

  try {
    // Filter the response to get only tripsList and firstClass
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

    // Parse the filtered flight response
    const {
      data: validatedData,
      success,
      error,
    } = await aviancaFlightResponseSchema.safeParseAsync(filteredData);

    if (!success) {
      logger.error('Failed to parse the flight response successfully', {
        jobId,
        cause: error.flatten(),
      });
      
      // Try to extract data anyway with a more lenient approach
      return extractDataLenient(responseData, jobId, frequentFlyerProgramId, providerId);
    }

    // Transform the data according to the required output format
    const transformedData = validatedData.tripsList.map((trip) => ({
      origin: trip.departingCityCode,
      destination: trip.arrivalCityCode,
      segments: createSegments(trip),
      fareDetails: createFareDetails(trip),
    }));

    logger.debug('Successfully transformed data', { 
      jobId, 
      transformedCount: transformedData.length 
    });

    const result = {
      data: transformedData,
      ...supportingInfo,
      success: true,
    };

    // Save final transformed data for debugging
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `final-output-${timestamp}.json`;
      const filepath = join(process.cwd(), 'debug', filename);
      writeFileSync(filepath, JSON.stringify(result, null, 2));
      logger.info(`Final transformed data saved to: ${filepath}`, { jobId });
    } catch (fileError) {
      logger.warn('Failed to save final output to file', { jobId, error: fileError });
    }

    return result;

  } catch (error) {
    logger.error('Error extracting data', {
      jobId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    
    return {
      data: [],
      ...supportingInfo,
      success: false,
    };
  }
};

// Lenient data extraction when schema validation fails
const extractDataLenient = (
  responseData: unknown,
  jobId: string,
  frequentFlyerProgramId: string,
  providerId: string
): JobResult => {
  logger.info('Attempting lenient data extraction', { jobId });

  const supportingInfo = {
    frequentFlyerProgramId: frequentFlyerProgramId,
    providerId: providerId,
    isUTC: false,
    jobId: jobId,
  };

  try {
    const tripsList = (responseData as any)?.tripsList || [];
    
    if (tripsList.length === 0) {
      return {
        data: [],
        ...supportingInfo,
        success: true,
      };
    }

    const transformedData = tripsList.map((trip: any) => {
      try {
        return {
          origin: trip.departingCityCode || 'UNKNOWN',
          destination: trip.arrivalCityCode || 'UNKNOWN',
          segments: createSegmentsLenient(trip),
          fareDetails: createFareDetailsLenient(trip),
        };
      } catch (tripError) {
        logger.warn('Error processing trip', { jobId, tripError });
        return null;
      }
    }).filter(Boolean);

    logger.info('Lenient extraction completed', { 
      jobId, 
      extractedCount: transformedData.length 
    });

    const result = {
      data: transformedData,
      ...supportingInfo,
      success: true,
    };

    // Save final transformed data for debugging (lenient version)
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `final-output-lenient-${timestamp}.json`;
      const filepath = join(process.cwd(), 'debug', filename);
      writeFileSync(filepath, JSON.stringify(result, null, 2));
      logger.info(`Final transformed data (lenient) saved to: ${filepath}`, { jobId });
    } catch (fileError) {
      logger.warn('Failed to save lenient final output to file', { jobId, error: fileError });
    }

    return result;

  } catch (error) {
    logger.error('Lenient extraction failed', {
      jobId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    
    return {
      data: [],
      ...supportingInfo,
      success: false,
    };
  }
};

// Helper function to create segments from flight data (strict version)
function createSegments(trip: any) {
  // Filter products: only include those with soldOut: false AND detailByDiscount: ""
  const validProducts = trip.products.filter(
    (product: any) => !product.soldOut && product.detailByDiscount === ""
  );

  if (validProducts.length === 0) {
    return [];
  }

  // Use the first valid product to create segments
  const firstValidProduct = validProducts[0];
  
  return firstValidProduct.flights.map((flight: any) => {
    // Extract airline code (first 2 letters) and flight number (remaining digits)
    const airlineCode = flight.id.substring(0, 2);
    const flightNumber = flight.id.substring(2);
    
    // Find matching flight details
    const flightDetail = trip.flightsDetail.find((detail: any) => detail.id === flight.id);
    
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
      origin: flightDetail.departingCityCode,
      destination: flightDetail.arrivalCityCode,
      flightNumber: flightNumber,
      aircraftCode: flight.eqp,
      noOfStops: flightDetail.numberOfStops,
      stops: [], // Hardcoded as empty array per instructions
      marketingAirlineCode: airlineCode,
      marketingFlightNumber: flightNumber,
    };
  }).filter(Boolean); // Remove null entries
}

// Helper function to create fare details
function createFareDetails(trip: any) {
  // Filter products: only include those with soldOut: false AND detailByDiscount: ""
  const validProducts = trip.products.filter(
    (product: any) => !product.soldOut && product.detailByDiscount === ""
  );

  return validProducts.map((product: any) => {
    // Find the minimum remaining seats across all flights in this product, excluding 0 seats
    const seatsAvailable = product.flights
      .map((flight: any) => flight.remainingSeats)
      .filter((seats: number) => seats > 0); // Only consider flights with available seats
    
    const minSeatsRemaining = seatsAvailable.length > 0 ? Math.min(...seatsAvailable) : 0;
    
    // Map cabin name to fare class and brand name
    const { fareClass, brandName } = mapCabinToFareClass(product.cabinName);
    
    return {
      milesAmount: parseInt(product.totalMiles) || 0,
      taxAmount: parseFloat(product.totalTaxesUsd) || 0,
      milesOnlyAmount: parseInt(product.totalMiles) || 0,
      seatsRemaining: minSeatsRemaining,
      brandName: brandName,
      fareClass: fareClass,
      taxCurrency: "USD", // Hardcoded as per instructions
    };
  });
}

// Helper function to create segments from flight data (lenient version)
function createSegmentsLenient(trip: any) {
  try {
    const products = trip.products || [];
    const validProducts = products.filter(
      (product: any) => !product.soldOut && product.detailByDiscount === ""
    );

    if (validProducts.length === 0) {
      return [];
    }

    const firstValidProduct = validProducts[0];
    const flights = firstValidProduct.flights || [];
    const flightsDetail = trip.flightsDetail || [];
    
    return flights.map((flight: any) => {
      try {
        const airlineCode = flight.id ? flight.id.substring(0, 2) : 'XX';
        const flightNumber = flight.id ? flight.id.substring(2) : '000';
        
        const flightDetail = flightsDetail.find((detail: any) => detail.id === flight.id);
        
        if (!flightDetail) {
          return {
            airlineCode: airlineCode,
            arrival: new Date(),
            departure: new Date(),
            origin: 'UNKNOWN',
            destination: 'UNKNOWN',
            flightNumber: flightNumber,
            aircraftCode: flight.eqp || 'UNKNOWN',
            noOfStops: 0,
            stops: [],
            marketingAirlineCode: airlineCode,
            marketingFlightNumber: flightNumber,
          };
        }

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
          stops: [],
          marketingAirlineCode: airlineCode,
          marketingFlightNumber: flightNumber,
        };
      } catch (flightError) {
        logger.warn('Error processing flight', { flightError });
        return null;
      }
    }).filter(Boolean);
  } catch (error) {
    logger.warn('Error in createSegmentsLenient', { error });
    return [];
  }
}

// Helper function to create fare details (lenient version)
function createFareDetailsLenient(trip: any) {
  try {
    const products = trip.products || [];
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
        
        const { fareClass, brandName } = mapCabinToFareClass(product.cabinName || '');
        
        return {
          milesAmount: parseInt(product.totalMiles) || 0,
          taxAmount: parseFloat(product.totalTaxesUsd) || 0,
          milesOnlyAmount: parseInt(product.totalMiles) || 0,
          seatsRemaining: minSeatsRemaining,
          brandName: brandName,
          fareClass: fareClass,
          taxCurrency: "USD",
        };
      } catch (productError) {
        logger.warn('Error processing product', { productError });
        return null;
      }
    }).filter(Boolean);
  } catch (error) {
    logger.warn('Error in createFareDetailsLenient', { error });
    return [];
  }
}

// Helper function to map cabin name to fare class and brand name
function mapCabinToFareClass(cabinName: string): { fareClass: string; brandName: string } {
  const lowerCabinName = cabinName.toLowerCase();
  
  if (lowerCabinName.includes('economy')) {
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