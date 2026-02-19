import * as env from '$env/static/private';

export const Config = {
  flagsSecret: env.FLAGS_SECRET || 'default-secret',
  showBanner: env.SHOW_BANNER === 'true',
  enableNewFeature: env.ENABLE_NEW_FEATURE === 'true',
  nodeEnv: env.NODE_ENV || 'development',
};
