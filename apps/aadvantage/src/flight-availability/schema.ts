import { z, ZodIssueCode } from 'zod';

export const americanAirlinesResponseSchema = z.object({
  slices: z.array(
    z.object({
      durationInMinutes: z.number(),
      segments: z.array(
        z.object({
          flight: z.object({
            carrierCode: z.string(),
            carrierName: z.string(),
            flightNumber: z.string(),
          }),
          legs: z.array(
            z.object({
              aircraft: z.object({
                code: z.string(),
                name: z.string(),
                shortName: z.string(),
              }),
              arrivalDateTime: z.string(),
              departureDateTime: z.string(),
              destination: z.object({ code: z.string() }),
              durationInMinutes: z.number(),
              origin: z.object({ code: z.string() }),
              aircraftCode: z.string(),
            })
          ),
          origin: z.object({ code: z.string() }),
          destination: z.object({ code: z.string() }),
          departureDateTime: z
            .string()
            .datetime({ offset: true })
            .pipe(z.coerce.date()),
          arrivalDateTime: z
            .string()
            .datetime({ offset: true })
            .pipe(z.coerce.date()),
        })
      ),
      pricingDetail: z.array(
        z.object({
          perPassengerAwardPoints: z.number(),
          perPassengerTaxesAndFees: z.object({
            amount: z.number(),
            currency: z.string(),
          }),
          productType: z.string(),
          seatsRemaining: z.number(),
          productAvailable: z.boolean(),
        })
      ),
      stops: z.number(),
      origin: z.object({ code: z.string() }),
      destination: z.object({ code: z.string() }),
      departureDateTime: z
        .string()
        .datetime({ offset: true })
        .pipe(z.coerce.date()),
      arrivalDateTime: z
        .string()
        .datetime({ offset: true })
        .pipe(z.coerce.date()),
    })
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

export const airboundsResponseSchema = z.preprocess(
  parseJsonPreprocessor,
  z.unknown()
);
