import { Hono } from 'hono';

import { getFlights } from '@app/flight-availability/main';
import { logger } from '@pneuma/logger';
import {
  formatSearchJobParams,
  isValidScheduleSearchJobInput,
  updateJobStatus,
} from '@pneuma/shared-utils';

export function defineRoutes(app: Hono) {
  app.get('/api/health', (c) =>
    c.json({
      status: 'Running',
    })
  );

  app.post('/api/flight/itinerary', async (c) => {
    const body = (await c.req.json()) as unknown;

    isValidScheduleSearchJobInput(body);

    await getFlights(
      {
        jobId: body.jobId,
        providerId: body.providerId,
        frequentFlyerProgramId: body.frequentFlyerProgramId,
      },
      formatSearchJobParams(body.searchParams),
      body.debug
    );

    if (!body.debug) await updateJobStatus(body.jobId, 'Queued', logger);

    logger.info('Flight Search Queued', { jobId: body.jobId });

    return c.json(
      {
        data: {
          message: 'Flight Search Queued',
        },
        error: {},
      },
      201
    );
  });
}
