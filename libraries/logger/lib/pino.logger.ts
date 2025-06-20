import { env } from 'node:process';
import {
  pino,
  type DestinationStream,
  type Logger as PinoLoggerImpl,
} from 'pino';
import type { LOG_LEVELS, Logger } from './definition';

export default class PinoLogger implements Logger {
  readonly #logger: PinoLoggerImpl;

  constructor(
    public level: LOG_LEVELS,
    private prettyPrintEnabled: boolean,
    private enableAxiomTransport: boolean,
    private destStream?: DestinationStream | string
  ) {
    this.#logger = pino({
      level,
      transport: {
        targets: [
          ...(enableAxiomTransport
            ? [
                {
                  level: env.LOG_LEVEL,
                  target: '@axiomhq/pino',
                  options: {
                    dataset: env.AXIOM_DATASET,
                    token: env.AXIOM_TOKEN,
                  },
                },
              ]
            : []),
          ...(prettyPrintEnabled
            ? [
                {
                  level: env.LOG_LEVEL,
                  target: 'pino-pretty',
                  options: {
                    colorize: true,
                    sync: true,
                  },
                },
              ]
            : []),
        ],
      },
    });
  }

  debug(message: string, metadata?: object): void {
    if (metadata) {
      this.#logger.debug(metadata, message);
    } else {
      this.#logger.debug(message);
    }
  }

  error(message: string, metadata?: object): void {
    if (metadata) {
      this.#logger.error(metadata, message);
    } else {
      this.#logger.error(message);
    }
  }

  info(message: string, metadata?: object): void {
    if (metadata) {
      this.#logger.info(metadata, message);
    } else {
      this.#logger.info(message);
    }
  }

  warn(message: string, metadata?: object): void {
    if (metadata) {
      this.#logger.warn(metadata, message);
    } else {
      this.#logger.warn(message);
    }
  }

  trace(message: string, metadata?: object): void {
    if (metadata) {
      this.#logger.trace(metadata, message);
    } else {
      this.#logger.trace(message);
    }
  }

  fatal(message: string, metadata?: object): void {
    if (metadata) {
      this.#logger.fatal(metadata, message);
    } else {
      this.#logger.fatal(message);
    }
  }

  silent(message: string, metadata?: object): void {
    if (metadata) {
      this.#logger.silent(metadata, message);
    } else {
      this.#logger.silent(message);
    }
  }
}
