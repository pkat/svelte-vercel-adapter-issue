import { flag } from 'flags/sveltekit';
import { Config } from './config';

export const showBanner = flag<boolean>({
  key: 'show-banner',
  description: 'Show the promotional banner',
  decide() {
    return Config.showBanner;
  },
});

export const enableNewFeature = flag<boolean>({
  key: 'enable-new-feature',
  description: 'Enable the new experimental feature',
  decide() {
    return Config.enableNewFeature;
  },
});
