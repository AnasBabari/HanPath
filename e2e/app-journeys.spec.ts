import fs from 'node:fs';
import path from 'node:path';
import { test, expect, type Page } from '@playwright/test';

const axeSource = fs.readFileSync(path.resolve(process.cwd(), 'node_modules', 'axe-core', 'axe.min.js'), 'utf8');

async function answerExerciseIncorrectly(page: Page): Promise<void> {
  const progressCounter = page.locator('header span').filter({ hasText: /^\d+\/\d+$/ });
  const progressBefore = await progressCounter.textContent();
  const pinyinInput = page.getByLabel('Type Pinyin...');
  if (await pinyinInput.isVisible()) {
    await pinyinInput.fill('intentionally wrong');
  } else {
    const firstAnswer = page.locator('#main-content main button:not([disabled])').filter({
      hasNotText: /^(Replay Audio|Audio Hint|Hide Transcript|Check Answer)$/,
    }).first();
    await expect(firstAnswer).toBeVisible();
    await firstAnswer.click();
  }

  const checkButton = page.getByRole('button', { name: 'Check Answer' });
  await expect(checkButton).toBeEnabled();
  await checkButton.click();
  const continueButton = page.getByRole('button', { name: 'Continue', exact: true });
  await expect(continueButton).toBeVisible();
  await continueButton.click();
  await expect.poll(async () => {
    if (await page.getByRole('heading', { name: 'Lesson Completed!' }).isVisible()) {
      return 'complete';
    }
    return progressCounter.textContent();
  }).not.toBe(progressBefore);
}

test.describe('HànPath Core User Journeys (E2E)', () => {
  test('Journey 1: Guest onboarding, brand header, and Learn timeline', async ({ page }) => {
    await page.goto('/');

    // Verify Brand, HSK level badge and navigation items
    await expect(page.locator('text=HànPath').first()).toBeVisible();
    await expect(page.getByText('HSK 3.0-aligned', { exact: true })).toHaveCount(1);

    // Verify Learn timeline rendered
    await expect(page.getByRole('heading', { name: 'Unit 1: Foundation', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Lesson 1: Available' })).toBeVisible();
  });

  test('Journey 2: Practice Hub is correctly gated for a new guest', async ({ page }) => {
    await page.goto('/practice');

    await expect(page.getByRole('heading', { name: 'Practice Hub Locked' })).toBeVisible();
    await expect(page.getByText('Complete your very first lesson')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Start Lesson 1' })).toBeVisible();
  });

  test('Journey 2b: complete a lesson, unlock review, and persist an SRS rating', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto('/');
    await page.getByRole('button', { name: /Start next lesson:/ }).click();
    await page.getByRole('button', { name: 'Start Lesson' }).click();

    const counter = page.locator('header span').filter({ hasText: /^1\/\d+$/ });
    await expect(counter).toBeVisible();
    const total = Number((await counter.textContent())?.split('/')[1]);
    expect(total).toBeGreaterThan(0);

    let completedExercises = 0;
    while (!(await page.getByRole('heading', { name: 'Lesson Completed!' }).isVisible())) {
      expect(completedExercises).toBeLessThan(total);
      await answerExerciseIncorrectly(page);
      completedExercises += 1;
    }

    expect(completedExercises).toBe(total);
    await expect(page.getByRole('heading', { name: 'Lesson Completed!' })).toBeVisible();
    await page.getByRole('button', { name: 'Continue Learning' }).click();
    await expect(page.getByRole('button', { name: 'Lesson 1: Completed' })).toBeVisible();

    await page.goto('/review');
    await expect(page.getByText('Spaced Review')).toBeVisible();
    await page.getByRole('button', { name: 'Show Answer' }).click();
    await page.getByRole('button', { name: 'Good (Normal)' }).click();

    const persisted = await page.evaluate(() => Object.values(localStorage).join('\n'));
    expect(persisted).toContain('"wordSRS"');
    expect(persisted).toContain('"repetitions":1');
  });

  test('Journey 3: Graded Stories reader and intentional completion', async ({ page }) => {
    await page.goto('/stories');

    await expect(page.getByRole('heading', { name: 'Graded Stories' })).toBeVisible();
    // Check first story title
    await expect(page.locator('text=Hello, Teacher').first()).toBeVisible();

    // Open first story
    await page.locator('text=Hello, Teacher').first().click();

    // Verify reader view
    await expect(page.locator('text=你好，老师').first()).toBeVisible();
    await expect(page.locator('text=Complete Story').first()).toBeVisible();

    // Click Complete Story
    await page.locator('text=Complete Story').first().click();

    await expect(page.getByText('Story Completed (+50 XP Earned)')).toBeVisible();
    const persisted = await page.evaluate(() => Object.values(localStorage).join('\n'));
    expect(persisted).toContain('"readStories"');
    await page.getByRole('button', { name: 'Exit story reader' }).click();
    await expect(page.getByRole('heading', { name: 'Graded Stories' })).toBeVisible();
  });

  test('Journey 4: Profile settings, daily goals, data backup and licenses navigation', async ({ page }) => {
    await page.goto('/profile');

    await expect(page.getByRole('heading', { level: 1, name: 'Profile' })).toBeVisible();
    await expect(page.locator('text=Local Storage Active').first()).toBeVisible();

    // Check daily study goal selector and adjust
    const dailyGoal = page.getByLabel('Daily study goal minutes');
    await expect(dailyGoal).toHaveValue('15');
    await dailyGoal.selectOption('20');
    await expect(dailyGoal).toHaveValue('20');

    // Export and verify a real backup download, not only button visibility.
    const exportBtn = page.getByRole('button', { name: /Export Progress \(JSON\)/ });
    await expect(exportBtn).toBeVisible();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      exportBtn.click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/^hanpath-progress-backup-\d{4}-\d{2}-\d{2}\.json$/);
    const downloadPath = await download.path();
    expect(downloadPath).toBeTruthy();
    const backup = JSON.parse(fs.readFileSync(downloadPath!, 'utf8')) as { schemaVersion?: number };
    expect(backup.schemaVersion).toBe(4);

    // Open About & Licenses
    await page.getByRole('link', { name: /Licenses/ }).last().click();
    await expect(page.locator('text=HSK 3.0 Curriculum Attribution').first()).toBeVisible();
  });

  test('Journey 5: Keyboard navigation and skip-to-content focus', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Unit 1: Foundation', exact: true })).toBeVisible();

    // Press Tab to focus Skip Link
    await page.keyboard.press('Tab');
    const skipLink = page.locator('a:has-text("Skip to main content")');
    await expect(skipLink).toBeFocused();

    // Press Enter to skip to main
    await page.keyboard.press('Enter');
    const mainContent = page.locator('#main-content');
    await expect(mainContent).toBeVisible();
  });

  test('Journey 6: browser axe scan has no serious or critical WCAG violations', async ({ page }) => {
    await page.goto('/');
    await page.addScriptTag({ content: axeSource });

    const violations = await page.evaluate(async () => {
      const axe = (window as unknown as {
        axe: {
          run: (
            context: Document,
            options: { runOnly: { type: string; values: string[] } }
          ) => Promise<{
            violations: Array<{
              id: string;
              impact: string | null;
              nodes: Array<{ target: unknown; html: string; failureSummary?: string }>;
            }>;
          }>;
        };
      }).axe;
      const results = await axe.run(document, {
        runOnly: {
          type: 'tag',
          values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'],
        },
      });
      return results.violations
        .filter(violation => violation.impact === 'serious' || violation.impact === 'critical')
        .map(violation => ({
          id: violation.id,
          impact: violation.impact,
          nodes: violation.nodes.map(node => ({
            target: node.target,
            html: node.html,
            failureSummary: node.failureSummary,
          })),
        }));
    });

    expect(violations).toEqual([]);
  });
});
