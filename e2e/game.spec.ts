import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

async function pauseAtCentre(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Pause line' }).click();
  await page.locator('#sentence-carriage').evaluate((carriage) => {
    const animation = carriage.getAnimations()[0];
    const timing = animation?.effect?.getComputedTiming();
    if (animation && typeof timing?.duration === 'number') {
      animation.currentTime = timing.duration / 2;
    }
  });
}

test('starts a shift, repairs a sentence, and exposes the source', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Sentence Factory' })).toBeVisible();
  await page.getByRole('radio', { name: /Past tense/i }).check();
  await page.getByRole('button', { name: /Start shift/i }).click();

  await expect(page.getByRole('heading', { name: 'Sentence Factory' })).toBeVisible();
  await expect(page.getByText('Sentence 1 of 8')).toBeVisible();
  await pauseAtCentre(page);

  const sentenceLayout = await page.locator('#sentence-words').evaluate((words) => ({
    flexWrap: getComputedStyle(words).flexWrap,
    whiteSpace: getComputedStyle(words).whiteSpace,
  }));
  expect(sentenceLayout.flexWrap).toBe('nowrap');
  expect(sentenceLayout.whiteSpace).toBe('nowrap');

  const words = page.locator('#sentence-words button');
  const count = await words.count();

  for (let index = 0; index < count; index += 1) {
    const word = words.nth(index);
    if (!(await word.isDisabled())) await word.dispatchEvent('click');
    if ((await page.getByRole('status').textContent())?.includes('Line repaired')) break;
  }

  await expect(page.getByRole('status')).toContainText('Line repaired');
  await expect(page.locator('.sentence-source')).toContainText('UD English PUD');
  await expect(page.locator('#sentence-carriage')).not.toHaveClass(/is-shipping/);
  await page.waitForTimeout(1_000);
  await expect(page.getByText('Sentence 1 of 8')).toBeVisible();
  await expect(page.locator('#sentence-carriage')).not.toHaveClass(/is-shipping/);
  await expect(page.getByText('Sentence 2 of 8')).toBeVisible();
});

test('moves sentences right to left, pauses, and advances missed sentences', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Start shift/i }).click();

  await expect(page.locator('#landing-view')).toBeHidden();
  await expect(page.locator('#practice')).toBeVisible();
  await expect(page.locator('#sentence-carriage')).toHaveClass(/is-running/);

  const view = await page.locator('#practice').evaluate((practice) => ({
    position: getComputedStyle(practice).position,
    height: practice.getBoundingClientRect().height,
    viewportHeight: window.innerHeight,
    bodyOverflow: getComputedStyle(document.body).overflow,
    beltAnimation: getComputedStyle(document.querySelector('.belt-tread') as Element).animationName,
  }));

  expect(view.position).toBe('fixed');
  expect(view.height).toBeLessThanOrEqual(view.viewportHeight + 1);
  expect(view.bodyOverflow).toBe('hidden');
  expect(view.beltAnimation).toBe('belt-travel');

  const carriage = page.locator('#sentence-carriage');
  const startX = (await carriage.boundingBox())?.x ?? 0;
  await page.waitForTimeout(350);
  const movingX = (await carriage.boundingBox())?.x ?? 0;
  expect(movingX).toBeLessThan(startX);

  await page.getByRole('button', { name: 'Pause line' }).click();
  const pausedX = (await carriage.boundingBox())?.x ?? 0;
  await page.waitForTimeout(350);
  const stillPausedX = (await carriage.boundingBox())?.x ?? 0;
  expect(Math.abs(stillPausedX - pausedX)).toBeLessThan(1);

  await carriage.evaluate((element) => element.getAnimations()[0]?.finish());
  await expect(page.getByText('Sentence 2 of 8')).toBeVisible();
  await expect(page.getByRole('status')).toContainText('Missed');
});

test('supports revealing a repair and changing production lines', async ({ page }) => {
  await page.goto('/');
  await page.locator('label').filter({ hasText: 'Present participles' }).click();
  await expect(page.getByRole('radio', { name: /Present participles/i })).toBeChecked();
  await page.getByRole('button', { name: /Start shift/i }).click();

  await page.getByRole('button', { name: 'Show fix' }).click();
  await expect(page.getByRole('status')).toContainText('Fix shown');

  await page.getByRole('button', { name: 'Change line' }).click();
  await expect(page.getByRole('group', { name: 'Choose a line' })).toBeVisible();
});

test('has no detectable accessibility violations on the landing page or game', async ({ page }) => {
  await page.goto('/');
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  await page.getByRole('button', { name: /Start shift/i }).click();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test('does not overflow a mobile viewport', async ({ page }) => {
  await page.goto('/');
  const dimensions = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));

  expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.client + 1);
});
