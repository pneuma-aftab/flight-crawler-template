import { createEnv } from '@pneuma/configuration-provider';
import { z } from 'zod';

export const env = createEnv({
  server: {
    PRETTY_PRINT: z.union([z.literal('YES'), z.literal('NO')]),
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
  },
  /**
   * What object holds the environment variables at runtime.
   * Often `process.env` or `import.meta.env`
   */
  runtimeEnv: process.env,
});
