import Pino from 'pino';
import { serializeError } from 'serialize-error';

const options: Pino.LoggerOptions = {
  base: undefined,
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'debug' : 'info'),
  messageKey: 'body',
  errorKey: 'error',
  serializers: {
    error: function (err) {
      return serializeError(err, { maxDepth: 3 });
    },
  },
  timestamp: false,
  formatters: {
    level: function (label) {
      return { level: label };
    },
  },
};

export const logger: Pino.BaseLogger = Pino(options);
