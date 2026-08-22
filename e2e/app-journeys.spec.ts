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

  test('Journey 4: Profile settings, daily goals, and licenses navigation', async ({ page }) => {
    await page.goto('/profile');

    await expect(page.locator('text=Scholar Profile').first()).toBeVisible();
    await expect(page.locator('text=Guest Scholar').first()).toBeVisible();

    // Check daily study goal selector
    await expect(page.locator('text=15 min / day').first()).toBeVisible();

    // Open About & Licenses
    await page.locator('text=About & Licenses').first().click();
    await expect(page.locator('text=HSK 3.0 Curriculum Attribution').first()).toBeVisible();
    await expect(page.locator('text=HSK-3.0-2021').first()).toBeVisible();
  });
});
