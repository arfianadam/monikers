import {
  expect,
  type Locator,
  type Page,
  type WebSocketRoute,
  test,
} from '@playwright/test';

import { expectVisualFontsLoaded } from './visual-helpers';

interface HorizontalBounds {
  width: number;
  x: number;
}

interface HorizontalPadding {
  left: string;
  right: string;
}

interface HeadingTreatment {
  fontSize: string;
  wrapperMarginBottom: string;
}

async function horizontalBounds(locator: Locator): Promise<HorizontalBounds> {
  const bounds = await locator.boundingBox();

  expect(bounds).not.toBeNull();

  return {
    width: bounds?.width ?? 0,
    x: bounds?.x ?? 0,
  };
}

function expectHorizontallyAligned(
  actual: HorizontalBounds,
  expected: HorizontalBounds
) {
  expect(actual.x).toBeCloseTo(expected.x, 1);
  expect(actual.width).toBeCloseTo(expected.width, 1);
}

async function horizontalPadding(locator: Locator): Promise<HorizontalPadding> {
  return locator.evaluate((element) => {
    const styles = getComputedStyle(element);

    return {
      left: styles.paddingLeft,
      right: styles.paddingRight,
    };
  });
}

async function headingTreatment(locator: Locator): Promise<HeadingTreatment> {
  return locator.evaluate((heading) => ({
    fontSize: getComputedStyle(heading).fontSize,
    wrapperMarginBottom: heading.parentElement
      ? getComputedStyle(heading.parentElement).marginBottom
      : '0px',
  }));
}

async function chooseCard(page: Page) {
  await page.getByRole('button', { pressed: false }).first().click();
  await expect(page.getByRole('button', { pressed: true })).toHaveCount(1);
}

async function installSessionSocketGate(page: Page) {
  let blocked = false;
  let currentSocket: WebSocketRoute | null = null;

  await page.routeWebSocket(/\/session\/[^/]+\/live$/, (socket) => {
    if (blocked) {
      void socket.close();
      return;
    }

    currentSocket = socket;
    socket.connectToServer();
  });

  return {
    allow() {
      blocked = false;
    },
    async block() {
      blocked = true;
      if (!currentSocket) throw new Error('Socket sesi belum tersambung.');
      await currentSocket.close();
    },
  };
}

async function expectStaticConnectionLayout(
  page: Page,
  options: { activeTurn?: boolean; disconnected?: boolean } = {}
) {
  const allStatuses = page.getByRole('status', {
    name: 'Status koneksi',
    includeHidden: true,
  });
  const header = page.getByRole('banner');
  const status = header.getByRole('status', { name: 'Status koneksi' });

  await expect(allStatuses).toHaveCount(1);
  await expect(status).toBeVisible();
  await expect(status).toHaveCSS('position', 'static');
  await expect(status).toBeInViewport({ ratio: 1 });
  await expect
    .poll(async () => {
      const [headerBox, statusBox] = await Promise.all([
        header.boundingBox(),
        status.boundingBox(),
      ]);
      if (!headerBox || !statusBox) return Number.POSITIVE_INFINITY;
      return Math.abs(
        statusBox.x + statusBox.width - (headerBox.x + headerBox.width)
      );
    })
    .toBeLessThanOrEqual(1);

  const overflow = await page.evaluate(() => ({
    body: document.body.scrollWidth - document.documentElement.clientWidth,
    document:
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  }));
  expect(overflow.body).toBeLessThanOrEqual(0);
  expect(overflow.document).toBeLessThanOrEqual(0);

  const brand = header.getByText('Monikers', { exact: true });
  if (await brand.isVisible()) {
    const [brandBox, statusBox] = await Promise.all([
      brand.boundingBox(),
      status.boundingBox(),
    ]);
    expect(
      brandBox &&
        statusBox &&
        brandBox.x < statusBox.x + statusBox.width &&
        brandBox.x + brandBox.width > statusBox.x &&
        brandBox.y < statusBox.y + statusBox.height &&
        brandBox.y + brandBox.height > statusBox.y
    ).toBe(false);
  }

  if (options.activeTurn) {
    const [headerBox, cardBox] = await Promise.all([
      header.boundingBox(),
      page.getByRole('article').boundingBox(),
    ]);
    expect(headerBox).not.toBeNull();
    expect(cardBox).not.toBeNull();
    expect((headerBox?.y ?? 0) + (headerBox?.height ?? 0)).toBeLessThanOrEqual(
      cardBox?.y ?? 0
    );
  }

  if (options.disconnected) {
    await expect(status).toContainText('Koneksi terputus');
    await expect(
      status.getByRole('button', { name: 'Coba lagi' })
    ).toBeInViewport({ ratio: 1 });
  }
}

async function reachActiveTurn(
  page: Page,
  expectedPanelBounds: HorizontalBounds,
  expectedPanelPadding: HorizontalPadding,
  expectedHeadingTreatment: HeadingTreatment,
  onSetup?: () => Promise<void>
) {
  await page.getByRole('button', { name: 'Main di satu perangkat' }).click();
  await expect(page).toHaveURL(/\/session\/[A-Za-z0-9_-]+$/);
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'Atur, lalu main bergantian.',
    })
  ).toBeVisible();
  await expect(
    page.getByText(
      'Tentukan jumlah pemain dan kartu. Setelah mulai, oper perangkat kepada tiap pemain supaya mereka dapat memilih kartu secara rahasia.'
    )
  ).toBeAttached();

  const setupPanel = page.getByRole('region', {
    name: 'Pengaturan permainan',
  });

  expectHorizontallyAligned(
    await horizontalBounds(setupPanel),
    expectedPanelBounds
  );
  expect(await horizontalPadding(setupPanel)).toEqual(expectedPanelPadding);
  expect(
    await headingTreatment(
      setupPanel.getByRole('heading', { name: 'Susun deck-mu' })
    )
  ).toEqual(expectedHeadingTreatment);
  await expect(page.getByText('№ 001', { exact: true })).toHaveCount(0);
  await onSetup?.();

  await page.getByRole('spinbutton', { name: 'Pemain', exact: true }).fill('2');
  await expect(
    page.getByRole('spinbutton', { name: 'Kartu per pemain', exact: true })
  ).toBeEnabled();
  await page
    .getByRole('spinbutton', { name: 'Kartu per pemain', exact: true })
    .fill('1');
  await page.getByRole('button', { name: 'Mulai bermain' }).click();

  await page.getByRole('button', { name: 'Buka kartuku' }).click();
  await chooseCard(page);
  await page.getByRole('button', { name: 'Lanjut' }).click();
  await page.getByRole('button', { name: 'Buka kartuku' }).click();
  await chooseCard(page);
  await page.getByRole('button', { name: 'Selesai' }).click();
  await page.getByRole('button', { name: 'Mulai giliran 60 detik' }).click();
  await expect(page.getByLabel(/\d+ detik tersisa/)).toBeVisible();
}

test('layout khusus tetap terbaca dan stabil', async ({ page }, testInfo) => {
  const socketGate = await installSessionSocketGate(page);
  await page.goto('/');
  await expectVisualFontsLoaded(page);

  const eyebrowDot = page
    .getByText('Calon permainan favorit di acara kumpulmu', { exact: true })
    .locator('span');
  const eyebrowDotBox = await eyebrowDot.boundingBox();
  expect(eyebrowDotBox).not.toBeNull();
  expect(eyebrowDotBox?.width).toBe(eyebrowDotBox?.height);

  const homeScreenshotName =
    testInfo.project.name === 'narrow-mobile-chromium'
      ? 'setup-360.png'
      : 'home.png';
  await expect(page).toHaveScreenshot(homeScreenshotName, { fullPage: true });

  const homePanel = page.getByRole('region', { name: 'Semua siap?' });
  const homePanelBounds = await horizontalBounds(homePanel);
  const homePanelPadding = await horizontalPadding(homePanel);
  const homeHeadingTreatment = await headingTreatment(
    homePanel.getByRole('heading', { name: 'Semua siap?' })
  );

  await page
    .getByRole('button', { name: 'Buat sesi perangkat masing-masing' })
    .click();
  await expect(page).toHaveURL(/\/session\/[A-Za-z0-9_-]+$/);
  expectHorizontallyAligned(
    await horizontalBounds(page.getByRole('region', { name: 'Siapa namamu?' })),
    homePanelBounds
  );

  await page.goto('/');
  await reachActiveTurn(
    page,
    homePanelBounds,
    homePanelPadding,
    homeHeadingTreatment,
    async () => {
      await socketGate.block();
      await expectStaticConnectionLayout(page, { disconnected: true });
      socketGate.allow();
      await page
        .getByRole('status', { name: 'Status koneksi' })
        .getByRole('button', { name: 'Coba lagi' })
        .click();
      await expect(
        page.getByRole('status', { name: 'Status koneksi' })
      ).toContainText('Tersambung');
      await expectStaticConnectionLayout(page);
    }
  );
  await expectVisualFontsLoaded(page);
  await expect(page).toHaveScreenshot('active-turn.png', { fullPage: true });
  await expectStaticConnectionLayout(page, { activeTurn: true });
  await socketGate.block();
  await expectStaticConnectionLayout(page, {
    activeTurn: true,
    disconnected: true,
  });
});
