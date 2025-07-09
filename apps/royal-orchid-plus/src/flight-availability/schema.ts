import { z, ZodIssueCode } from 'zod';

export const thairespSchema = z.object({
  // New format fields (optional)
  success: z.boolean().optional(),
  moreFlights: z.boolean().optional(),
  lowestMiles: z.string().optional(),
  minimumMilesRequired: z.object({
    domesticMiles_O: z.string(),
    domesticMiles_R: z.string(),
    interMiles_O: z.string(),
    interMiles_R: z.string()
  }).optional(),
  session: z.object({
    sessionId: z.string(),
    sequenceNumber: z.string(),
    transactionStatusCode: z.string(),
    securityToken: z.string()
  }).optional(),
  message: z.string().nullable().optional(),
  
  // Common field for both formats
  flightList: z.array(
    z.object({
      departureDate: z.string(),
      departureTime: z.string(),
      arrivalDate: z.string(),
      arrivalTime: z.string(),
      departure: z.string(),
      arrival: z.string(),
      mc: z.string(),
      flightNum: z.string(),
      aircraftType: z.string(),
      aircraftTypeDesc: z.string(),
      duration: z.string(),
      numOfStops: z.number(),
      // Fields that differ between formats
      linenum: z.number().optional(), // New format
      arrivalTerminal: z.string().optional(), // Original format
      departureTerminal: z.string().optional(), // New format
      classList: z.array(
        z.object({
          bookingClass: z.string(),
          availability: z.string(),
          miles: z.string(),
          classDesc: z.string()
        })
      )
    })
  )
});


export const starAllianceRespSchema = z.object({
  success: z.boolean(),
  moreFlights: z.boolean(),
  lowestMiles: z.string().optional(),
  minimumMilesRequired: z.object({
    soarMiles: z.string()
  }).optional(),
  flightList: z.array(
    z.object({
      departureDate: z.string(),
      departureTime: z.string(),
      arrivalDate: z.string(),
      arrivalTime: z.string(),
      departure: z.string(),
      arrival: z.string(),
      mcFlightNums: z.array(
        z.object({
          mc: z.string(),
          flightNum: z.string()
        })
      ),
      linenum: z.number().nullable(),
      numOfStops: z.number(),
      duration: z.string(),
      flights: z.array(
        z.object({
          departureDate: z.string(),
          departureTime: z.string(),
          arrivalDate: z.string(),
          arrivalTime: z.string(),
          departure: z.string(),
          arrival: z.string(),
          mc: z.string(),
          flightNum: z.string(),
          linenum: z.number().optional(),
          aircraftType: z.string(),
          aircraftTypeDesc: z.string(),
          departureTerminal: z.string().optional(),
          arrivalTerminal: z.string().optional(),
          numOfStops: z.number(),
          duration: z.string(),
          classList: z.array(
            z.object({
              bookingClass: z.string(),
              availability: z.string(),
              miles: z.string().nullable(),
              classDesc: z.string()
            })
          )
        })
      ),
      classList: z.array(
        z.object({
          bookingClass: z.string(),
          availability: z.string(),
          miles: z.string(),
          classDesc: z.string()
        })
      )
    })
  ),
  session: z.object({
    sessionId: z.string(),
    sequenceNumber: z.string(),
    transactionStatusCode: z.string(),
    securityToken: z.string()
  }).optional(),
  message: z.string().nullable()
})