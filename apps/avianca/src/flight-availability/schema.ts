import { z, ZodIssueCode } from 'zod';

// Token refresh response schema
export const tokenRefreshResponseSchema = z.object({
  TokenGrantResponse: z.object({
    access_token: z.string(),
    expires_in: z.number(),
    refresh_expires_in: z.number(),
    refresh_token: z.string(),
    token_type: z.string(),
    id_token: z.string(),
    'not-before-policy': z.number(),
    session_state: z.string(),
    scope: z.string(),
    cid: z.string(),
  }),
});

// Par-header response schema
export const parHeaderResponseSchema = z.object({
  idCotizacion: z.string(),
  sch: z.object({
    schHcfltrc: z.string(),
  }),
}).passthrough(); // Allow additional fields we don't need

// Minimal flight detail schema - only fields we actually use
const flightDetailSchema = z.object({
  id: z.string(),
  departingCityCode: z.string().optional(),
  arrivalCityCode: z.string().optional(),
  departingDate: z.string().optional(),
  arrivalDate: z.string().optional(),
  departingTime: z.string().optional(),
  arrivalTime: z.string().optional(),
  numberOfStops: z.number().optional(),
}).passthrough();

// Minimal flight schema - only fields we actually use
const flightSchema = z.object({
  id: z.string(),
  eqp: z.string().optional(),
  remainingSeats: z.number().optional(),
}).passthrough();

// Minimal product schema - only fields we actually use
const productSchema = z.object({
  soldOut: z.boolean().optional(),
  detailByDiscount: z.string().optional(),
  totalMiles: z.string().optional(),
  totalTaxesUsd: z.string().optional(),
  cabinName: z.string().optional(),
  flights: z.array(flightSchema).optional(),
}).passthrough();

// Minimal trip schema - only fields we actually use
const tripSchema = z.object({
  departingCityCode: z.string(),
  arrivalCityCode: z.string(),
  products: z.array(productSchema).optional(),
  flightsDetail: z.array(flightDetailSchema).optional(),
}).passthrough();

// Simplified flight response schema - only validate what we need
export const aviancaFlightResponseSchema = z.object({
  tripsList: z.array(tripSchema).optional(),
  firstClass: z.boolean().optional(),
}).passthrough();

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

export const aviancaResponseSchema = z.preprocess(
  parseJsonPreprocessor,
  z.unknown()
);

export type TokenRefreshResponse = z.infer<typeof tokenRefreshResponseSchema>;
export type ParHeaderResponse = z.infer<typeof parHeaderResponseSchema>;
export type AviancaFlightResponse = z.infer<typeof aviancaFlightResponseSchema>;