import { logger } from '@repro/server-libs/logger';
import type { Handle, HandleServerError } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
  logger.info({ path: event.url.pathname }, 'Request received');
  return resolve(event);
};

export const handleError: HandleServerError = ({ error, status }) => {
  if (status >= 500) {
    logger.error(error);
  }
  return { message: 'An error occurred' };
};
