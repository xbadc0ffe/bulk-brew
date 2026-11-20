import type { CapacitorConfig } from '@capacitor/cli';

// The iOS app wraps the built web app. Build it with BASE_PATH unset (/) before cap sync.
const config: CapacitorConfig = {
  appId: 'com.badc0ffe.bulkbrew',
  appName: 'Bulk Brew',
  webDir: 'dist',
  ios: {
    // A long press on a link would otherwise open a web page preview.
    allowsLinkPreview: false,
  },
};

export default config;
