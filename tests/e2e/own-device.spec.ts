import {
  expect,
  type BrowserContext,
  type Locator,
  type Page,
  type WebSocketRoute,
  test,
} from '@playwright/test';

import {
  chooseOnePrivateCard,
  createMatchingContext,
  createOwnDeviceSession,
  expectSecretAbsent,
  installSoundSpy,
  joinOwnDeviceSession,
  lockBothSelections,
  playedSounds,
  privateOfferWords,
  readyPlayersAndStartSelection,
  setCardsPerPlayerToOne,
} from './own-device-helpers';
import {
  installCommandAcknowledgementDelay,
  setCommandAcknowledgementDelay,
} from './websocket-helpers';
import { expectVisualFontsLoaded } from './visual-helpers';

async function capture(
  page: Page,
  name: string,
  mask: Locator[] = [],
  fullPage = false
) {
  await page.bringToFront();
  await expectVisualFontsLoaded(page);
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      })
  );
  const viewport = await page.evaluate(() => ({
    bodyOverflow:
      document.body.scrollWidth - document.documentElement.clientWidth,
    documentOverflow:
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
    scrollX: window.scrollX,
  }));
  expect(viewport.scrollX).toBe(0);
  expect(viewport.bodyOverflow).toBeLessThanOrEqual(0);
  expect(viewport.documentOverflow).toBeLessThanOrEqual(0);
  await expect(page).toHaveScreenshot(name, {
    animations: 'allow',
    fullPage,
    mask,
  });
}

async function captureRegion(page: Page, region: Locator, name: string) {
  await page.bringToFront();
  await expectVisualFontsLoaded(page);
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      })
  );
  const visualScope = await page.addStyleTag({
    content: '[aria-label="Menu sesi"] { visibility: hidden !important; }',
  });
  try {
    await expect(region).toHaveScreenshot(name, { animations: 'allow' });
  } finally {
    await visualScope.evaluate((element) =>
      element.parentNode?.removeChild(element)
    );
  }
}

async function requireBoundingBox(locator: Locator, description: string) {
  const box = await locator.boundingBox();
  if (!box) throw new Error(`${description} tidak memiliki bounding box.`);
  return box;
}

function boxesOverlap(
  first: { x: number; y: number; width: number; height: number },
  second: { x: number; y: number; width: number; height: number }
) {
  return (
    first.x < second.x + second.width &&
    first.x + first.width > second.x &&
    first.y < second.y + second.height &&
    first.y + first.height > second.y
  );
}

async function rightEdgeDifference(container: Locator, item: Locator) {
  const [containerBox, itemBox] = await Promise.all([
    requireBoundingBox(container, 'Wadah'),
    requireBoundingBox(item, 'Elemen'),
  ]);
  return Math.abs(
    itemBox.x + itemBox.width - (containerBox.x + containerBox.width)
  );
}

async function locatorsOverlap(first: Locator, second: Locator) {
  const [firstBox, secondBox] = await Promise.all([
    requireBoundingBox(first, 'Elemen pertama'),
    requireBoundingBox(second, 'Elemen kedua'),
  ]);
  return boxesOverlap(firstBox, secondBox);
}

async function expectOwnConnectionInTopBar(page: Page) {
  const header = page.getByRole('banner');
  const connectionStatuses = page.getByRole('status', {
    name: 'Status koneksi',
    includeHidden: true,
  });
  const inlineStatus = header.getByRole('status', {
    name: 'Status koneksi',
  });

  await expect(connectionStatuses).toHaveCount(1);
  await expect(inlineStatus).toBeVisible();
  await expect(inlineStatus).toContainText('Online');
  await expect(inlineStatus).toHaveCSS('position', 'static');
  await expect(inlineStatus).toBeInViewport({ ratio: 1 });
  await expect
    .poll(() => rightEdgeDifference(header, inlineStatus))
    .toBeLessThanOrEqual(1);
  await expect
    .poll(() =>
      locatorsOverlap(header.locator(':scope > *').first(), inlineStatus)
    )
    .toBe(false);
}

test('status koneksi layar aktivasi tetap di kanan tanpa bertumpuk', async ({
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

    socket.connectToServer();
    resolveSessionSocket(socket);
  });

  await page.goto('/');
  await page
    .getByRole('button', { name: 'Buat room untuk device masing-masing' })
    .click();
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: /Kamu jadi player pertama/,
    })
  ).toBeVisible();

  const header = page.getByRole('banner');
  const brand = header.locator(':scope > *').first();
  const note = page.getByText('Device masing-masing · Satu room bareng', {
    exact: true,
  });
  const connectedStatus = page
    .getByRole('status')
    .filter({ hasText: 'Online' });
  await expect(note).toBeVisible();
  await expect(connectedStatus).toBeVisible();

  await expect
    .poll(() => rightEdgeDifference(header, connectedStatus))
    .toBeLessThanOrEqual(1);
  await expect
    .poll(async () => {
      const [noteBox, statusBox] = await Promise.all([
        requireBoundingBox(note, 'Catatan header'),
        requireBoundingBox(connectedStatus, 'Status tersambung'),
      ]);
      return noteBox.x + noteBox.width <= statusBox.x;
    })
    .toBe(true);

  await page.setViewportSize({ width: 360, height: 800 });
  await expect(note).toBeHidden();

  await expect
    .poll(() => rightEdgeDifference(header, connectedStatus))
    .toBeLessThanOrEqual(1);
  await expect.poll(() => locatorsOverlap(brand, connectedStatus)).toBe(false);

  rejectSessionSockets = true;
  await (await sessionSocket).close();
  const disconnectedStatus = page
    .getByRole('status')
    .filter({ hasText: 'Offline' });
  await expect(disconnectedStatus).toBeVisible();
  await expect(
    disconnectedStatus.getByRole('button', { name: 'Coba lagi' })
  ).toBeInViewport({ ratio: 1 });

  await expect
    .poll(() => rightEdgeDifference(header, disconnectedStatus))
    .toBeLessThanOrEqual(1);
  await expect
    .poll(() => locatorsOverlap(brand, disconnectedStatus))
    .toBe(false);
});

test('menu tindakan sesi tetap ringkas dan terjangkau di layar sempit', async ({
  browser,
  page: controllerPage,
}, testInfo) => {
  const joinerContext = await createMatchingContext(browser, testInfo);
  const joinerPage = await joinerContext.newPage();

  try {
    const session = await createOwnDeviceSession(
      controllerPage,
      'Pengendali E2E'
    );
    await joinOwnDeviceSession(joinerPage, {
      ...session,
      creatorName: 'Pengendali E2E',
      playerName: 'Pemain E2E',
    });
    await readyPlayersAndStartSelection(controllerPage, joinerPage);

    await controllerPage.setViewportSize({ width: 360, height: 640 });
    const trigger = controllerPage.getByRole('button', {
      name: 'Buka menu sesi',
    });
    const status = controllerPage.getByRole('status', {
      name: 'Status koneksi',
    });

    await expect(trigger).toBeVisible();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect.poll(() => locatorsOverlap(trigger, status)).toBe(false);
    await trigger.click();

    const panel = controllerPage.getByRole('region', {
      name: 'Pilihan menu sesi',
    });
    const returnToLobby = panel.getByRole('button', {
      name: /Balik ke lobby/,
    });
    const leave = panel.getByRole('button', { name: /Keluar dari sesi/ });
    const end = panel.getByRole('button', { name: /Tutup sesi/ });

    await expect(panel).toBeInViewport({ ratio: 1 });
    await expect(returnToLobby).toBeVisible();
    await expect(leave).toBeVisible();
    await expect(end).toBeVisible();
    await expect.poll(() => locatorsOverlap(returnToLobby, leave)).toBe(false);
    await expect.poll(() => locatorsOverlap(leave, end)).toBe(false);
    await capture(controllerPage, '09-own-session-actions-menu.png');

    await controllerPage.keyboard.press('Escape');
    await expect(panel).toHaveCount(0);
    await expect(trigger).toBeFocused();

    await controllerPage.setViewportSize({ width: 360, height: 240 });
    await trigger.click();
    const shortPanelBox = await requireBoundingBox(panel, 'Menu tindakan sesi');
    expect(shortPanelBox.x).toBeGreaterThanOrEqual(0);
    expect(shortPanelBox.y).toBeGreaterThanOrEqual(0);
    expect(shortPanelBox.x + shortPanelBox.width).toBeLessThanOrEqual(360);
    expect(shortPanelBox.y + shortPanelBox.height).toBeLessThanOrEqual(240);
    await end.scrollIntoViewIfNeeded();
    await expect(end).toBeInViewport({ ratio: 1 });

    await controllerPage.keyboard.press('Escape');
    await controllerPage.setViewportSize({ width: 360, height: 640 });
    await trigger.click();
    await returnToLobby.click();
    const dialog = controllerPage.getByRole('alertdialog');
    await expect(dialog).toContainText('Balik ke lobby?');
    await dialog.getByRole('button', { name: 'Nggak jadi' }).click();
    await expect(trigger).toBeFocused();
  } finally {
    await joinerContext.close();
  }
});

test('pengendali kembali ke beranda tanpa melihat layar sesi berakhir', async ({
  page,
}) => {
  await createOwnDeviceSession(page, 'Pengendali');
  await page.route('**/actions/end', async (route) => {
    const response = await route.fetch();
    await new Promise((resolve) => setTimeout(resolve, 150));
    await route.fulfill({ response });
  });
  await page.evaluate(() => {
    const storageKey = 'end-session-heading-history';
    const history: string[] = [];
    const recordHeading = () => {
      const heading = document.querySelector('h1')?.textContent?.trim();
      if (!heading || history.at(-1) === heading) return;
      history.push(heading);
      sessionStorage.setItem(storageKey, JSON.stringify(history));
    };

    new MutationObserver(recordHeading).observe(document.body, {
      childList: true,
      subtree: true,
    });
    recordHeading();
  });

  await page.getByRole('button', { name: 'Tutup sesi buat semua' }).click();
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Ya, tutup sesi' })
    .click();
  await expect(
    page
      .getByRole('alertdialog')
      .getByRole('button', { name: 'Mengakhiri sesi…' })
  ).toBeDisabled();
  await expect(
    page.getByRole('heading', {
      name: 'Tebak namanya. Lupakan jaimnya.',
    })
  ).toBeVisible();

  const headingHistory = await page.evaluate(() =>
    JSON.parse(sessionStorage.getItem('end-session-heading-history') ?? '[]')
  );
  expect(headingHistory).not.toContain('Game sudah selesai.');
});

test('link lobby memakai origin deployment dan room code', async ({
  context,
  page,
}) => {
  const session = await createOwnDeviceSession(page, 'Pengendali E2E');
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);

  const codeRegion = page.getByRole('region', { name: 'Room code' });
  await codeRegion.getByRole('button', { name: 'Copy link' }).click();

  await expect(
    codeRegion.getByText('Link sudah di-copy!', { exact: true })
  ).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toBe(`http://127.0.0.1:3000/join/${session.code}/`);
});

test('perubahan pengaturan lobi tidak menonaktifkan aksi lain', async ({
  page,
}) => {
  await installCommandAcknowledgementDelay(page, {
    initiallyEnabled: false,
  });
  await createOwnDeviceSession(page, 'Pengendali E2E');
  await setCommandAcknowledgementDelay(page, true);

  const configuration = page.getByRole('region', {
    name: 'Game setup',
  });
  const cardsPerPlayerInput = configuration.getByRole('spinbutton', {
    name: 'Kartu per player',
  });
  const renameButton = page
    .getByLabel('Namamu')
    .locator('..')
    .getByRole('button');

  await expect(cardsPerPlayerInput).toBeEditable();
  await cardsPerPlayerInput.fill('4');
  await expect(cardsPerPlayerInput).toHaveValue('4');

  expect(
    await Promise.all([
      configuration
        .getByRole('button', { name: 'Tambah kartu per player' })
        .isEnabled(),
      configuration
        .getByRole('checkbox', {
          name: /Pakai timeout kalau player offline/,
        })
        .isEnabled(),
      page.getByRole('button', { name: 'Ganti kode' }).isEnabled(),
      page.getByRole('button', { name: 'Aku ready' }).isEnabled(),
      page
        .getByRole('button', {
          name: 'Pindahkan Pengendali E2E ke Tim 2',
        })
        .isEnabled(),
      renameButton.isEnabled(),
      page.getByRole('button', { name: 'Keluar dari sesi' }).isEnabled(),
    ])
  ).toEqual([true, true, true, true, true, true, true]);
  expect(await renameButton.innerText()).toBe('Simpan nama');
});

test('hanya pengendali yang dapat mengubah batas waktu pemain tidak aktif', async ({
  browser,
  page: controllerPage,
}, testInfo) => {
  const joinerContext = await createMatchingContext(browser, testInfo);
  const joinerPage = await joinerContext.newPage();

  try {
    const session = await createOwnDeviceSession(
      controllerPage,
      'Pengendali E2E'
    );
    await joinOwnDeviceSession(joinerPage, {
      ...session,
      creatorName: 'Pengendali E2E',
      playerName: 'Pemain E2E',
    });

    const checkboxName = /Pakai timeout kalau player offline/;
    const controllerCheckbox = controllerPage.getByRole('checkbox', {
      name: checkboxName,
    });
    const joinerCheckbox = joinerPage.getByRole('checkbox', {
      name: checkboxName,
    });

    await expect(controllerCheckbox).toBeChecked();
    await expect(controllerCheckbox).toBeEnabled();
    await expect(joinerCheckbox).toBeChecked();
    await expect(joinerCheckbox).toBeDisabled();

    await controllerCheckbox.click();
    await expect(controllerCheckbox).not.toBeChecked();
    await expect(joinerCheckbox).not.toBeChecked();
  } finally {
    await joinerContext.close();
  }
});

test('memilih kartu tidak menonaktifkan pilihan lain saat sinkronisasi', async ({
  browser,
  page: controllerPage,
}, testInfo) => {
  const joinerContext = await createMatchingContext(browser, testInfo);
  const joinerPage = await joinerContext.newPage();
  await installCommandAcknowledgementDelay(controllerPage, {
    initiallyEnabled: false,
  });

  try {
    const session = await createOwnDeviceSession(
      controllerPage,
      'Pengendali E2E'
    );
    await joinOwnDeviceSession(joinerPage, {
      ...session,
      creatorName: 'Pengendali E2E',
      playerName: 'Pemain E2E',
    });
    await readyPlayersAndStartSelection(controllerPage, joinerPage);
    await setCommandAcknowledgementDelay(controllerPage, true);

    await controllerPage
      .getByRole('main')
      .getByRole('button', { pressed: false })
      .first()
      .click();
    await expect(
      controllerPage.getByRole('main').getByRole('button', { pressed: true })
    ).toHaveCount(1);

    expect(
      await Promise.all([
        controllerPage
          .getByRole('main')
          .getByRole('button', { pressed: true })
          .first()
          .isEnabled(),
        controllerPage
          .getByRole('main')
          .getByRole('button', { pressed: false })
          .first()
          .isEnabled(),
      ])
    ).toEqual([false, true]);
  } finally {
    await joinerContext.close();
  }
});

async function finishOwnDeviceRound(
  controllerPage: Page,
  joinerPage: Page,
  options: {
    round: number;
    controllerName: string;
    joinerName: string;
    captureTurn?: boolean;
  }
) {
  await expect(
    controllerPage.getByRole('heading', {
      level: 1,
      name: new RegExp(`${options.controllerName},\\s*kasih clue\\.`),
    })
  ).toBeVisible();
  await expect(
    joinerPage.getByRole('heading', {
      level: 1,
      name: `Nunggu ${options.controllerName}.`,
    })
  ).toBeVisible();

  await controllerPage.getByRole('button', { name: 'Gas 60 detik' }).click();
  const controllerCard = controllerPage
    .getByRole('article')
    .getByRole('heading', { level: 1 });
  await expect(controllerCard).toBeVisible();
  await expectOwnConnectionInTopBar(controllerPage);
  await expectOwnConnectionInTopBar(joinerPage);
  const controllerSecret = (await controllerCard.innerText()).trim();
  await expectSecretAbsent(joinerPage, controllerSecret);

  if (options.captureTurn) {
    await expect(controllerPage.getByLabel('60 detik tersisa')).toBeVisible();
    await expect(joinerPage.getByLabel('60 detik tersisa')).toBeVisible();
    await capture(controllerPage, '05-own-active-turn.png');
    await captureRegion(
      joinerPage,
      joinerPage.getByRole('main'),
      '06-own-public-turn.png'
    );
  }

  await controllerPage.getByRole('button', { name: 'Benar!' }).click();
  const endTurn = controllerPage.getByRole('button', {
    name: 'Stop giliran',
  });
  await expect(endTurn).toBeEnabled();
  await endTurn.click();

  await expect(
    joinerPage.getByRole('heading', {
      level: 1,
      name: new RegExp(`${options.joinerName},\\s*kasih clue\\.`),
    })
  ).toBeVisible();
  await joinerPage.getByRole('button', { name: 'Gas 60 detik' }).click();
  const joinerCard = joinerPage
    .getByRole('article')
    .getByRole('heading', { level: 1 });
  await expect(joinerCard).toBeVisible();
  await expectSecretAbsent(
    controllerPage,
    (await joinerCard.innerText()).trim()
  );
  await joinerPage.getByRole('button', { name: 'Benar!' }).click();

  if (options.round < 3) {
    await expect(
      controllerPage.getByRole('heading', {
        level: 1,
        name: `Ronde ${options.round} kelar!`,
      })
    ).toBeVisible();
    await expect(
      joinerPage.getByRole('heading', {
        level: 1,
        name: `Ronde ${options.round} kelar!`,
      })
    ).toBeVisible();
  } else {
    await expect(controllerPage.getByText('Final score')).toBeVisible();
    await expect(joinerPage.getByText('Final score')).toBeVisible();
  }
  await expect(
    joinerPage.getByRole('button', { name: 'Lanjut ronde berikutnya' })
  ).toHaveCount(0);
  await expect(
    joinerPage.getByText(/Nunggu host lanjutkan game/)
  ).toBeVisible();
  await expectOwnConnectionInTopBar(controllerPage);
  await expectOwnConnectionInTopBar(joinerPage);

  if (options.round === 1) {
    const originalViewport = controllerPage.viewportSize();
    await controllerPage.setViewportSize({ width: 360, height: 800 });
    await expect(controllerPage.getByLabel('Ronde 1 dari 3')).toBeHidden();
    await expectOwnConnectionInTopBar(controllerPage);
    if (originalViewport)
      await controllerPage.setViewportSize(originalViewport);
  }
}

test('sesi perangkat masing-masing menyelesaikan seluruh siklus dan pemulihan', async ({
  browser,
  page: initialControllerPage,
}, testInfo) => {
  test.setTimeout(90_000);
  const controllerContext = initialControllerPage.context();
  const joinerContext = await createMatchingContext(browser, testInfo);
  const thirdContext = await createMatchingContext(browser, testInfo);
  await installSoundSpy(controllerContext);
  await installSoundSpy(joinerContext);
  const joinerPage = await joinerContext.newPage();
  const thirdPage = await thirdContext.newPage();
  let controllerPage = initialControllerPage;

  try {
    const controllerName = 'Arfian E2E';
    const joinerName = 'Budi E2E';
    const thirdName = 'Citra E2E';
    await controllerPage.goto('/');
    await capture(controllerPage, '00-home.png');
    const session = await createOwnDeviceSession(
      controllerPage,
      controllerName
    );

    await joinOwnDeviceSession(joinerPage, {
      ...session,
      creatorName: controllerName,
      playerName: joinerName,
      onPreview: () =>
        capture(joinerPage, '01-own-join.png', [
          joinerPage.getByText(session.code, { exact: true }),
        ]),
    });
    await joinOwnDeviceSession(thirdPage, {
      ...session,
      creatorName: controllerName,
      playerName: thirdName,
      expectedPlayerCount: 2,
    });
    await expectOwnConnectionInTopBar(controllerPage);
    await expectOwnConnectionInTopBar(joinerPage);

    const teamOne = controllerPage.getByRole('region', { name: 'Tim 1' });
    const teamTwo = controllerPage.getByRole('region', { name: 'Tim 2' });
    await expect(
      teamOne.getByRole('listitem').filter({ hasText: controllerName })
    ).toBeVisible();
    await expect(teamOne.getByText(thirdName, { exact: true })).toBeVisible();
    await expect(teamTwo.getByText(joinerName, { exact: true })).toBeVisible();
    await capture(
      controllerPage,
      '02-own-lobby.png',
      [
        controllerPage
          .getByRole('region', { name: 'Room code' })
          .locator('output'),
      ],
      true
    );

    await teamOne
      .getByRole('button', {
        name: `Naikkan ${thirdName} dalam urutan Tim 1`,
      })
      .click();
    await expect(teamOne.getByRole('listitem').first()).toContainText(
      thirdName
    );
    await teamOne
      .getByRole('button', { name: `Pindahkan ${thirdName} ke Tim 2` })
      .click();
    await expect(teamTwo.getByText(thirdName, { exact: true })).toBeVisible();
    await teamTwo
      .getByRole('button', { name: `Pindahkan ${thirdName} ke Tim 1` })
      .click();
    await teamOne
      .getByRole('button', { name: `Keluarkan ${thirdName} dari sesi` })
      .click();
    await controllerPage
      .getByRole('alertdialog')
      .getByRole('button', { name: 'Keluarkan player' })
      .click();
    await expect(
      thirdPage.getByRole('heading', {
        level: 1,
        name: 'Kamu sudah keluar dari sesi.',
      })
    ).toBeVisible();

    await setCardsPerPlayerToOne(controllerPage, joinerPage);
    await readyPlayersAndStartSelection(controllerPage, joinerPage);
    await expectOwnConnectionInTopBar(controllerPage);
    await expectOwnConnectionInTopBar(joinerPage);
    await capture(controllerPage, '03-own-private-selection.png');

    const controllerOffer = await privateOfferWords(controllerPage);
    const joinerOffer = await privateOfferWords(joinerPage);
    expect(controllerOffer).toHaveLength(3);
    expect(joinerOffer).toHaveLength(3);
    expect(
      controllerOffer.filter((word) => joinerOffer.includes(word))
    ).toEqual([]);

    await chooseOnePrivateCard(controllerPage);
    await chooseOnePrivateCard(joinerPage);
    await lockBothSelections(controllerPage, joinerPage, () =>
      capture(controllerPage, '04-own-waiting-selection.png')
    );

    for (const round of [1, 2, 3]) {
      await finishOwnDeviceRound(controllerPage, joinerPage, {
        round,
        controllerName,
        joinerName,
        captureTurn: round === 1,
      });
      if (round < 3) {
        await controllerPage
          .getByRole('button', { name: 'Lanjut ronde berikutnya' })
          .click();
      }
    }

    await expect(controllerPage.getByText('Final score')).toBeVisible();
    await expect(
      joinerPage.getByRole('button', { name: 'Rematch' })
    ).toHaveCount(0);
    expect(await playedSounds(controllerPage)).toEqual(
      expect.arrayContaining(['/sounds/bell.wav', '/sounds/ring.wav'])
    );
    expect(await playedSounds(joinerPage)).toEqual(
      expect.arrayContaining(['/sounds/bell.wav', '/sounds/ring.wav'])
    );

    await controllerPage.getByRole('button', { name: 'Rematch' }).click();
    await expect(
      controllerPage.getByRole('heading', { name: 'Lobby' })
    ).toBeVisible();
    await expect(
      joinerPage.getByRole('heading', { name: 'Lobby' })
    ).toBeVisible();
    await expect(
      controllerPage.getByRole('button', { name: 'Aku ready' })
    ).toBeVisible();

    const replacedControllerPage = controllerPage;
    const newestControllerPage = await controllerContext.newPage();
    await newestControllerPage.goto(session.sessionPath);
    await expect(
      newestControllerPage.getByRole('heading', { name: 'Lobby' })
    ).toBeVisible();
    await expect(
      replacedControllerPage.getByRole('heading', {
        name: 'Pakai tab yang baru, ya.',
      })
    ).toBeVisible();
    await capture(replacedControllerPage, '07-own-duplicate-recovery.png');
    controllerPage = newestControllerPage;

    await controllerPage.close();
    await expect(
      joinerPage.getByRole('button', { name: 'Mulai pilih kartu' })
    ).toBeVisible({ timeout: 35_000 });

    const returnedControllerPage = await controllerContext.newPage();
    await returnedControllerPage.goto(session.sessionPath);
    await expect(
      returnedControllerPage.getByRole('heading', {
        name: 'Lobby',
      })
    ).toBeVisible();
    await expect(
      returnedControllerPage.getByRole('button', {
        name: 'Mulai pilih kartu',
      })
    ).toHaveCount(0);

    await returnedControllerPage
      .getByRole('button', { name: 'Keluar dari sesi' })
      .click();
    await returnedControllerPage
      .getByRole('alertdialog')
      .getByRole('button', { name: 'Ya, keluar' })
      .click();
    await expect(
      returnedControllerPage.getByRole('heading', {
        name: 'Tebak namanya. Lupakan jaimnya.',
      })
    ).toBeVisible();
    await expect(
      joinerPage.getByText(controllerName, { exact: true })
    ).toHaveCount(0);

    await joinerPage
      .getByRole('button', { name: 'Tutup sesi buat semua' })
      .click();
    await joinerPage
      .getByRole('alertdialog')
      .getByRole('button', { name: 'Ya, tutup sesi' })
      .click();
    await expect(
      joinerPage.getByRole('heading', {
        name: 'Tebak namanya. Lupakan jaimnya.',
      })
    ).toBeVisible();
  } finally {
    await thirdContext.close();
    await joinerContext.close();
  }
});

test('ruang tunggu tetap dapat digunakan dengan 20 pemain', async ({
  browser,
  page: controllerPage,
}, testInfo) => {
  test.setTimeout(120_000);
  const participantContexts: BrowserContext[] = [];

  try {
    const controllerName = 'Pengendali Padat';
    const session = await createOwnDeviceSession(
      controllerPage,
      controllerName
    );

    for (let playerNumber = 2; playerNumber <= 20; playerNumber += 1) {
      const context = await createMatchingContext(browser, testInfo);
      participantContexts.push(context);
      const participantPage = await context.newPage();
      await joinOwnDeviceSession(participantPage, {
        ...session,
        creatorName: controllerName,
        playerName: `Pemain ${String(playerNumber).padStart(2, '0')}`,
        expectedPlayerCount: playerNumber - 1,
      });
    }

    await expect(
      controllerPage.getByText('Lobby · 20 dari 20 player', {
        exact: true,
      })
    ).toBeVisible();
    await expect(
      controllerPage
        .getByRole('region', { name: 'Tim 1' })
        .getByRole('listitem')
    ).toHaveCount(10);
    await expect(
      controllerPage
        .getByRole('region', { name: 'Tim 2' })
        .getByRole('listitem')
    ).toHaveCount(10);

    await capture(
      controllerPage,
      '08-own-dense-lobby.png',
      [
        controllerPage
          .getByRole('region', { name: 'Room code' })
          .locator('output'),
      ],
      true
    );
  } finally {
    await Promise.all(participantContexts.map((context) => context.close()));
  }
});

test('peserta tetap dapat siap tanpa crypto.randomUUID', async ({
  browser,
  page: controllerPage,
}, testInfo) => {
  const participantContext = await createMatchingContext(browser, testInfo);
  await participantContext.addInitScript(() => {
    Object.defineProperty(Crypto.prototype, 'randomUUID', {
      configurable: true,
      value: undefined,
    });
  });
  const participantPage = await participantContext.newPage();

  try {
    const controllerName = 'Pengendali UUID';
    const participantName = 'Peserta UUID';
    const session = await createOwnDeviceSession(
      controllerPage,
      controllerName
    );
    await joinOwnDeviceSession(participantPage, {
      ...session,
      creatorName: controllerName,
      playerName: participantName,
    });

    await participantPage.getByRole('button', { name: 'Aku ready' }).click();
    await expect(
      participantPage.getByRole('button', { name: 'Belum ready' })
    ).toBeVisible();
  } finally {
    await participantContext.close();
  }
});
