import { expect, type Page, test } from '@playwright/test';

async function chooseCard(page: Page) {
  await page.getByRole('button', { pressed: false }).first().click();
  await expect(page.getByRole('button', { pressed: true })).toHaveCount(1);
}

async function reachActiveTurn(page: Page) {
  await page.getByRole('button', { name: 'Main di satu perangkat' }).click();
  await expect(page).toHaveURL(/\/session\/[A-Za-z0-9_-]+$/);

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
  await page
    .getByRole('button', { name: 'Serahkan ke pemain berikutnya' })
    .click();
  await page.getByRole('button', { name: 'Buka kartuku' }).click();
  await chooseCard(page);
  await page.getByRole('button', { name: 'Selesai' }).click();
  await page.getByRole('button', { name: 'Mulai giliran 60 detik' }).click();
  await expect(page.getByLabel(/\d+ detik tersisa/)).toBeVisible();
}

test('layout khusus tetap terbaca dan stabil', async ({ page }, testInfo) => {
  await page.goto('/');
  await page.evaluate(async () => document.fonts.ready);

  const eyebrowDot = page
    .getByText('Tiga babak, dua tim, banyak jawaban ngawur', { exact: true })
    .locator('span');
  const eyebrowDotBox = await eyebrowDot.boundingBox();
  expect(eyebrowDotBox).not.toBeNull();
  expect(eyebrowDotBox?.width).toBe(eyebrowDotBox?.height);

  if (testInfo.project.name === 'narrow-mobile-chromium') {
    await expect(page).toHaveScreenshot('setup-360.png', { fullPage: true });
  }

  await reachActiveTurn(page);
  await expect(page).toHaveScreenshot('active-turn.png', { fullPage: true });
});
