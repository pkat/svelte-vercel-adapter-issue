import { formatDate } from '@repro/client-utils';

export function load() {
  return {
    serverTime: formatDate(new Date()),
  };
}
