import type { Page } from 'puppeteer'

// Per-page assertions for examples-site smoke runs — the `check` hook of
// smokeExamplesSite. These live here rather than in each site's smoke.mjs
// because all three products ship the same demos of the same shared API, and a
// check that drifts between them stops being a guard. (The
// don't-factor-anything-out rule in each site's CLAUDE.md is about the *example
// files*, which a reader has to be able to paste; scripts are not that.)

/**
 * Drive a session-in-url demo's real round trip: save the live session into the
 * URL, reload, and confirm the app came back up from it. Both halves are
 * browser-only — deflate + base64 on the way out, the hash read and restore on
 * the way back — so a unit test can't stand in for this.
 *
 * Assumes the demo renders a save button and reports `restored "<name>"` once a
 * session in the URL is applied.
 */
export async function checkSessionUrlRoundTrip(page: Page): Promise<string[]> {
  // scoped to .demo: the doc prose above it renders code blocks that carry
  // their own copy buttons
  const button = await page.$('#session-in-url .demo button')
  if (!button) {
    return ['session-in-url: save button not rendered']
  }
  await button.click()
  const saved = await page
    .waitForFunction(() => window.location.hash.includes('session=encoded-'), {
      timeout: 10000,
    })
    .then(() => true)
    .catch(() => false)
  if (!saved) {
    const hash = await page.evaluate(() => window.location.hash)
    return [`session-in-url: save did not write a session to the url (${hash})`]
  }
  await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {})
  return page
    .waitForFunction(
      () =>
        (
          document.querySelector('#session-in-url .demo')?.textContent ?? ''
        ).includes('restored "'),
      { timeout: 30000 },
    )
    .then(() => [])
    .catch(() => ['session-in-url: the session in the url did not restore'])
}

/**
 * Confirm a runtime-loaded plugin actually took effect, when it loaded at all.
 *
 * If the bundle fetch failed (registry down, no network) this passes — that's
 * an environment problem, already filtered as network noise. But if the bundle
 * DID load and the app still can't resolve the types it provides, the wiring
 * dropped the plugin on the way into the PluginManager, which a load-only check
 * can't see: the page renders, the track just errors.
 *
 * `globalName` is the global a UMD bundle assigns as it evaluates.
 */
export async function checkPluginTookEffect(
  page: Page,
  globalName: string,
): Promise<string[]> {
  const loaded = await page.evaluate(
    name => name in window,
    globalName as keyof Window & string,
  )
  if (!loaded) {
    return []
  }
  const text = await page.evaluate(() => document.body.innerText)
  return /unknown (adapter|track) type/i.test(text)
    ? [`${globalName} loaded but the app did not register its types`]
    : []
}
