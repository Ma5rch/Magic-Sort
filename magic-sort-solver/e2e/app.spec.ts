import { expect, test } from '@playwright/test';

test('Beispiel laden, lösen, Lösung durchsteppen – ohne horizontales Scrollen', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Magic Sort Solver' })).toBeVisible();
  await page.getByRole('button', { name: 'Beispiellevel laden' }).tap();
  await page.getByRole('button', { name: 'Level lösen' }).tap();
  await expect(page.getByText(/Lösung gefunden und geprüft/)).toBeVisible({ timeout: 45_000 });
  await page.getByRole('button', { name: 'Nächster Zug' }).tap();
  await expect(page.getByText(/Zug 1 von/)).toBeVisible();
  await page.getByRole('button', { name: 'Vorheriger Zug' }).tap();
  await expect(page.getByText(/Ausgangszustand/)).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test('Touch-Ziele der Hauptaktionen sind mindestens 44 × 44 px', async ({ page }) => {
  await page.goto('/');
  for (const name of ['Level lösen', 'Level manuell eingeben', 'Screenshot analysieren']) {
    const box = await page.getByRole('button', { name }).boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
  }
});

test('Offline: nach dem ersten Laden startet die App ohne Netz', async ({ page, context }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload(); // SW übernimmt die Kontrolle
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Magic Sort Solver' })).toBeVisible();
  await page.getByRole('button', { name: 'Beispiellevel laden' }).tap();
  await page.getByRole('button', { name: 'Level lösen' }).tap(); // Worker kommt aus dem Cache
  await expect(page.getByText(/Lösung gefunden und geprüft/)).toBeVisible({ timeout: 45_000 });
});
