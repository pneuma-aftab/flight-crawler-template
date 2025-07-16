import { z } from 'zod';

export const qatarAirwaysResponseSchema = z.object({
  flightOffers: z.array(
    z.object({
      origin: z.object({
        iataCode: z.string()
      }),
      destination: z.object({
        iataCode: z.string()
      }),
      segments: z.array(
        z.object({
          flightNumber: z.string(),
          vehicle: z.object({
            code: z.string()
          }),
          departure: z.object({
            origin: z.object({
              iataCode: z.string()
            }),
            dateTime: z.string()
          }),
          arrival: z.object({
            destination: z.object({
              iataCode: z.string()
            }),
            dateTime: z.string()
          }),
          operatorLogo: z.object({
            operatorCode: z.string()
          })
        })
      ),
      fareOffers: z.array(
        z.object({
          availableSeats: z.number(),
          price: z.object({
            base: z.number()
          }),
          cabinType: z.string().optional(),
          cabinOfferType: z.string().optional()
        })
      )
    })
  )
});