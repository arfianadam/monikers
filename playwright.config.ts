import { defineConfig } from '@playwright/test';

const baseURL = 'http://127.0.0.1:3000';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  workers: 4,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  outputDir: 'test-results/playwright',
  snapshotPathTemplate:
    '{testDir}/__screenshots__/{projectName}/{testFilePath}/{arg}{ext}',
  expect: {
    timeout: 5_000,
    toHaveScreenshot: {
      animations: 'disabled',
      caret: 'hide',
      maxDiffPixelRatio: 0.005,
    },
  },
  use: {
    baseURL,
    colorScheme: 'dark',
    contextOptions: {
      reducedMotion: 'reduce',
    },
    locale: 'id-ID',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'desktop-chromium',
      testMatch: /game-flow\.spec\.ts/,
      use: {
        browserName: 'chromium',
        deviceScaleFactor: 1,
        viewport: { width: 1440, height: 1000 },
      },
    },
    {
      name: 'mobile-chromium',
      testMatch: /game-flow\.spec\.ts/,
      use: {
        browserName: 'chromium',
        deviceScaleFactor: 1,
        hasTouch: true,
        isMobile: true,
        viewport: { width: 390, height: 844 },
      },
    },
    {
      name: 'narrow-mobile-chromium',
      testMatch: /responsive-layout\.spec\.ts/,
      use: {
        browserName: 'chromium',
        deviceScaleFactor: 1,
        hasTouch: true,
        isMobile: true,
        viewport: { width: 360, height: 800 },
      },
    },
    {
      name: 'short-portrait-chromium',
      testMatch: /responsive-layout\.spec\.ts/,
      use: {
        browserName: 'chromium',
        deviceScaleFactor: 1,
        hasTouch: true,
        isMobile: true,
        viewport: { width: 390, height: 680 },
      },
    },
    {
      name: 'landscape-chromium',
      testMatch: /responsive-layout\.spec\.ts/,
      use: {
        browserName: 'chromium',
        deviceScaleFactor: 1,
        hasTouch: true,
        isMobile: true,
        viewport: { width: 844, height: 390 },
      },
    },
    {
      name: 'narrow-landscape-chromium',
      testMatch: /responsive-layout\.spec\.ts/,
      use: {
        browserName: 'chromium',
        deviceScaleFactor: 1,
        hasTouch: true,
        isMobile: true,
        viewport: { width: 540, height: 360 },
      },
    },
    {
      name: 'short-desktop-chromium',
      testMatch: /responsive-layout\.spec\.ts/,
      use: {
        browserName: 'chromium',
        deviceScaleFactor: 1,
        viewport: { width: 1024, height: 700 },
      },
    },
    {
      name: 'own-device-webkit',
      testMatch: /own-device-webkit\.spec\.ts/,
      use: {
        browserName: 'webkit',
        deviceScaleFactor: 1,
        hasTouch: true,
        isMobile: true,
        viewport: { width: 360, height: 800 },
      },
    },
    {
      name: 'own-device-chromium',
      testMatch: /own-device\.spec\.ts/,
      use: {
        browserName: 'chromium',
        deviceScaleFactor: 1,
        viewport: { width: 1280, height: 900 },
      },
    },
  ],
  webServer: {
    command: 'pnpm start',
    env: { MONIKERS_TEST_SEED: 'playwright-monikers', PORT: '3000' },
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
    gracefulShutdown: { signal: 'SIGTERM', timeout: 5_000 },
  },
});
