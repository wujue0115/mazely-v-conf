import { test, expect } from '@playwright/test'

// See here how to get started:
// https://playwright.dev/docs/intro
test('visits the app root url', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Watch Vue')).toHaveCount(0)
  await page.getByRole('button', { name: 'Open visualization settings' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByRole('checkbox', { name: 'Automatic rotation' })).toBeChecked()
  await expect(page.getByRole('checkbox', { name: 'Route selection' })).toBeChecked()
  await expect(page.getByRole('navigation', { name: 'Project links' })).toBeVisible()
  await expect(page.getByRole('progressbar', { name: 'Maze generation progress' })).toBeVisible()
  await expect(page.getByLabel('Algorithm')).toHaveValue('recursive-backtracker')
  await expect(page.locator('.maze-canvas')).toBeVisible()
  await expect(page.getByText('Unable to render maze')).toHaveCount(0)
  await expect(page.locator('.bar-btn--primary')).toBeEnabled()
  await page.getByRole('button', { name: 'Close visualization settings' }).click()
  await expect(page.getByRole('dialog')).toBeHidden()
  await page.getByRole('button', { name: 'Show Vite maze' }).click()
  await expect(page.getByRole('button', { name: 'Show Vite maze' })).toHaveAttribute('aria-pressed', 'true')
  await expect.poll(() => page.locator('.hero').evaluate(element => (
    element as HTMLElement
  ).style.getPropertyValue('--theme-primary').trim())).toBe('#8b5cf6')
})
