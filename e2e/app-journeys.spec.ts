import { test, expect } from '@playwright/test';

test.describe('HànPath Core User Journeys (E2E)', () => {
  test.beforeEach(async ({ page }) => {
    // Seed initial clean guest storage before each test
    await page.addInitScript(() => {
      window.localStorage.clear();
    });
  });

  test('Journey 1: Guest onboarding, brand header, and Learn timeline', async ({ page }) => {
    await page.goto('/');

    // Verify Brand, HSK level badge and navigation items
    await expect(page.locator('text=HànPath').first()).toBeVisible();
    await expect(page.locator('text=HSK 3.0 Standard').first()).toBeVisible();

    // Verify Learn timeline rendered
    await expect(page.locator('text=Unit 1: Foundations & Greetings').first()).toBeVisible();
    await expect(page.locator('text=Lesson 1: Essential Vocabulary').first()).toBeVisible();
  });

  test('Journey 2: Practice Hub navigation and review mode', async ({ page }) => {
    await page.goto('/practice');

    await expect(page.locator('text=Practice & Mastery').first()).toBeVisible();
    // Practice categories visible
    await expect(page.locator('text=Smart SRS Review').first()).toBeVisible();
    await expect(page.locator('text=Tone Training').first()).toBeVisible();
    await expect(page.locator('text=Sentence Builder').first()).toBeVisible();
  });

  test('Journey 3: Graded Stories reader and intentional completion', async ({ page }) => {
    await page.goto('/stories');

    await expect(page.locator('text=Graded Stories').first()).toBeVisible();
    // Check first story title
    await expect(page.locator('text=Hello, Teacher').first()).toBeVisible();

    // Open first story
    await page.locator('text=Hello, Teacher').first().click();

    // Verify reader view
    await expect(page.locator('text=你好，老师').first()).toBeVisible();
    await expect(page.locator('text=Complete Story').first()).toBeVisible();

    // Click Complete Story
    await page.locator('text=Complete Story').first().click();

    // Returns back to story library
    await expect(page.locator('text=Graded Stories').first()).toBeVisible();
  });

  test('Journey 4: Profile settings, daily goals, data backup and licenses navigation', async ({ page }) => {
    await page.goto('/profile');

    await expect(page.locator('h1:has-text("Profile")').first()).toBeVisible();
    await expect(page.locator('text=Local Storage Active').first()).toBeVisible();

    // Check daily study goal selector and adjust
    const goalSelect = page.locator('select[aria-label="Daily study goal minutes"]');
    await expect(goalSelect).toBeVisible();
    await goalSelect.selectOption('20');

    // Verify Export Progress button is present and accessible
    const exportBtn = page.locator('button:has-text("Export Progress (JSON)")').first();
    await expect(exportBtn).toBeVisible();

    // Open About & Licenses
    await page.locator('text=Attribution & Open Source Licenses').first().click();
    await expect(page.locator('text=HSK 3.0 Curriculum Attribution').first()).toBeVisible();
  });

  test('Journey 5: Keyboard navigation and skip-to-content focus', async ({ page }) => {
    await page.goto('/');

    // Press Tab to focus Skip Link
    await page.keyboard.press('Tab');
    const skipLink = page.locator('a:has-text("Skip to main content")');
    await expect(skipLink).toBeFocused();

    // Press Enter to skip to main
    await page.keyboard.press('Enter');
    const mainContent = page.locator('#main-content');
    await expect(mainContent).toBeVisible();
  });
});
