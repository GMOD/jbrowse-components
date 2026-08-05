import type { Page } from 'puppeteer'

// Its own module because both `helpers.ts` and `snapshot.ts` need it and they
// cannot import each other — helpers already reads `snapshotConfig` from
// snapshot, and snapshot inlines its own loading-overlay wait to avoid closing
// that cycle.

/**
 * Wait until the JBrowse app has rendered something, and say what the page was
 * if it never does.
 *
 * `#root` with children, rather than any test-id, because it is the one element
 * every page of the app has and no non-app page does (see src/index.tsx), and
 * because an error boundary counts as mounted — "the app came up and showed a
 * failure" is a different report from "the app never came up".
 *
 * This is the first stage of every navigation, separately from whatever the
 * caller then waits for. Two reasons:
 *
 * - **Budget.** `page.goto` resolves before the bundle executes, so without this
 *   a caller's wait pays for Chrome's cold start, the bundle, and the config
 *   fetch out of its own deadline. Every `ctgA` flake seen on 2026-08-04 was on
 *   the first tests of a run, where N browsers cold-start at once and that
 *   shared budget is tightest.
 * - **Diagnosis.** A failure here says the app never booted; a failure in the
 *   caller's wait says it booted and the thing being waited for never appeared.
 *   Rolled together they are one indistinguishable "not found".
 */
export async function waitForAppMounted(page: Page, timeout = 60000) {
  try {
    await page.waitForFunction(
      () => (document.getElementById('root')?.childElementCount ?? 0) > 0,
      { timeout, polling: 100 },
    )
  } catch {
    throw new Error(
      `the JBrowse app never mounted — ${await describeUnmounted(page)}`,
    )
  }
}

async function describeUnmounted(page: Page) {
  try {
    const state = await page.evaluate(() => ({
      hasRoot: !!document.getElementById('root'),
      title: document.title,
      url: window.location.href,
    }))
    return state.hasRoot
      ? `#root stayed empty (title "${state.title}", url ${state.url}). The bundle loaded and the app failed to render.`
      : `#root is absent (title "${state.title}", url ${state.url}). The server served something that is not the app — a build mid-write removes build/index.html and the static server answers with a directory listing.`
  } catch {
    return 'the page could not be queried afterwards (context gone)'
  }
}
