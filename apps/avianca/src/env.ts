import { createEnv } from '@pneuma/configuration-provider';
import type { LOG_LEVELS } from '@pneuma/logger';
import { z } from 'zod';

import dotenv from 'dotenv';
dotenv.config();


export const env = createEnv({
  server: {
    PRETTY_PRINT: z.union([z.literal('YES'), z.literal('NO')]),
    PORT: z.preprocess(Number, z.number()),
    PROXY_HOST: z.string(),
    PROXY_PASSWORD: z.string(),
    PROXY_USERNAME: z.string(),
    PROXY_PORT: z.string().pipe(z.coerce.number()),
    PROXY_SESSION_TIME: z
      .string()
      .pipe(z.coerce.number())
      .optional()
      .default('10'),
    PROXY_SESSION_ID_PREFIX: z.string(),
    SESSION_COUNT: z.string().pipe(z.coerce.number()).optional().default('10'),
    REWARD_SEAT_TRACKER_ENDPOINT: z.string().url(),
    LOG_LEVEL: z.custom<LOG_LEVELS>().default('info'),
    CRAWLEE_LOG_LEVEL: z.custom<LOG_LEVELS>().default('info'),
    SERVICE_NAMESPACE: z.string().optional(),
    AXIOM_TOKEN: z.string().optional(),
    AXIOM_DATASET: z.string().optional(),
    SERVICE_NAME: z.string(),
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    // Avianca specific environment variables
    AVIANCA_AUTHORIZATION_CODE: z.string().describe('Avianca authorization code for token refresh').default('eyJhbGciOiJIUzUxMiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICI3YzQxZjgwOC1kMGEyLTQxMjQtYWVhNC03N2M0ZTRiNzAwNzMifQ.eyJleHAiOjE3NTk1NzQ0MzQsImlhdCI6MTc1MTg4NzM1MiwianRpIjoiMDIzOGQzOTEtOTMyMS00MjFhLTg5ZDAtMThjOWUyMDJlZmM1IiwiaXNzIjoiaHR0cHM6Ly9zc28ubGlmZW1pbGVzLmNvbS9hdXRoL3JlYWxtcy9saWZlbWlsZXMiLCJhdWQiOiJodHRwczovL3Nzby5saWZlbWlsZXMuY29tL2F1dGgvcmVhbG1zL2xpZmVtaWxlcyIsInR5cCI6IlJlZnJlc2giLCJhenAiOiJsaWZlbWlsZXMiLCJzaWQiOiJmMjZlZGU4ZC0wNzgxLTQ1YzQtYjU2ZS0xNjVkMzU1Y2Y5NWMiLCJzY29wZSI6Im9wZW5pZCByb2xlcyBlbWFpbCB3ZWItb3JpZ2lucyBwcm9maWxlIGxpZmVtaWxlcy1tcCJ9.Cre_bSzSLyF9btsb7Jgv6AdSu7TYm4LrfPs_LNUyyXNNW9DZMFqdZU5GDIGjRiVfumfH3dwqVZbFNZKu_n19cQ'),
  },
  /**
   * What object holds the environment variables at runtime.
   * Often `process.env` or `import.meta.env`
   */
  runtimeEnv: process.env,
});