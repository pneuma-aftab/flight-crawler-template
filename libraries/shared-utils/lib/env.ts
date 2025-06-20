import { createEnv } from '@pneuma/configuration-provider';
import { z } from 'zod';

export const env = createEnv({
  server: {
    PRETTY_PRINT: z.union([z.literal('YES'), z.literal('NO')]),
    REWARD_SEAT_TRACKER_ENDPOINT: z.string().url(),
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
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
  },
  /**
   * What object holds the environment variables at runtime.
   * Often `process.env` or `import.meta.env`
   */
  runtimeEnv: process.env,
});
