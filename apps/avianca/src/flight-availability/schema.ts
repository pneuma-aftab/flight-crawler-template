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

// More flexible Avianca flight search response schema
export const aviancaFlightResponseSchema = z.object({
  tripsList: z.array(
    z.object({
      departingCityCode: z.string(),
      arrivalCityCode: z.string(),
      departingTime: z.string().optional(),
      departingDate: z.string().optional(),
      arrivalTime: z.string().optional(),
      departingCity: z.string().optional(),
      arrivalCity: z.string().optional(),
      duration: z.string().optional(),
      typeStop: z.string().optional(),
      numberOfStops: z.number().optional(),
      multipleCabins: z.boolean().optional(),
      avhBusiness: z.boolean().optional(),
      multipleFlights: z.boolean().optional(),
      cabinsNumber: z.string().optional(),
      operators: z.string().optional(),
      operatorLogo: z.string().optional(),
      lowestPrice: z.string().optional(),
      layoverPlace: z.string().optional(),
      searchTypePrioritized: z.string().optional(),
      usdTaxValue: z.string().optional(),
      localTaxValue: z.string().optional(),
      products: z.array(
        z.object({
          id: z.number(),
          showBundle: z.boolean().optional(),
          cabinName: z.string().optional(),
          cabinCode: z.number().optional(),
          totalMiles: z.string().optional(),
          regularMiles: z.string().optional(),
          potentialDiscount: z.string().optional(),
          fare: z.number().optional(),
          odRealCost: z.number().optional(),
          odCalculateCost: z.number().optional(),
          soldOut: z.boolean().optional(),
          notApplicable: z.boolean().optional(),
          flights: z.array(
            z.object({
              id: z.string(),
              miles: z.number().optional(),
              eqp: z.string().optional(),
              cabCode: z.number().optional(),
              class: z.string().optional(),
              remainingSeats: z.number().optional(),
              remainingSeatsMessages: z.string().optional(),
              pctg: z.number().optional(),
              fees: z.array(z.any()).nullable().optional(),
              fare: z.number().optional(),
              fareCls: z.string().optional(),
              soldOut: z.boolean().optional(),
              soldOutMessage: z.string().optional(),
              segCost: z.number().optional(),
              segRealCost: z.number().optional(),
              applyOta: z.boolean().optional(),
              sch: z.string().optional(),
              clsOrder: z.number().optional(),
            })
          ).optional(),
          bestOption: z.boolean().optional(),
          sch: z.object({
            schFc: z.string().optional(),
            schFltrc: z.string().optional(),
            schFr: z.string().optional(),
            schFt: z.string().optional(),
            schPrFlTr: z.string().optional(),
            schPtrc: z.string().optional(),
            schTc: z.string().optional(),
          }).nullable().optional(),
          smpKey: z.string().optional(),
          fareBasis: z.any().nullable().optional(),
          staticMileageRt: z.object({}).nullable().optional(),
          staticMileageRtX: z.number().optional(),
          staticMileageRtI: z.number().optional(),
          staticMileageRtF: z.number().optional(),
          order: z.number().optional(),
          promoProduct: z.boolean().optional(),
          totalMilesAllPaxes: z.string().optional(),
          lockApplicable: z.boolean().optional(),
          milesRedemptionRate: z.string().optional(),
          capLM: z.string().optional(),
          capRM: z.string().optional(),
          notApplicableMessage: z.string().optional(),
          soldOutMessage: z.string().optional(),
          mrrDyn: z.number().optional(),
          productType: z.string().optional(),
          pricingType: z.string().optional(),
          apFrom: z.number().optional(),
          apTo: z.number().optional(),
          totalDisPtg: z.number().optional(),
          rdmDiscounts: z.string().optional(),
          detailByDiscount: z.string().optional(),
          disType: z.string().optional(),
          ivaChargeBack: z.number().optional(),
          ivaChargeBackLocal: z.number().optional(),
          totalTaxesLocal: z.string().optional(),
          localTaxValue: z.string().optional(),
          totalTaxesUsd: z.string().optional(),
          usdTaxValue: z.string().optional(),
        })
      ).optional(),
      flightsDetail: z.array(
        z.object({
          id: z.string(),
          departingCityCode: z.string().optional(),
          arrivalCityCode: z.string().optional(),
          departingDate: z.string().optional(),
          arrivalDate: z.string().optional(),
          departingTime: z.string().optional(),
          arrivalTime: z.string().optional(),
          marketingCompany: z.string().optional(),
          operatedCompany: z.string().optional(),
          flightNumber: z.string().optional(),
          typeStop: z.string().optional(),
          numberOfStops: z.number().optional(),
          operatedBy: z.string().optional(),
          tpm: z.string().optional(),
          operatorLogo: z.string().optional(),
        })
      ).optional(),
      alerts: z.array(
        z.object({
          type: z.string().optional(),
          message: z.string().optional(),
        })
      ).optional(),
      taxInfo: z.any().nullable().optional(),
      baggage: z.any().nullable().optional(),
      totalTaxesUsd: z.string().optional(),
      totalTaxesLocal: z.string().optional(),
      lowestPriceByCabin: z.array(
        z.object({
          cabinCode: z.string().optional(),
          miles: z.string().optional(),
          usdTaxValue: z.string().optional(),
          localTaxValue: z.string().optional(),
        })
      ).optional(),
      discountedLowestPriceByCabin: z.array(
        z.object({
          cabinCode: z.string().optional(),
          miles: z.string().optional(),
          usdTaxValue: z.string().optional(),
          localTaxValue: z.string().optional(),
        })
      ).optional(),
      potentialLowestPriceByCabin: z.any().nullable().optional(),
      showPctgArrow: z.boolean().optional(),
    })
  ),
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
export type AviancaFlightResponse = z.infer<typeof aviancaFlightResponseSchema>;