import type { BaseLogger } from 'pino';

export type LOG_LEVELS = 'debug' | 'info' | 'warn' | 'error' | 'critical';

export interface Logger extends Pick<BaseLogger, 'level'> {
  info(message: string, metadata?: object): void;
  error(message: string, metadata?: object): void;
  debug(message: string, metadata?: object): void;
  warn(message: string, metadata?: object): void;
  trace(message: string, metadata?: object): void;
  silent(message: string, metadata?: object): void;
  fatal(message: string, metadata?: object): void;
}

export interface LoggerConfiguration {
  level: LOG_LEVELS;
  prettyPrint: boolean;
  enableAxiomTransport: boolean;
}
