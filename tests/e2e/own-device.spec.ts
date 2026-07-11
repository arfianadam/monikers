import {
  expect,
  type BrowserContext,
  type Locator,
  type Page,
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

async function capture(
  page: Page,
  name: string,
  mask: Locator[] = [],
  fullPage = false
) {
  await page.bringToFront();
  await page.evaluate(async () => document.fonts.ready);
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
  await page.evaluate(async () => document.fonts.ready);
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      })
  );
  const visualScope = await page.addStyleTag({
    content: '[aria-label="Tindakan sesi"] { visibility: hidden !important; }',
  });
  try {
    await expect(region).toHaveScreenshot(name, { animations: 'allow' });
  } finally {
    await visualScope.evaluate((element) =>
      element.parentNode?.removeChild(element)
    );
  }
}

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

  await page.getByRole('button', { name: 'Akhiri sesi untuk semua' }).click();
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Akhiri sesi' })
    .click();
  await expect(
    page
      .getByRole('alertdialog')
      .getByRole('button', { name: 'Mengakhiri sesi…' })
  ).toBeDisabled();
  await expect(
    page.getByRole('heading', { name: /Pilih cara mainmu/ })
  ).toBeVisible();

  const headingHistory = await page.evaluate(() =>
    JSON.parse(sessionStorage.getItem('end-session-heading-history') ?? '[]')
  );
  expect(headingHistory).not.toContain('Permainan telah selesai.');
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
      name: new RegExp(`${options.controllerName},\\s*beri petunjuk\\.`),
    })
  ).toBeVisible();
  await expect(
    joinerPage.getByRole('heading', {
      level: 1,
      name: `Menunggu ${options.controllerName}.`,
    })
  ).toBeVisible();

  await controllerPage
    .getByRole('button', { name: 'Mulai giliran 60 detik' })
    .click();
  const controllerCard = controllerPage
    .getByRole('article')
    .getByRole('heading', { level: 1 });
  await expect(controllerCard).toBeVisible();
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
    name: 'Akhiri giliran lebih awal',
  });
  await expect(endTurn).toBeEnabled();
  await endTurn.click();

  await expect(
    joinerPage.getByRole('heading', {
      level: 1,
      name: new RegExp(`${options.joinerName},\\s*beri petunjuk\\.`),
    })
  ).toBeVisible();
  await joinerPage
    .getByRole('button', { name: 'Mulai giliran 60 detik' })
    .click();
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
        name: `Babak ${options.round} telah usai.`,
      })
    ).toBeVisible();
    await expect(
      joinerPage.getByRole('heading', {
        level: 1,
        name: `Babak ${options.round} telah usai.`,
      })
    ).toBeVisible();
  } else {
    await expect(controllerPage.getByText('Skor akhir')).toBeVisible();
    await expect(joinerPage.getByText('Skor akhir')).toBeVisible();
  }
  await expect(
    joinerPage.getByRole('button', { name: 'Mulai babak berikutnya' })
  ).toHaveCount(0);
  await expect(joinerPage.getByText(/Menunggu pengendali sesi/)).toBeVisible();
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
          .getByRole('region', { name: 'Kode sesi' })
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
      .getByRole('button', { name: 'Keluarkan pemain' })
      .click();
    await expect(
      thirdPage.getByRole('heading', {
        level: 1,
        name: 'Kamu bukan anggota sesi ini lagi.',
      })
    ).toBeVisible();

    await setCardsPerPlayerToOne(controllerPage, joinerPage);
    await readyPlayersAndStartSelection(controllerPage, joinerPage);
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
          .getByRole('button', { name: 'Mulai babak berikutnya' })
          .click();
      }
    }

    await expect(controllerPage.getByText('Skor akhir')).toBeVisible();
    await expect(
      joinerPage.getByRole('button', { name: 'Main lagi' })
    ).toHaveCount(0);
    expect(await playedSounds(controllerPage)).toEqual(
      expect.arrayContaining(['/sounds/bell.wav', '/sounds/ring.wav'])
    );
    expect(await playedSounds(joinerPage)).toEqual(
      expect.arrayContaining(['/sounds/bell.wav', '/sounds/ring.wav'])
    );

    await controllerPage.getByRole('button', { name: 'Main lagi' }).click();
    await expect(
      controllerPage.getByRole('heading', { name: 'Susun kedua tim.' })
    ).toBeVisible();
    await expect(
      joinerPage.getByRole('heading', { name: 'Susun kedua tim.' })
    ).toBeVisible();
    await expect(
      controllerPage.getByRole('button', { name: 'Saya siap' })
    ).toBeVisible();

    const replacedControllerPage = controllerPage;
    const newestControllerPage = await controllerContext.newPage();
    await newestControllerPage.goto(session.sessionPath);
    await expect(
      newestControllerPage.getByRole('heading', { name: 'Susun kedua tim.' })
    ).toBeVisible();
    await expect(
      replacedControllerPage.getByRole('heading', {
        name: 'Tab ini sudah digantikan.',
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
        name: 'Susun kedua tim.',
      })
    ).toBeVisible();
    await expect(
      returnedControllerPage.getByRole('button', {
        name: 'Mulai pilih kartu',
      })
    ).toHaveCount(0);

    await returnedControllerPage
      .getByRole('button', { name: 'Tinggalkan sesi' })
      .click();
    await returnedControllerPage
      .getByRole('alertdialog')
      .getByRole('button', { name: 'Tinggalkan sesi' })
      .click();
    await expect(
      returnedControllerPage.getByRole('heading', { name: /Pilih cara mainmu/ })
    ).toBeVisible();
    await expect(
      joinerPage.getByText(controllerName, { exact: true })
    ).toHaveCount(0);

    await joinerPage
      .getByRole('button', { name: 'Akhiri sesi untuk semua' })
      .click();
    await joinerPage
      .getByRole('alertdialog')
      .getByRole('button', { name: 'Akhiri sesi' })
      .click();
    await expect(
      joinerPage.getByRole('heading', { name: /Pilih cara mainmu/ })
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
      controllerPage.getByText('Ruang tunggu · 20 dari 20 pemain', {
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
          .getByRole('region', { name: 'Kode sesi' })
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

    await participantPage.getByRole('button', { name: 'Saya siap' }).click();
    await expect(
      participantPage.getByRole('button', { name: 'Batalkan siap' })
    ).toBeVisible();
  } finally {
    await participantContext.close();
  }
});
