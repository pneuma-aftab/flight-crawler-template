import { z, ZodIssueCode } from 'zod';

export const airportResponseSchema = z.array(
  z.object({
    airportCode: z.string(),
    airportName: z.string(),
  })
);

export const etihadResponseSchema = z.object({
  data: z.object({
    airBoundGroups: z.array(
      z.object({
        boundDetails: z.object({
          originLocationCode: z.string(),
          destinationLocationCode: z.string(),
          duration: z.number(),
          segments: z.array(z.object({ flightId: z.string() })),
        }),
        airBounds: z.array(
          z.object({
            availabilityDetails: z.array(
              z.object({
                cabin: z.string(),
                quota: z.number(),
              })
            ),
            prices: z.object({
              unitPrices: z.array(
                z.object({
                  travelerIds: z.array(z.string()),
                  prices: z.array(
                    z.object({
                      base: z.number(),
                      total: z.number(),
                      currencyCode: z.string(),
                      totalTaxes: z.number(),
                    })
                  ),
                  milesConversion: z.object({
                    convertedMiles: z.object({
                      base: z.number(),
                      total: z.number(),
                    }),
                    remainingNonConverted: z.object({
                      total: z.number(),
                      currencyCode: z.string(),
                      totalTaxes: z.number(),
                    }),
                  }),
                })
              ),
            }),
          })
        ),
      })
    ),
  }),
  dictionaries: z.object({
    flight: z.record(
      z.object({
        marketingAirlineCode: z.string(),
        marketingFlightNumber: z.string(),
        departure: z.object({
          locationCode: z.string(),
          dateTime: z.string(),
        }),
        arrival: z.object({
          locationCode: z.string(),
          dateTime: z.string(),
        }),
        aircraftCode: z.string(),
        duration: z.number(),
      })
    ),
    currency: z.record(
      z.object({ name: z.string(), decimalPlaces: z.number() })
    ),
  }),
});

export const etihadErrorSchema = z.object({
  errors: z.array(
    z.object({ code: z.string(), title: z.string(), detail: z.string() })
  ),
});

const parseJsonPreprocessor = (value: unknown, ctx: z.RefinementCtx) => {
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as unknown;
    } catch (e) {
      ctx.addIssue({
        code: ZodIssueCode.custom,
        message: (e as Error).message,
      });
    }
  }

  return value;
};

export const tokenResponseSchema = z.preprocess(
  parseJsonPreprocessor,
  z.object({
    access_token: z.string(),
    expires_in: z.number(),
    guest_office_id: z.string(),
  })
);
export const airboundsResponseSchema = z.preprocess(
  parseJsonPreprocessor,
  z.unknown()
);
