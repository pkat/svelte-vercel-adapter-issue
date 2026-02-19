import { sequence } from '@sveltejs/kit/hooks';
import { createHandle } from 'flags/sveltekit';
import { logger } from '@repro/server-libs/logger';
import { Config } from '$lib/server/config';
import * as flags from '$lib/server/flags';
import type { Handle, HandleServerError } from '@sveltejs/kit';

const flagsHandle = createHandle({ secret: Config.flagsSecret, flags });

const mainHandle: Handle = async ({ event, resolve }) => {
  logger.info({ path: event.url.pathname }, 'Request received');
  return resolve(event);
};

export const handle = sequence(flagsHandle, mainHandle);

export const handleError: HandleServerError = ({ error, status }) => {
  if (status >= 500) {
    logger.error(error);
  }
  return { message: 'An error occurred' };
};
