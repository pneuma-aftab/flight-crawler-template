import { esbuildPluginPino } from '@pneuma/esbuild-plugin-pino';
import { build } from 'esbuild';

build({
  entryPoints: ['src/entry-points/api/server.ts'],
  platform: 'node',
  sourcemap: true,
  bundle: true,
  format: 'cjs',
  outdir: '.dist',
  // packages: 'external',
  external: ['crawlee', 'puppeteer'],
  plugins: [
    esbuildPluginPino({ transports: ['pino-pretty', '@axiomhq/pino'] }),
  ],
}).catch(() => process.exit(1));
