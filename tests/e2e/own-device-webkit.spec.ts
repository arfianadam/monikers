import { expect, test } from '@playwright/test';

import {
  chooseOnePrivateCard,
  createMatchingContext,
  createOwnDeviceSession,
  expectSecretAbsent,
  joinOwnDeviceSession,
  lockBothSelections,
  readyPlayersAndStartSelection,
  setCardsPerPlayerToOne,
} from './own-device-helpers';

test('perangkat sempit dapat bergabung, bermain, dan menyambung kembali', async ({
  browser,
  page: creatorPage,
}, testInfo) => {
  const joinerContext = await createMatchingContext(browser, testInfo);
  const joinerPage = await joinerContext.newPage();

  try {
    const creatorName = 'Dinda WebKit';
    const joinerName = 'Raka WebKit';
    const session = await createOwnDeviceSession(creatorPage, creatorName);
    await joinOwnDeviceSession(joinerPage, {
      ...session,
      creatorName,
      playerName: joinerName,
    });

    await setCardsPerPlayerToOne(creatorPage, joinerPage);
    await readyPlayersAndStartSelection(creatorPage, joinerPage);
    await chooseOnePrivateCard(creatorPage);
    await chooseOnePrivateCard(joinerPage);
    await lockBothSelections(creatorPage, joinerPage);

    await creatorPage.getByRole('button', { name: 'Gas 60 detik' }).click();
    const activeCard = creatorPage
      .getByRole('article')
      .getByRole('heading', { level: 1 });
    await expect(activeCard).toBeVisible();
    const secretWord = (await activeCard.innerText()).trim();
    await expectSecretAbsent(joinerPage, secretWord);

    const timer = creatorPage.getByRole('timer');
    const beforeReload = Number(
      (await timer.getAttribute('aria-label'))?.match(/^\d+/)?.[0]
    );

    creatorPage.on('dialog', (dialog) => void dialog.accept());
    await creatorPage.reload();
    await expect(creatorPage).toHaveURL(new RegExp(`${session.sessionPath}$`));
    await expect(
      creatorPage
        .getByRole('article')
        .getByRole('heading', { level: 1, name: secretWord })
    ).toBeVisible();
    await expect(
      creatorPage.getByRole('status').filter({ hasText: 'Online' })
    ).toBeVisible();

    const afterReload = Number(
      (await creatorPage.getByRole('timer').getAttribute('aria-label'))?.match(
        /^\d+/
      )?.[0]
    );
    expect(afterReload).toBeLessThanOrEqual(beforeReload);
    await expectSecretAbsent(joinerPage, secretWord);

    await creatorPage.getByRole('button', { name: 'Stop giliran' }).click();
    await expect(
      joinerPage.getByRole('heading', {
        level: 1,
        name: new RegExp(`${joinerName},\\s*kasih clue\\.`),
      })
    ).toBeVisible();
  } finally {
    await joinerContext.close();
  }
});
