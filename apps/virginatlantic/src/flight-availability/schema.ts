import { z } from 'zod';

// Virgin Atlantic GraphQL response schema - only the fields we need
export const virginAtlanticResponseSchema = z.object({
  data: z.object({
    searchOffers: z.object({
      result: z.object({
        slice: z.object({
          flightsAndFares: z.array(
            z.object({
              flight: z.object({
                segments: z.array(
                  z.object({
                    metal: z.array(
                      z.object({
                        family: z.string(),
                        name: z.string(),
                      })
                    ),
                    airline: z.object({
                      code: z.string(),
                      name: z.string(),
                    }),
                    flightNumber: z.string(),
                    operatingFlightNumber: z.string(),
                    operatingAirline: z.object({
                      code: z.string(),
                      name: z.string(),
                    }),
                    origin: z.object({
                      code: z.string(),
                      cityName: z.string(),
                      countryName: z.string(),
                      airportName: z.string(),
                    }),
                    destination: z.object({
                      code: z.string(),
                      cityName: z.string(),
                      countryName: z.string(),
                      airportName: z.string(),
                    }),
                    duration: z.string(),
                    departure: z.string(),
                    arrival: z.string(),
                    stopCount: z.number(),
                    connection: z.string().nullable(),
                    bookingClass: z.string().nullable(),
                    fareBasisCode: z.string().nullable(),
                    dominantFareProduct: z.string().nullable(),
                  })
                ),
                duration: z.string(),
                origin: z.object({
                  code: z.string(),
                  cityName: z.string(),
                  countryName: z.string(),
                  airportName: z.string(),
                }),
                destination: z.object({
                  code: z.string(),
                  cityName: z.string(),
                  countryName: z.string(),
                  airportName: z.string(),
                }),
                departure: z.string(),
                arrival: z.string(),
              }),
              fares: z.array(
                z.object({
                  availability: z.string().nullable(),
                  id: z.string().nullable(),
                  fareId: z.string().nullable(),
                  content: z.any().nullable(),
                  price: z.object({
                    awardPoints: z.string(),
                    awardPointsDifference: z.string().nullable(),
                    awardPointsDifferenceSign: z.string().nullable(),
                    tax: z.number(),
                    amountIncludingTax: z.number(),
                    priceDifference: z.string(),
                    priceDifferenceSign: z.string().nullable(),
                    amount: z.number(),
                    currency: z.string(),
                  }).nullable(),
                  fareSegments: z.array(
                    z.object({
                      cabinName: z.string(),
                      bookingClass: z.string(),
                      isDominantLeg: z.boolean(),
                      isSaverFare: z.boolean(),
                    })
                  ).nullable(),
                  available: z.string().nullable(),
                  fareFamilyType: z.string(),
                  cabinSelected: z.boolean(),
                  isSaverFare: z.boolean(),
                  promoCodeApplied: z.string().nullable(),
                })
              ),
            })
          ),
        }),
      }),
    }),
  }),
});

// Schema for cookies response from jsonblob
export const cookiesResponseSchema = z.object({
  cookies: z.record(z.string()),
});