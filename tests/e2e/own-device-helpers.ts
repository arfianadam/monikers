import {
  expect,
  type Browser,
  type BrowserContext,
  type Page,
  type TestInfo,
} from '@playwright/test';

const SESSION_URL = /\/session\/[A-Za-z0-9_-]+$/;

export async function createMatchingContext(
  browser: Browser,
  testInfo: TestInfo
): Promise<BrowserContext> {
  const projectUse = testInfo.project.use;

  return browser.newContext({
    baseURL: projectUse.baseURL,
    colorScheme: 'dark',
    deviceScaleFactor: projectUse.deviceScaleFactor,
    hasTouch: projectUse.hasTouch,
    isMobile: projectUse.isMobile,
    locale: 'id-ID',
    reducedMotion: 'reduce',
    viewport: projectUse.viewport,
  });
}

export async function installSoundSpy(target: Page | BrowserContext) {
  await target.addInitScript(() => {
    const playedSounds: string[] = [];
    Object.assign(window, { __playedSounds: playedSounds });
    HTMLMediaElement.prototype.play = function play() {
      playedSounds.push(new URL(this.src).pathname);
      return Promise.resolve();
    };
  });
}

export async function playedSounds(page: Page) {
  return page.evaluate(
    () =>
      (window as Window & { __playedSounds?: string[] }).__playedSounds ?? []
  );
}

export async function createOwnDeviceSession(page: Page, creatorName: string) {
  await page.goto('/');
  await page
    .getByRole('button', { name: 'Buat room untuk device masing-masing' })
    .click();
  await expect(page).toHaveURL(SESSION_URL);
  const sessionPath = new URL(page.url()).pathname;

  const activationHeading = page.getByRole('heading', {
    level: 1,
    name: /Kamu jadi player pertama/,
  });
  await expect(activationHeading).toBeVisible();
  await expect(activationHeading).not.toBeFocused();

  const nameInput = page.getByLabel('Nama kamu');
  await nameInput.fill(creatorName);
  await expect(nameInput).toHaveValue(creatorName);
  const activate = page.getByRole('button', { name: 'Bikin room code' });
  await expect(activate).toBeEnabled();
  await activate.click();

  await expect(
    page.getByRole('heading', { level: 1, name: 'Lobby' })
  ).toBeVisible();
  const codeRegion = page.getByRole('region', { name: 'Room code' });
  const codeOutput = codeRegion.locator('output');
  await expect(codeOutput).toHaveText(/^[A-Z0-9]{6}$/);

  return {
    code: (await codeOutput.innerText()).trim(),
    sessionPath,
  };
}

export async function joinOwnDeviceSession(
  page: Page,
  options: {
    code: string;
    creatorName: string;
    playerName: string;
    sessionPath: string;
    expectedPlayerCount?: number;
    onPreview?: () => Promise<void>;
  }
) {
  await page.goto(`/join/${options.code}`);
  await expect(
    page.getByRole('heading', { level: 1, name: 'Masuk ke room.' })
  ).toBeVisible();
  await expect(
    page.getByText(options.creatorName, { exact: true })
  ).toBeVisible();
  await expect(
    page.getByText(`${options.expectedPlayerCount ?? 1} / 20`, { exact: true })
  ).toBeVisible();
  await options.onPreview?.();

  await page.getByLabel('Namamu').fill(options.playerName);
  await page.getByRole('button', { name: 'Join game' }).click();
  await expect(page).toHaveURL(new RegExp(`${options.sessionPath}$`));
  await expect(
    page.getByRole('heading', { level: 1, name: 'Lobby' })
  ).toBeVisible();
}

function configurationRegion(page: Page) {
  return page.getByRole('region', { name: 'Game setup' });
}

export async function setCardsPerPlayerToOne(
  controllerPage: Page,
  otherPage: Page
) {
  const configuration = configurationRegion(controllerPage);
  const decrease = configuration.getByRole('button', {
    name: 'Kurangi kartu per player',
  });
  const value = configuration.getByRole('spinbutton', {
    name: 'Kartu per player',
  });

  await expect(value).toHaveValue('5');
  for (let cards = 4; cards >= 1; cards -= 1) {
    await decrease.click();
    await expect(value).toHaveValue(String(cards));
  }
  await expect(
    configurationRegion(otherPage).getByRole('definition').nth(1)
  ).toHaveText('1');
}

export async function readyPlayersAndStartSelection(
  controllerPage: Page,
  otherPage: Page
) {
  await controllerPage.getByRole('button', { name: 'Aku ready' }).click();
  await expect(
    controllerPage.getByRole('button', { name: 'Belum ready' })
  ).toBeVisible();

  await otherPage.getByRole('button', { name: 'Aku ready' }).click();
  await expect(
    otherPage.getByRole('button', { name: 'Belum ready' })
  ).toBeVisible();

  const start = controllerPage.getByRole('button', {
    name: 'Mulai pilih kartu',
  });
  await expect(start).toBeEnabled();
  await start.click();

  await expect(
    controllerPage.getByRole('heading', { level: 1, name: 'Pilih favoritmu.' })
  ).toBeVisible();
  await expect(
    otherPage.getByRole('heading', { level: 1, name: 'Pilih favoritmu.' })
  ).toBeVisible();
}

export async function privateOfferWords(page: Page) {
  return page
    .getByRole('main')
    .getByRole('button', { pressed: false })
    .locator('strong')
    .allTextContents();
}

export async function chooseOnePrivateCard(page: Page) {
  const card = page
    .getByRole('main')
    .getByRole('button', { pressed: false })
    .first();
  const word = (await card.locator('strong').innerText()).trim();

  await card.click();
  await expect(
    page.getByRole('main').getByRole('button', { pressed: true })
  ).toHaveCount(1);
  return word;
}

export async function lockBothSelections(
  firstPage: Page,
  secondPage: Page,
  onFirstLocked?: () => Promise<void>
) {
  await firstPage.getByRole('button', { name: 'Lock pilihan' }).click();
  await expect(
    firstPage.getByRole('heading', {
      level: 1,
      name: 'Tinggal tunggu yang lain.',
    })
  ).toBeVisible();
  await expect(
    secondPage.getByRole('heading', {
      level: 2,
      name: 'Siapa yang sudah beres?',
    })
  ).toBeVisible();
  await onFirstLocked?.();

  await secondPage.getByRole('button', { name: 'Lock pilihan' }).click();
}

export async function expectSecretAbsent(page: Page, secretWord: string) {
  await expect(page.getByText(secretWord, { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Benar!' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Skip/ })).toHaveCount(0);
}
