import { serve } from '@hono/node-server';
import { logger } from '@pneuma/logger';
import { addRequestIdHonoMiddleware } from '@pneuma/request-context/middleware';
import { Hono } from 'hono';

import { env } from '@app/env';
import { errorHandler, handleHTTPError } from '@pneuma/error-handling';
import {
  strictTransportSecurity,
  xContentTypeOptions,
} from '@pneuma/secure-headers';
import { cors } from 'hono/cors';
import * as Http from 'http';
import { defineRoutes } from './routes';

const { PORT } = env;

const app = new Hono();

logger.configureLogger(
  {
    prettyPrint: env.PRETTY_PRINT === 'YES',
    enableAxiomTransport: env.NODE_ENV === 'production',
  },
  true
);

app.use('*', addRequestIdHonoMiddleware());

app.onError(handleHTTPError());

// Set the CORS configuration as strictly as possible for your frontend
// https://hono.dev/middleware/builtin/cors
app.use('*', cors());

app.use('*', strictTransportSecurity());
app.use('*', xContentTypeOptions());

defineRoutes(app);

const connection = serve({
  ...app,
  port: PORT,
});

errorHandler.listenToErrorEvents(connection as Http.Server);

logger.info(`Running server on http://localhost:${PORT}`);
