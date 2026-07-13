import { expect, type Page } from '@playwright/test';

export async function expectVisualFontsLoaded(page: Page) {
  const loadedFonts = await page.evaluate(async () => {
    const loadFont = async (font: string, sample: string) => {
      const faces = await document.fonts.load(font, sample);
      return faces.some((face) => face.status === 'loaded');
    };

    const [geistSans, geistMono] = await Promise.all([
      loadFont('900 1rem Geist', 'Monikers'),
      loadFont('800 1rem "Geist Mono"', 'MONIKERS'),
    ]);

    await document.fonts.ready;

    return { geistMono, geistSans };
  });

  expect(loadedFonts).toEqual({
    geistMono: true,
    geistSans: true,
  });
}
