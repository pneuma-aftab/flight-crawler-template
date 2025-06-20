import { z } from 'zod';
import { cabinClassSchema } from './search';

export const JobStatus = [
  'Created',
  'Queued',
  'InProgress',
  'Completed',
  'Failed',
  'Timeout',
] as const;

export const fareClassSchema = z.object({
  fareClass: cabinClassSchema,
  brandName: z.string(),
});

export const fareOptionSchema = fareClassSchema.extend({
  seatsRemaining: z.number(),
  taxAmount: z.number(),
  taxCurrency: z.string(),
  milesAmount: z.number(),
  milesOnlyAmount: z.number(),
});

export const stopsSchema = z.object({
  destination: z.string(),
});

export const flightSegmentSchema = z.object({
  airlineCode: z.string(),
  marketingAirlineCode: z.string(),
  flightNumber: z.string(),
  marketingFlightNumber: z.string(),
  aircraftCode: z.string(),
  arrival: z.date(),
  departure: z.date(),
  origin: z.string(),
  noOfStops: z.number(),
  stops: z.array(stopsSchema),
  destination: z.string(),
});

export const itinerarySchema = z.object({
  origin: z.string(),
  destination: z.string(),
  fareDetails: z.array(fareOptionSchema),
  segments: z.array(flightSegmentSchema),
});

export const jobResultSchema = z.object({
  jobId: z.string(),
  frequentFlyerProgramId: z.string(),
  data: z.array(itinerarySchema),
  isUTC: z.boolean(),
  success: z.boolean(),
});
