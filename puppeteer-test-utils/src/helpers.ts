import type { Page } from 'puppeteer'

export const delay = (ms: number) =>
  new Promise(resolve => setTimeout(resolve, ms))

export async function findByTestId(page: Page, testId: string, timeout = 30000) {
  return page.waitForSelector(`[data-testid="${testId}"]`, {
    timeout,
    visible: true,
  })
}

export async function findByText(
  page: Page,
  text: string | RegExp,
  timeout = 30000,
) {
  const searchText = typeof text === 'string' ? text : text.source
  return page.waitForSelector(`::-p-text(${searchText})`, {
    timeout,
    visible: true,
  })
}

export async function waitForLoadingToComplete(page: Page, timeout = 30000) {
  await page.waitForFunction(
    () =>
      document.querySelectorAll('[data-testid="loading-overlay"]').length === 0,
    { timeout },
  )
}
