import { expect, type Page, test } from '@playwright/test';

const TOTAL_CARDS = 2;

async function captureStage(page: Page, name: string) {
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  await expect(page).toHaveScreenshot(`${name}.png`, { fullPage: true });
}

async function chooseOneCard(page: Page) {
  const card = page.getByRole('button', { pressed: false }).first();

  await expect(card).toBeVisible();
  await card.click();
  await expect(page.getByRole('button', { pressed: true })).toHaveCount(1);
}

async function completeActiveTurn(page: Page) {
  const correctButton = page.getByRole('button', { name: 'Benar!' });

  for (let cardIndex = 0; cardIndex < TOTAL_CARDS; cardIndex += 1) {
    await correctButton.click();

    if (cardIndex < TOTAL_CARDS - 1) {
      await expect(correctButton).toBeDisabled();
      await page.clock.runFor(1_000);
      await expect(correctButton).toBeEnabled();
    }
  }
}

async function playRound(page: Page, round: number) {
  await expect(page.getByLabel(`Babak ${round} dari 3`)).toBeVisible();
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: new RegExp(`Tim 1,\\s*giliranmu\\.`),
    })
  ).toBeVisible();

  await page.getByRole('button', { name: 'Mulai giliran 60 detik' }).click();
  await expect(page.getByLabel('60 detik tersisa')).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await completeActiveTurn(page);
}

test('dua pemain menyelesaikan tiga babak', async ({ page }) => {
  await page.addInitScript(() => {
    let seed = 0x1a2b3c4d;

    Math.random = () => {
      seed = (Math.imul(seed, 1_664_525) + 1_013_904_223) >>> 0;
      return seed / 0x1_0000_0000;
    };
  });
  await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
  await page.goto('/');

  const playersInput = page.getByLabel('Pemain', { exact: true });
  const cardsInput = page.getByLabel('Kartu per pemain', { exact: true });

  await expect(
    page.getByRole('heading', { level: 1, name: /Tebak namanya/ })
  ).toBeVisible();
  await playersInput.fill('2');
  await cardsInput.fill('1');
  await expect(page.getByText('2 kartu dalam deck')).toBeVisible();
  await captureStage(page, '01-setup');

  await page.getByRole('button', { name: 'Mulai bermain' }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Serahkan perangkatnya' })
  ).toBeVisible();
  await expect(
    page.getByLabel('Progres pemilihan kartu: pemain 1 dari 2')
  ).toBeVisible();
  await captureStage(page, '02-private-handoff');

  await page.getByRole('button', { name: 'Buka kartuku' }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Pilih favoritmu' })
  ).toBeVisible();
  await expect(page.getByText('0 / 1 dipilih')).toBeVisible();
  await captureStage(page, '03-card-picker');

  await chooseOneCard(page);
  await page
    .getByRole('button', { name: 'Serahkan ke pemain berikutnya' })
    .click();
  await expect(
    page.getByText('Pemain 2, pilihanmu rahasia.', { exact: false })
  ).toBeVisible();
  await page.getByRole('button', { name: 'Buka kartuku' }).click();
  await chooseOneCard(page);
  await page.getByRole('button', { name: 'Selesai' }).click();

  await expect(
    page.getByRole('heading', {
      level: 1,
      name: /Tim 1,\s*giliranmu\./,
    })
  ).toBeVisible();
  await expect(page.getByLabel('Babak 1 dari 3')).toBeVisible();
  await captureStage(page, '04-turn-handoff');

  const currentTime = await page.evaluate(() => Date.now());
  await page.clock.pauseAt(currentTime + 1_000);
  await page.getByRole('button', { name: 'Mulai giliran 60 detik' }).click();
  await expect(page.getByLabel('60 detik tersisa')).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await captureStage(page, '05-active-turn');
  await completeActiveTurn(page);

  await expect(
    page.getByRole('heading', { level: 1, name: 'Babak 1 telah usai.' })
  ).toBeVisible();
  await expect(page.getByRole('region', { name: 'Skor tim' })).toBeVisible();
  await expect(page.getByText('1 / 3 selesai')).toBeVisible();
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
  await captureStage(page, '07-final-score');
});

test('giliran tidak lengkap berpindah tim dan memicu suara', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const playedSounds: string[] = [];
    Object.assign(window, { __playedSounds: playedSounds });
    HTMLMediaElement.prototype.play = function play() {
      playedSounds.push(new URL(this.src).pathname);
      return Promise.resolve();
    };
    Math.random = () => 0.5;
  });
  await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
  await page.goto('/');

  await page.getByRole('spinbutton', { name: 'Pemain', exact: true }).fill('2');
  await page.getByRole('spinbutton', { name: 'Kartu per pemain' }).fill('2');
  await page.getByRole('button', { name: 'Mulai bermain' }).click();

  for (let player = 1; player <= 2; player += 1) {
    await page.getByRole('button', { name: 'Buka kartuku' }).click();
    await chooseOneCard(page);
    await page.getByRole('button', { pressed: false }).first().click();
    await expect(page.getByRole('button', { pressed: true })).toHaveCount(2);
    await page
      .getByRole('button', {
        name: player === 1 ? 'Serahkan ke pemain berikutnya' : 'Selesai',
      })
      .click();
  }

  await page.getByRole('button', { name: 'Mulai giliran 60 detik' }).click();
  const skipButton = page.getByRole('button', { name: 'Lewati' });
  await skipButton.click();
  await expect(
    page.getByRole('button', { name: 'Sudah digunakan' })
  ).toBeDisabled();

  await page.getByRole('button', { name: 'Benar!' }).click();
  await expect(page.getByRole('button', { name: 'Lewati' })).toBeEnabled();
  await page.clock.runFor(60_000);

  await expect(
    page.getByRole('heading', { level: 1, name: /Tim 2,\s*giliranmu\./ })
  ).toBeVisible();
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
