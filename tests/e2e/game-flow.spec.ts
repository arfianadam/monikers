import {
  expect,
  type Locator,
  type Page,
  type WebSocketRoute,
  test,
} from '@playwright/test';

import { installCommandAcknowledgementDelay } from './websocket-helpers';

const TOTAL_CARDS = 2;
const SESSION_URL = /\/session\/[A-Za-z0-9_-]+$/;
const RECOVERY_HEADINGS = [
  'Sebentar, ya.',
  'Kamu sedang luring.',
  'Ruangan ini sudah hilang.',
];

async function recordHeadingChanges(page: Page) {
  await page.evaluate(() => {
    const history: string[] = [];
    const recordHeading = () => {
      const heading = document.querySelector('h1')?.textContent?.trim();
      if (heading && history.at(-1) !== heading) history.push(heading);
    };

    Object.assign(window, { __sessionHeadingHistory: history });
    new MutationObserver(recordHeading).observe(document.body, {
      childList: true,
      subtree: true,
    });
    recordHeading();
  });
}

async function sessionHeadingHistory(page: Page) {
  return page.evaluate(
    () =>
      (
        window as typeof window & {
          __sessionHeadingHistory: string[];
        }
      ).__sessionHeadingHistory
  );
}

async function widenInitialProjectionRace(page: Page) {
  await page.addInitScript(() => {
    const addEventListener = WebSocket.prototype.addEventListener;

    WebSocket.prototype.addEventListener = function (
      this: WebSocket,
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | AddEventListenerOptions
    ) {
      if (type !== 'message') {
        addEventListener.call(this, type, listener, options);
        return;
      }

      addEventListener.call(
        this,
        type,
        (event: Event) => {
          window.setTimeout(() => {
            if (typeof listener === 'function') listener.call(this, event);
            else listener.handleEvent(event);
          }, 100);
        },
        options
      );
    } as typeof WebSocket.prototype.addEventListener;
  });
}

async function captureStage(page: Page, name: string) {
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  await expect(page).toHaveScreenshot(`${name}.png`, { fullPage: true });
}

async function expectStaticConnectionInTopBar(
  page: Page,
  expectedText = 'Tersambung'
) {
  const header = page.getByRole('banner');
  const connectionStatuses = page.getByRole('status', {
    name: 'Status koneksi',
    includeHidden: true,
  });
  const status = header.getByRole('status', { name: 'Status koneksi' });

  await expect(connectionStatuses).toHaveCount(1);
  await expect(status).toBeVisible();
  await expect(status).toContainText(expectedText);
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
}

async function expectResponsiveHeaderMeta(page: Page, meta: Locator) {
  if ((page.viewportSize()?.width ?? Number.POSITIVE_INFINITY) <= 700) {
    await expect(meta).toBeHidden();
    return;
  }

  await expect(meta).toBeVisible();
}

async function createSingleDeviceSession(page: Page) {
  await page.goto('/');
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'Tebak namanya. Lupakan jaimnya.',
    })
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Buat sesi perangkat masing-masing' })
  ).toBeVisible();
  await expect(page.getByLabel('Kode sesi')).toBeVisible();

  await page.getByRole('button', { name: 'Main di satu perangkat' }).click();
  await expect(page).toHaveURL(SESSION_URL);
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'Atur, lalu main bergantian.',
    })
  ).toBeVisible();

  return new URL(page.url()).pathname;
}

test('pembuatan sesi tidak menampilkan layar pemulihan sementara', async ({
  page,
}) => {
  await widenInitialProjectionRace(page);
  const entryPaths = [
    {
      button: 'Main di satu perangkat',
      destinationHeading: /Atur, lalu main bergantian/,
    },
    {
      button: 'Buat sesi perangkat masing-masing',
      destinationHeading: /Mulai sebagai pemain pertama/,
    },
  ];

  for (const entryPath of entryPaths) {
    await page.goto('/');
    await recordHeadingChanges(page);
    await page.getByRole('button', { name: entryPath.button }).click();
    await expect(
      page.getByRole('heading', {
        level: 1,
        name: entryPath.destinationHeading,
      })
    ).toBeVisible();

    expect(
      (await sessionHeadingHistory(page)).filter((heading) =>
        RECOVERY_HEADINGS.includes(heading)
      )
    ).toEqual([]);
  }
});

test('sesi dapat diakhiri sebelum permainan dimulai', async ({ page }) => {
  const entryPaths = [
    {
      button: 'Main di satu perangkat',
      destinationHeading: /Atur, lalu main bergantian/,
    },
    {
      button: 'Buat sesi perangkat masing-masing',
      destinationHeading: /Mulai sebagai pemain pertama/,
    },
  ];

  for (const entryPath of entryPaths) {
    await page.goto('/');
    await page.getByRole('button', { name: entryPath.button }).click();
    await expect(page).toHaveURL(SESSION_URL);
    await expect(
      page.getByRole('heading', {
        level: 1,
        name: entryPath.destinationHeading,
      })
    ).toBeVisible();

    await page
      .getByRole('button', { name: 'Akhiri sesi', exact: true })
      .click();
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: 'Akhiri sesi', exact: true })
      .click();

    await expect(page).toHaveURL('/');
    await expect(
      page.getByRole('heading', {
        name: 'Tebak namanya. Lupakan jaimnya.',
      })
    ).toBeVisible();
  }
});

test('perubahan pengaturan tidak menonaktifkan seluruh form', async ({
  page,
}) => {
  await installCommandAcknowledgementDelay(page);
  await createSingleDeviceSession(page);

  const playersInput = page.getByRole('spinbutton', {
    name: 'Pemain',
    exact: true,
  });
  const cardsInput = page.getByRole('spinbutton', {
    name: 'Kartu per pemain',
    exact: true,
  });
  const startButton = page.getByRole('button', { name: 'Mulai bermain' });

  await playersInput.fill('5');
  await expect(page.getByText('25 kartu dalam deck')).toBeVisible();

  expect(
    await Promise.all([
      playersInput.isEnabled(),
      cardsInput.isEnabled(),
      startButton.isEnabled(),
    ])
  ).toEqual([true, true, true]);
});

test('status koneksi tetap statis saat memuat dan memulihkan sesi', async ({
  page,
}) => {
  let rejectSessionSockets = false;
  let resolveSessionSocket!: (socket: WebSocketRoute) => void;
  const sessionSocket = new Promise<WebSocketRoute>((resolve) => {
    resolveSessionSocket = resolve;
  });

  await page.routeWebSocket(/\/session\/[^/]+\/live$/, (socket) => {
    if (rejectSessionSockets) {
      void socket.close();
      return;
    }

    const serverSocket = socket.connectToServer();
    serverSocket.onMessage(() => undefined);
    resolveSessionSocket(socket);
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Main di satu perangkat' }).click();
  await expect(page.locator('[aria-busy="true"]')).toBeVisible();
  await expectStaticConnectionInTopBar(page);

  rejectSessionSockets = true;
  await (await sessionSocket).close();

  await expect(
    page.getByRole('heading', { level: 1, name: 'Kamu sedang luring.' })
  ).toBeVisible();
  await expectStaticConnectionInTopBar(page, 'Koneksi terputus');

  const status = page
    .getByRole('banner')
    .getByRole('status', { name: 'Status koneksi' });
  await expect(status.getByRole('button', { name: 'Coba lagi' })).toHaveCount(
    0
  );
  await expect(page.getByRole('button', { name: 'Coba lagi' })).toHaveCount(1);
  await expect(
    page.getByRole('main').getByRole('button', { name: 'Coba lagi' })
  ).toBeInViewport({ ratio: 1 });
});

async function configureGame(
  page: Page,
  players: number,
  cardsPerPlayer: number
) {
  const playersInput = page.getByRole('spinbutton', {
    name: 'Pemain',
    exact: true,
  });
  const cardsInput = page.getByRole('spinbutton', {
    name: 'Kartu per pemain',
    exact: true,
  });

  await playersInput.fill(String(players));
  await expect(cardsInput).toBeEnabled();
  await cardsInput.fill(String(cardsPerPlayer));
  await expect(
    page.getByRole('button', { name: 'Mulai bermain' })
  ).toBeEnabled();
  await expect(
    page.getByText(`${players * cardsPerPlayer} kartu dalam deck`)
  ).toBeVisible();
}

async function chooseCards(page: Page, count: number) {
  for (let cardIndex = 0; cardIndex < count; cardIndex += 1) {
    const card = page.getByRole('button', { pressed: false }).first();

    await expect(card).toBeVisible();
    await card.click();
    await expect(page.getByRole('button', { pressed: true })).toHaveCount(
      cardIndex + 1
    );
  }
}

async function completeSingleDeviceSelection(
  page: Page,
  cardsPerPlayer: number
) {
  for (let player = 1; player <= 2; player += 1) {
    await page.getByRole('button', { name: 'Buka kartuku' }).click();
    await chooseCards(page, cardsPerPlayer);
    await page
      .getByRole('button', {
        name: player === 1 ? 'Serahkan ke pemain berikutnya' : 'Selesai',
      })
      .click();
  }
}

async function completeActiveTurn(page: Page) {
  const correctButton = page.getByRole('button', { name: 'Benar!' });

  for (let cardIndex = 0; cardIndex < TOTAL_CARDS; cardIndex += 1) {
    await expect(correctButton).toBeEnabled();
    await correctButton.click();

    if (cardIndex < TOTAL_CARDS - 1) {
      await expect(correctButton).toBeDisabled();
      await expect(correctButton).toBeEnabled({ timeout: 3_000 });
    }
  }
}

async function playRound(page: Page, round: number) {
  await expectResponsiveHeaderMeta(
    page,
    page.getByLabel(`Babak ${round} dari 3`)
  );
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: new RegExp(`Tim 1,\\s*giliranmu\\.`),
    })
  ).toBeVisible();
  await expectStaticConnectionInTopBar(page);

  await page.getByRole('button', { name: 'Mulai giliran 60 detik' }).click();
  await expect(page.getByLabel(/\d+ detik tersisa/)).toBeVisible();
  await expectStaticConnectionInTopBar(page);
  await completeActiveTurn(page);
}

test('dua pemain menyelesaikan tiga babak dan sesi pulih setelah refresh', async ({
  page,
}) => {
  const sessionPath = await createSingleDeviceSession(page);
  await configureGame(page, 2, 1);
  await expectStaticConnectionInTopBar(page);
  await captureStage(page, '01-setup');

  page.on('dialog', (dialog) => void dialog.accept());
  await page.reload();
  await expect(page).toHaveURL(new RegExp(`${sessionPath}$`));
  await expect(
    page.getByRole('spinbutton', { name: 'Pemain', exact: true })
  ).toHaveValue('2');
  await expect(
    page.getByRole('spinbutton', { name: 'Kartu per pemain', exact: true })
  ).toHaveValue('1');

  await page.getByRole('button', { name: 'Mulai bermain' }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Serahkan perangkatnya' })
  ).toBeVisible();
  await expectResponsiveHeaderMeta(
    page,
    page.getByLabel('Progres pemilihan kartu: pemain 1 dari 2')
  );
  await expectStaticConnectionInTopBar(page);
  await captureStage(page, '02-private-handoff');

  await page.getByRole('button', { name: 'Buka kartuku' }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Pilih favoritmu' })
  ).toBeVisible();
  await expectResponsiveHeaderMeta(page, page.getByText('0 / 1 dipilih'));
  await expectStaticConnectionInTopBar(page);
  await captureStage(page, '03-card-picker');

  await chooseCards(page, 1);
  await page
    .getByRole('button', { name: 'Serahkan ke pemain berikutnya' })
    .click();
  await expect(
    page.getByText('Pemain 2, pilihanmu rahasia.', { exact: false })
  ).toBeVisible();
  await page.getByRole('button', { name: 'Buka kartuku' }).click();
  await chooseCards(page, 1);
  await page.getByRole('button', { name: 'Selesai' }).click();

  await expect(
    page.getByRole('heading', {
      level: 1,
      name: /Tim 1,\s*giliranmu\./,
    })
  ).toBeVisible();
  await expectResponsiveHeaderMeta(page, page.getByLabel('Babak 1 dari 3'));
  await expectStaticConnectionInTopBar(page);
  await captureStage(page, '04-turn-handoff');

  await page.getByRole('button', { name: 'Mulai giliran 60 detik' }).click();
  await expect(page.getByLabel(/\d+ detik tersisa/)).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expectStaticConnectionInTopBar(page);
  await captureStage(page, '05-active-turn');
  await completeActiveTurn(page);

  await expect(
    page.getByRole('heading', { level: 1, name: 'Babak 1 telah usai.' })
  ).toBeVisible();
  await expect(page.getByRole('region', { name: 'Skor tim' })).toBeVisible();
  await expect(page.getByText('1 / 3 selesai')).toBeVisible();
  await expectStaticConnectionInTopBar(page);
  await captureStage(page, '06-round-score');

  await page.getByRole('button', { name: 'Mulai babak berikutnya' }).click();
  await playRound(page, 2);
  await expect(
    page.getByRole('heading', { level: 1, name: 'Babak 2 telah usai.' })
  ).toBeVisible();
  await expect(page.getByText('2 / 3 selesai')).toBeVisible();

  await page.getByRole('button', { name: 'Mulai babak berikutnya' }).click();
  await playRound(page, 3);

  await expect(page.getByText('Skor akhir')).toBeVisible();
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'Tim 1 merebut mahkota.',
    })
  ).toBeVisible();
  await expect(page.getByText('3 / 3 selesai')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Main lagi' })).toBeVisible();
  await expectStaticConnectionInTopBar(page);
  await captureStage(page, '07-final-score');
});

test('deadline server memindahkan giliran dan suara hanya dipicu setelah diterima', async ({
  page,
}) => {
  test.setTimeout(100_000);
  await page.addInitScript(() => {
    const playedSounds: string[] = [];
    Object.assign(window, { __playedSounds: playedSounds });
    HTMLMediaElement.prototype.play = function play() {
      playedSounds.push(new URL(this.src).pathname);
      return Promise.resolve();
    };
  });

  await createSingleDeviceSession(page);
  await configureGame(page, 2, 2);
  await page.getByRole('button', { name: 'Mulai bermain' }).click();
  await completeSingleDeviceSelection(page, 2);

  await page.getByRole('button', { name: 'Mulai giliran 60 detik' }).click();
  const skipButton = page.getByRole('button', { name: 'Lewati' });
  await skipButton.click();
  await expect(
    page.getByRole('button', { name: 'Sudah digunakan' })
  ).toBeDisabled();

  await page.getByRole('button', { name: 'Benar!' }).click();
  await expect(page.getByRole('button', { name: 'Lewati' })).toBeEnabled();

  await expect(
    page.getByRole('heading', { level: 1, name: /Tim 2,\s*giliranmu\./ })
  ).toBeVisible({ timeout: 65_000 });
  await page.getByRole('button', { name: 'Mulai giliran 60 detik' }).click();
  await page.getByRole('button', { name: 'Akhiri giliran lebih awal' }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: /Tim 1,\s*giliranmu\./ })
  ).toBeVisible();

  const playedSounds = await page.evaluate(
    () =>
      (window as Window & { __playedSounds?: string[] }).__playedSounds ?? []
  );
  expect(playedSounds).toContain('/sounds/bell.wav');
  expect(
    playedSounds.filter((sound) => sound === '/sounds/ring.wav')
  ).toHaveLength(2);
});
