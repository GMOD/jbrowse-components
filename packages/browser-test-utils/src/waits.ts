import type { Page } from 'puppeteer'

// Fixed-duration sleep. Shared by the browser-test suites and the website
// screenshot generator so the helper isn't redefined per consumer.
export const delay = (ms: number) =>
  new Promise<void>(resolve => {
    setTimeout(resolve, ms)
  })

// Wait until the LoadingOverlay test-id is gone. NOTE: the overlay keeps the
// literal text "Loading" in the DOM (hidden via opacity), so a text-based wait
// burns its full timeout — only the `loading-overlay` test-id count is a
// reliable signal. With `waitForDownloads`, also wait out adapter "Downloading…"
// status text, which can linger after the overlay clears (e.g. a remote BAM
// still fetching) so a capture doesn't catch a half-loaded track.
export async function waitForLoadingComplete(
  page: Page,
  {
    timeout = 30000,
    waitForDownloads = false,
  }: { timeout?: number; waitForDownloads?: boolean } = {},
) {
  await page.waitForFunction(
    () =>
      document.querySelectorAll('[data-testid="loading-overlay"]').length === 0,
    { timeout },
  )
  if (waitForDownloads) {
    await page
      .waitForFunction(() => !document.body.innerText.includes('Downloading'), {
        timeout,
      })
      .catch(() => {})
  }
}

// Wait until every BaseLinearDisplay wrapper has flipped to its `-done` test-id
// (canvasDrawn fired), or until the timeout elapses (proceed anyway — some views
// show import forms or other non-canvas content with no done test-ids). For
// non-LGV views (synteny, dotplot) the `_done` underscore variant is used; any
// done signal suffices there.
export async function waitForDisplaysDone(page: Page, timeoutMs: number) {
  await page
    .waitForFunction(
      () => {
        const all = document.querySelectorAll('[data-testid^="display-"]')
        if (all.length > 0) {
          const done = document.querySelectorAll(
            '[data-testid^="display-"][data-testid$="-done"]',
          )
          return done.length === all.length
        }
        return (
          document.querySelector(
            '[data-testid$="-done"],[data-testid$="_done"]',
          ) !== null
        )
      },
      { timeout: timeoutMs },
    )
    .catch(() => {})
}
