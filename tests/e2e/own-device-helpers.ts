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
    .getByRole('button', { name: 'Buat sesi perangkat masing-masing' })
    .click();
  await expect(page).toHaveURL(SESSION_URL);
  const sessionPath = new URL(page.url()).pathname;

  const activationHeading = page.getByRole('heading', {
    level: 1,
    name: /Mulai sebagai pemain pertama/,
  });
  await expect(activationHeading).toBeVisible();
  await expect(activationHeading).toBeFocused();

  const nameInput = page.getByLabel('Nama pemain');
  await nameInput.fill(creatorName);
  await expect(nameInput).toHaveValue(creatorName);
  const activate = page.getByRole('button', { name: 'Buat kode sesi' });
  await expect(activate).toBeEnabled();
  await activate.click();

  await expect(
    page.getByRole('heading', { level: 1, name: 'Susun kedua tim.' })
  ).toBeVisible();
  const codeRegion = page.getByRole('region', { name: 'Kode sesi' });
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
    page.getByRole('heading', { level: 1, name: 'Masuk ke ruangan.' })
  ).toBeVisible();
  await expect(
    page.getByText(options.creatorName, { exact: true })
  ).toBeVisible();
  await expect(
    page.getByText(`${options.expectedPlayerCount ?? 1} / 20`, { exact: true })
  ).toBeVisible();
  await options.onPreview?.();

  await page.getByLabel('Namamu').fill(options.playerName);
  await page.getByRole('button', { name: 'Gabung ke sesi' }).click();
  await expect(page).toHaveURL(new RegExp(`${options.sessionPath}$`));
  await expect(
    page.getByRole('heading', { level: 1, name: 'Susun kedua tim.' })
  ).toBeVisible();
}

function configurationRegion(page: Page) {
  return page.getByRole('region', { name: 'Pengaturan permainan' });
}

export async function setCardsPerPlayerToOne(
  controllerPage: Page,
  otherPage: Page
) {
  const configuration = configurationRegion(controllerPage);
  const decrease = configuration.getByRole('button', {
    name: 'Kurangi kartu per pemain',
  });
  const value = configuration.getByRole('status');

  await expect(value).toHaveText('5');
  for (let cards = 4; cards >= 1; cards -= 1) {
    await decrease.click();
    await expect(value).toHaveText(String(cards));
  }
  await expect(
    configurationRegion(otherPage).getByRole('definition').nth(1)
  ).toHaveText('1');
}

export async function readyPlayersAndStartSelection(
  controllerPage: Page,
  otherPage: Page
) {
  await controllerPage.getByRole('button', { name: 'Saya siap' }).click();
  await expect(
    controllerPage.getByRole('button', { name: 'Batalkan siap' })
  ).toBeVisible();

  await otherPage.getByRole('button', { name: 'Saya siap' }).click();
  await expect(
    otherPage.getByRole('button', { name: 'Batalkan siap' })
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
    .getByRole('button', { pressed: false })
    .locator('strong')
    .allTextContents();
}

export async function chooseOnePrivateCard(page: Page) {
  const card = page.getByRole('button', { pressed: false }).first();
  const word = (await card.locator('strong').innerText()).trim();

  await card.click();
  await expect(page.getByRole('button', { pressed: true })).toHaveCount(1);
  return word;
}

export async function lockBothSelections(
  firstPage: Page,
  secondPage: Page,
  onFirstLocked?: () => Promise<void>
) {
  await firstPage.getByRole('button', { name: 'Kunci pilihan' }).click();
  await expect(
    firstPage.getByRole('heading', { level: 1, name: 'Tunggu yang lain.' })
  ).toBeVisible();
  await expect(
    secondPage.getByRole('heading', {
      level: 2,
      name: 'Siapa yang sudah selesai?',
    })
  ).toBeVisible();
  await onFirstLocked?.();

  await secondPage.getByRole('button', { name: 'Kunci pilihan' }).click();
}

export async function expectSecretAbsent(page: Page, secretWord: string) {
  await expect(page.getByText(secretWord, { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Benar!' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Lewati/ })).toHaveCount(0);
}
