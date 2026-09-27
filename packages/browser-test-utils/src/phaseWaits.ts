import type { Page } from 'puppeteer'

// Waits on the absence of one working signal. An app that has not started
// publishes none of them either, so each is meaningful only after something
// positive has passed, and none is a readiness gate on its own:
// `waitForJBrowseReady` / `waitForAppSettled` in @jbrowse/capture are.

export const delay = (ms: number) =>
  new Promise<void>(resolve => {
    setTimeout(resolve, ms)
  })

interface WaitOptions {
  timeout?: number
}

export const LOADING_OVERLAY = '[data-testid="loading-overlay"]'

const LOADING_DISPLAYS = '[data-display-phase="loading"]'

/** Everything the app publishes to say it is working, as one selector. */
export const BUSY_SELECTOR = [
  LOADING_OVERLAY,
  '[data-busy="true"]',
  LOADING_DISPLAYS,
  '[data-view-phase="loading"]',
  '[data-display-animating="true"]',
].join(', ')

export function isPageBusyInPage(busySelector: string) {
  return document.querySelector(busySelector) !== null
}

function absent(page: Page, selector: string, timeout: number) {
  return page.waitForFunction(
    (s: string) => document.querySelector(s) === null,
    { timeout, polling: 'mutation' },
    selector,
  )
}

async function settled(work: Promise<unknown>) {
  try {
    await work
    return true
  } catch {
    return false
  }
}

/** Throws if the loading overlay is still up after `timeout`. */
export async function waitForLoadingComplete(
  page: Page,
  { timeout = 30000 }: WaitOptions = {},
) {
  await absent(page, LOADING_OVERLAY, timeout)
}

/** Wait until nothing on the page reports itself busy. False on timeout. */
export function waitForQuiescent(
  page: Page,
  { timeout = 30000 }: WaitOptions = {},
) {
  return settled(absent(page, BUSY_SELECTOR, timeout))
}

/** Wait until no display is fetching. False on timeout. */
export function waitForDisplayPhases(
  page: Page,
  { timeout = 30000 }: WaitOptions = {},
) {
  return settled(absent(page, LOADING_DISPLAYS, timeout))
}

/**
 * Throws unless every view has resolved its assembly and loaded its
 * component within `timeout`.
 */
export async function waitForViewPhases(
  page: Page,
  { timeout = 30000 }: WaitOptions = {},
) {
  await absent(
    page,
    '[data-view-phase="loading"], [data-view-component-pending]',
    timeout,
  )
}
