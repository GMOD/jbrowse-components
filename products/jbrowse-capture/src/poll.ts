import type { Frame, Page } from 'puppeteer'

/** A page, or a frame inside one such as an embedded JBrowse's iframe. */
export type PageOrFrame = Page | Frame

/** The budget each stage of the ready chain gets unless told otherwise. */
export const DEFAULT_TIMEOUT = 60000

export const delay = (ms: number) =>
  new Promise<void>(resolve => {
    setTimeout(resolve, ms)
  })

/**
 * Poll `read` until it has answered true for `holdMs` without a break, or
 * `timeout` runs out. A `read` that throws ends the wait with its error.
 * Polled from Node because Chrome throttles in-page timers in a background
 * tab, which is what a headless page is.
 */
export async function holdTrue(
  read: () => Promise<boolean>,
  {
    holdMs,
    timeout,
    pollMs,
  }: { holdMs: number; timeout: number; pollMs: number },
): Promise<boolean> {
  const deadline = Date.now() + timeout
  let since: number | undefined
  while (Date.now() < deadline) {
    const ok = await read()
    const now = Date.now()
    if (ok) {
      since ??= now
      if (now - since >= holdMs) {
        return true
      }
    } else {
      since = undefined
    }
    await delay(pollMs)
  }
  return false
}

function isGone(target: PageOrFrame): boolean {
  return 'page' in target
    ? target.detached || isGone(target.page())
    : target.isClosed() || !target.browser().connected
}

const PAGE_GONE = /crashed|Target closed|Session closed|Connection closed/i

/**
 * Await a page query, answering `fallback` when it failed for a reason a later
 * poll can outlive, such as a navigation destroying the execution context. A
 * closed or crashed page throws, since no poll will recover it.
 */
export async function queryWhileOpen<T, F>(
  target: PageOrFrame,
  query: Promise<T>,
  fallback: F,
): Promise<T | F> {
  try {
    return await query
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (PAGE_GONE.test(message) || isGone(target)) {
      throw new Error(
        `the page closed or crashed before it finished rendering (${message})`,
        { cause: error },
      )
    }
    return fallback
  }
}
