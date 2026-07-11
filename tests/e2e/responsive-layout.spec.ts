import { expect, type Page, test } from '@playwright/test';

async function chooseCard(page: Page) {
  await page.getByRole('button', { pressed: false }).first().click();
  await expect(page.getByRole('button', { pressed: true })).toHaveCount(1);
}

async function reachActiveTurn(page: Page) {
  await page.getByRole('spinbutton', { name: 'Pemain', exact: true }).fill('2');
  await page.getByRole('spinbutton', { name: 'Kartu per pemain' }).fill('1');
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
  await expect(page.getByLabel('60 detik tersisa')).toBeVisible();
}

test('layout khusus tetap terbaca dan stabil', async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    Math.random = () => 0.5;
  });
  await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
  await page.goto('/');
  await page.evaluate(async () => document.fonts.ready);

  if (testInfo.project.name === 'narrow-mobile-chromium') {
    await expect(page).toHaveScreenshot('setup-360.png', { fullPage: true });
  }

  await reachActiveTurn(page);
  await expect(page).toHaveScreenshot('active-turn.png', { fullPage: true });
});
