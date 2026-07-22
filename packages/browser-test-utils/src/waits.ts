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

// Wait until no element with a *visible* "Loading…/Rendering…/Computing…" label
// remains on screen. Complements waitForLoadingComplete (which keys off the
// loading-overlay test-id and "Downloading" text): some views — e.g. the
// Protein3d ProteinView's "Loading pairwise alignment" banner — paint their own
// transient status text that no test-id covers, and a screenshot taken while it
// shows captures a half-loaded view.
//
// The match is visibility-aware on purpose. The LoadingOverlay keeps the literal
// word "Loading" in the DOM hidden via opacity:0, so a plain text search would
// never clear; here we ignore any element that (or whose ancestor) is
// display:none / visibility:hidden / opacity:0 / zero-size. We compare each
// element's OWN text nodes (not descendant text) so a large container that
// merely wraps a loading child doesn't count.
//
// Best-effort: a view that is genuinely stuck loading (rather than slow) would
// otherwise burn the whole timeout, so we swallow the rejection and let the
// caller proceed — no worse than not waiting, and slow-but-finishing views now
// get captured at the right moment instead of relying on a fixed settle.
export async function waitForQuiescent(
  page: Page,
  {
    timeout = 30000,
    pattern = /^(loading|rendering|computing|aligning)\b/i,
  }: { timeout?: number; pattern?: RegExp } = {},
) {
  await page
    .waitForFunction(
      (source: string, flags: string) => {
        const re = new RegExp(source, flags)
        const visible = (el: Element) => {
          let cur: Element | null = el
          while (cur) {
            const s = getComputedStyle(cur)
            if (
              s.display === 'none' ||
              s.visibility === 'hidden' ||
              Number(s.opacity) === 0
            ) {
              return false
            }
            cur = cur.parentElement
          }
          const r = el.getBoundingClientRect()
          return r.width > 0 && r.height > 0
        }
        const ownText = (el: Element) =>
          Array.from(el.childNodes)
            .filter(n => n.nodeType === Node.TEXT_NODE)
            .map(n => n.textContent ?? '')
            .join('')
            .trim()
        for (const el of document.querySelectorAll('body *')) {
          const t = ownText(el)
          if (t.length > 0 && t.length < 80 && re.test(t) && visible(el)) {
            return false
          }
        }
        return true
      },
      { timeout },
      pattern.source,
      pattern.flags,
    )
    .catch(() => {})
}

// A display wrapper mounts carrying its base test-id and flips that id in place
// to `<base>-done` when canvasDrawn fires (DisplayChrome owns the suffix), so
// "every display has painted" is exactly "no wrapper is still wearing its base
// id". Bases come in three shapes: `display-<displayId>` (BaseLinearDisplay,
// alignments, maf), `<name>-display` (wiggle, variant, hic, ld, manhattan,
// arc, pileup, …), and synteny's `synteny_canvas`.
const PENDING_DISPLAYS = [
  '[data-testid^="display-"]:not([data-testid$="-done"])',
  '[data-testid$="-display"]',
  '[data-testid="synteny_canvas"]',
].join(',')

// Wait until no display wrapper is still pending its first paint, or until the
// timeout elapses (proceed anyway — a display stuck in its too-large/error state
// renders no wrapper at all and never reports done).
//
// Keying on the *absence* of pending wrappers rather than counting done-vs-total
// matters twice over. A page with no canvas displays — an import form, a menu or
// widget figure — resolves immediately instead of burning the full timeout as a
// hidden fixed sleep. And a page whose displays finish at different times waits
// for the last one; the previous "any element ends in -done" fallback returned as
// soon as the *first* of several tracks painted.
//
// Absence is only meaningful once the views have mounted (a track's display
// wrapper mounts with its TrackRenderingContainer), so call this after the
// readySelector / loading-overlay gates, not straight off a navigation.
export async function waitForDisplaysDone(page: Page, timeoutMs: number) {
  await page
    .waitForFunction(
      (selector: string) => document.querySelector(selector) === null,
      { timeout: timeoutMs },
      PENDING_DISPLAYS,
    )
    .catch(() => {})
}
