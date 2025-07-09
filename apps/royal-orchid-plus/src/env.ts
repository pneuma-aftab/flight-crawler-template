import { createEnv } from '@pneuma/configuration-provider';
import type { LOG_LEVELS } from '@pneuma/logger';
import { z } from 'zod';
import {config} from 'dotenv'
config()



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
    MAILSOUR_API: z.string()
  },
  /**
   * What object holds the environment variables at runtime.
   * Often `process.env` or `import.meta.env`
   */
  runtimeEnv: process.env,
});
