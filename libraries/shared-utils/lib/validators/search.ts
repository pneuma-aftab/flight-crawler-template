import { AppError, AppErrorType } from '@pneuma/error-handling';
import { z } from 'zod';
import { CabinClass, DestinationType, JourneyType } from './constants';

const citySchema = z.object({
  code: z.string(),
  name: z.string(),
  country: z.object({
    isoCode2: z.string(),
    name: z.string(),
    id: z.string(),
  }),
});

export const journeyTypeSchema = z.enum(JourneyType);

export const cabinClassSchema = z.enum(CabinClass);

export const searchDetailsSchema = z.object({
  id: z.string(),
  journeyType: journeyTypeSchema,
  cabinClass: cabinClassSchema,
  fromDate: z.string().pipe(z.coerce.date()),
  toDate: z.string().pipe(z.coerce.date()).nullable(),
  fromDestinationType: z.enum(DestinationType),
  toDestinationType: z.enum(DestinationType),
  fromAirport: z.object({
    iataCode: z.string(),
  }),
  toAirport: z.object({
    iataCode: z.string(),
  }),
  fromCity: citySchema,
  toCity: citySchema,
});

export const scheduleSearchJobSchema = z.object({
  searchParams: searchDetailsSchema,
  providerId: z.string(),
  frequentFlyerProgramId: z.string(),
  jobId: z.string(),
  debug: z.boolean().optional(),
});

export function isValidScheduleSearchJobInput(
  input: unknown
): asserts input is z.infer<typeof scheduleSearchJobSchema> {
  try {
    scheduleSearchJobSchema.parse(input);
  } catch (error) {
    throw new AppError(
      'ScheduleSearchValidationError',
      'Zod validation error on schedule search input',
      AppErrorType.Validation,
      'PayloadValidation',
      error
    );
  }
}
