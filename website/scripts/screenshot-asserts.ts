// The gates a capture has to pass before its PNG is allowed to exist, plus the
// debug dump every one of them leaves behind on the way out.
//
// They are separate checks rather than one because they fail for different
// reasons and a run has to say which: a view that never launched, a view that
// launched and drew nothing, a view still showing a spinner or an error, and a
// document that was swapped out from under the capture. Each one here is a
// figure that shipped wrong before it existed.
import fs from 'node:fs'
import path from 'node:path'

import { debugDir } from './paths.ts'

import type { BrowserScreenshotSpec } from './screenshot-specs.ts'
import type { Page } from 'puppeteer'

// The view tree a spec asks for, read back out of its own `session=spec-…`
// query. Nested `views` (a synteny/dotplot/breakpoint view's panels) are kept,
// because a parent that launches with no panels is the same failure one level
// down. Specs with no session spec (the landing pages) declare nothing.
interface DeclaredView {
  type: string
  views: DeclaredView[]
}

function declaredSubviews(views: unknown): DeclaredView[] {
  return Array.isArray(views)
    ? views.map(v => {
        const view = (typeof v === 'object' && v !== null ? v : {}) as {
          type?: unknown
          views?: unknown
        }
        return {
          type: typeof view.type === 'string' ? view.type : 'view',
          views: declaredSubviews(view.views),
        }
      })
    : []
}

function declaredViews(spec: BrowserScreenshotSpec): DeclaredView[] {
  let declared: DeclaredView[] = []
  if (spec.mode === 'url') {
    const query = spec.url.slice(spec.url.indexOf('?') + 1)
    const session = new URLSearchParams(query).get('session')
    if (session?.startsWith('spec-')) {
      try {
        const parsed: unknown = JSON.parse(session.slice('spec-'.length))
        if (typeof parsed === 'object' && parsed !== null) {
          declared = declaredSubviews((parsed as { views?: unknown }).views)
        }
      } catch {
        // a non-spec session (share link, encoded snapshot) declares nothing
      }
    }
  }
  return declared
}

// The semantic counterpart to the per-symptom checks below: a spec that asks for
// N views and ends up with fewer is broken however the app reported it — an
// error snackbar, a silent no-op, or nothing at all. Compares the spec's own
// declared view tree against the live `window.JBrowseSession`, which is the same
// model the annotation anchors resolve through.
//
// A floor, not an equality: an `actions` chain can legitimately OPEN a view (and
// nothing in the suite closes one), so extra views are fine while a missing one
// is not. Runs even under `allowUnsettled` — that opts out of "still loading",
// not out of "the view never existed".
export async function assertViewsPresent(
  page: Page,
  spec: BrowserScreenshotSpec,
) {
  const declared = declaredViews(spec)
  if (declared.length > 0) {
    const problems = await page.evaluate((want: DeclaredView[]) => {
      interface LiveView {
        views?: LiveView[]
      }
      const session = (
        window as unknown as { JBrowseSession?: { views?: LiveView[] } }
      ).JBrowseSession
      const found: { path: string; declared: number; actual: number }[] = []
      const walk = (
        wanted: DeclaredView[],
        live: LiveView[] | undefined,
        path: string,
      ) => {
        const actual = live ?? []
        if (actual.length < wanted.length) {
          found.push({ path, declared: wanted.length, actual: actual.length })
        }
        wanted.forEach((w, i) => {
          const child = actual[i]
          if (child && w.views.length > 0) {
            walk(w.views, child.views, `${path} > ${w.type}[${i}]`)
          }
        })
      }
      walk(want, session?.views, 'session')
      return found
    }, declared)
    if (problems.length > 0) {
      await debugDump(page, spec.name)
      const detail = problems
        .map(p => `${p.path}: declared ${p.declared}, got ${p.actual}`)
        .join(' | ')
      throw new Error(
        `spec declares views that the session does not have: ${detail}. ` +
          `A view that fails to launch leaves the capture blank or half-built ` +
          `— check the session spec's shape (panels belong under \`views\`).`,
      )
    }
  }
}

// Guard against capturing a view that rendered no content. The ViewContainer
// always renders its header chrome, so a screenshot with header-but-empty-body
// (e.g. a render regression) still "succeeds" and slips through review. A
// healthy view — including an import form — fills its body, so an empty body
// uniquely signals a broken render.
export async function assertViewsRendered(page: Page, name: string) {
  const emptyViews = await page.evaluate(() =>
    Array.from(
      document.querySelectorAll<HTMLElement>(
        '[data-testid^="view-container-"]',
      ),
    )
      .filter(c => {
        const body = c.lastElementChild
        return !body || body.childElementCount === 0
      })
      .map(c => c.dataset.testid ?? '?'),
  )
  if (emptyViews.length > 0) {
    await debugDump(page, name)
    throw new Error(`view(s) rendered blank: ${emptyViews.join(', ')}`)
  }
}

// Guard against silently saving a half-rendered capture: at shoot time no
// display should still show a *visible* loading overlay, an error banner, or a
// region-too-large message. These slip past the readiness waits when a fetch
// starts after them (the FetchVisibleRegions autorun debounces ~600ms, so
// waitForLoadingComplete can pass before the overlay even appears) or when a
// worker RPC errors/hangs — exactly the states that otherwise render as an
// unnoticed "Loading" PNG. Detection mirrors waitForQuiescent's visibility rules
// (an element counts only if it and its ancestors aren't display:none /
// visibility:hidden / opacity:0 / zero-size) so the opacity-hidden idle overlay
// doesn't false-positive. Opt out per spec with `allowUnsettled` when the state
// IS the subject.
//
// Deliberately keyed off test-ids and TooLargeMessage's own literal rather than
// waitForQuiescent's /^(loading|rendering|…)/ pattern: that pattern is safe for a
// *wait* (a false match only costs a swallowed timeout) but not for an assertion
// — the open track menu's "Rendering mode" item matches it, which failed the
// trio-matrix specs while catching nothing real across the suite.
export async function assertRenderSettled(
  page: Page,
  spec: BrowserScreenshotSpec,
) {
  const problems = await page.evaluate(() => {
    const isVisible = (el: Element) => {
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
    const found: { kind: string; text: string }[] = []

    // a view still waiting on its assembly / init navigation paints a spinner in
    // place of its whole body (ViewContainer: data-view-phase)
    for (const el of document.querySelectorAll('[data-view-phase="loading"]')) {
      if (isVisible(el)) {
        found.push({
          kind: 'view-loading',
          text: (el as HTMLElement).innerText.slice(0, 200),
        })
      }
    }
    // loading overlay (LoadingOverlay: data-testid="loading-overlay")
    for (const el of document.querySelectorAll(
      '[data-testid="loading-overlay"]',
    )) {
      if (isVisible(el)) {
        found.push({
          kind: 'loading-overlay',
          text: (el as HTMLElement).innerText.slice(0, 200),
        })
      }
    }
    // error banner (ErrorBar and ErrorBanner both render a
    // data-testid="reload_button" for their retry)
    for (const el of document.querySelectorAll(
      '[data-testid="reload_button"]',
    )) {
      if (isVisible(el)) {
        // the retry button sits in the Alert's action slot, whose own div holds
        // only buttons — climb to the Alert itself or the message is empty
        const bar = el.closest('[role="alert"]') ?? el.closest('div') ?? el
        found.push({
          kind: 'error-banner',
          text: (bar as HTMLElement).innerText.slice(0, 300),
        })
      }
    }
    // error snackbar (session.notifyError -> SnackbarContents, which tags its
    // Alert data-testid="snackbar-<level>"). A different surface from the
    // ErrorBar above, and it carries no reload_button, so a view that failed to
    // *launch* used to capture a blank page and report success: two
    // BreakpointSplitView figures that passed their panels under `init` instead
    // of `views` shipped as empty sessions before this check existed. Warnings
    // are not failures; only the error level is.
    for (const el of document.querySelectorAll(
      '[data-testid="snackbar-error"]',
    )) {
      if (isVisible(el)) {
        found.push({
          kind: 'error-snackbar',
          text: (el as HTMLElement).innerText.slice(0, 300),
        })
      }
    }
    // The red box ErrorMessage/ErrorBanner render into, which is a THIRD error
    // surface: it carries no reload_button and is not a snackbar, so it sailed
    // past both checks above. A full sweep found it the only way it could be
    // found — by eye, on a committed figure: `sv_synteny/dotplot_import` and
    // `sv_cgiab/dotplot_import_form` had been publishing an MST type error
    // banner across the top of the import form they are supposed to be showing.
    for (const el of document.querySelectorAll(
      '[data-testid="error-message-box"]',
    )) {
      if (isVisible(el)) {
        found.push({
          kind: 'error-box',
          text: (el as HTMLElement).innerText.slice(0, 300),
        })
      }
    }

    // region-too-large message (TooLargeMessage's BlockMsg carries no test-id, so
    // key off its own literal); own text nodes only, so the wrapping Alert and
    // every ancestor up to body don't each report the same message.
    //
    // Candidates come from a text-node walk rather than `body *` for the same
    // reason waitForQuiescent's do: only an element with own text can match
    // either literal below, and building the own-text string for every element
    // on a heavy page is the expensive part. Same set, a fraction of the work.
    const candidates = new Set<Element>()
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
    )
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const parent = n.parentElement
      if (parent && parent !== document.body && (n.textContent ?? '').trim()) {
        candidates.add(parent)
      }
    }
    for (const el of candidates) {
      const own = Array.from(el.childNodes)
        .filter(n => n.nodeType === Node.TEXT_NODE)
        .map(n => n.textContent ?? '')
        .join('')
        .trim()
      if (
        own.toLowerCase().includes('force load (may be slow)') &&
        isVisible(el)
      ) {
        found.push({ kind: 'region-too-large', text: own.slice(0, 200) })
      }
      // a view stuck before its tracks mount paints a bare "Loading" with no
      // overlay test-id at all — that shipped a blank capture once. Anchor the
      // whole text so a menu item ("Rendering mode") can't match the way
      // waitForQuiescent's prefix pattern did.
      if (
        /^(loading|rendering|computing|aligning)([.…]{1,3}|\s+\d{1,3}%)?$/i.test(
          own,
        ) &&
        isVisible(el)
      ) {
        found.push({ kind: 'status-text', text: own.slice(0, 200) })
      }
    }
    // dedupe by kind+text
    const seen = new Set<string>()
    return found.filter(f => {
      const k = `${f.kind}:${f.text}`
      return seen.has(k) ? false : (seen.add(k), true)
    })
  })
  if (problems.length > 0) {
    await debugDump(page, spec.name)
    const detail = problems
      .map(p => `${p.kind}: ${p.text.replaceAll(/\s+/g, ' ').trim()}`)
      .join(' | ')
    throw new Error(
      `capture not settled (still shows loading/error/too-large): ${detail}. ` +
        `If this state is the intended subject, set allowUnsettled: true on the spec.`,
    )
  }
}

// What the page looked like when a wait gave up. Both halves report their own
// failure rather than swallowing it, because a dump that is merely absent is the
// single most misleading thing this pipeline can produce: it used to print the
// path unconditionally, so a run announced a frame that was never written and
// the reader went looking in the app for a fault that was in the machine. An
// empty `debug text` plus no file means the renderer was gone — nothing about
// the figure, and no timeout will fix it.
export async function debugDump(page: Page, name: string) {
  const bodyText = await page
    .evaluate(() => document.body.innerText.substring(0, 800))
    .catch(() => undefined)
  console.error(
    bodyText === undefined
      ? `    [${name}] debug text: <page unreachable>`
      : `    [${name}] debug text: ${bodyText.replaceAll(/\s+/g, ' ').trim()}`,
  )
  const debugPath = path.join(debugDir, `${name.replaceAll('/', '_')}.png`)
  try {
    fs.mkdirSync(debugDir, { recursive: true })
    fs.writeFileSync(debugPath, await page.screenshot())
    console.error(`    [${name}] debug screenshot: ${debugPath}`)
  } catch (e) {
    console.error(
      `    [${name}] no debug screenshot: ${e instanceof Error ? e.message : String(e)}`,
    )
  }
}

// Liveness token for assertSamePageAsReady below. Set once the page is ready,
// checked immediately before every screenshot.
const ALIVE_TOKEN = '__jbShotAlive'

export function markPageAlive(page: Page) {
  return page.evaluate(token => {
    Object.assign(window, { [token]: true })
  }, ALIVE_TOKEN)
}

// Fail if the document we readied is not the document we are about to shoot.
// A renderer crash or an app reload gives Chrome a brand-new frame, and the
// readiness waits happily pass on it a second time, so the capture lands on a
// bare "Loading" panel — that is how a blank whole-genome TCGA cohort frame
// got committed over a good one. `assertRenderSettled` can't be relied on to
// catch it: it runs before the reload can happen, and the post-reload page is
// briefly indistinguishable from a slow first paint.
//
// A `window` token rather than the `framenavigated` event on purpose: JBrowse
// rewrites its own URL through history.replaceState as the session changes,
// which fires that event on every spec and would fail all of them. A
// same-document rewrite leaves the token in place; only a real document swap
// clears it.
export async function assertSamePageAsReady(
  page: Page,
  spec: BrowserScreenshotSpec,
) {
  const alive = await page.evaluate(token => token in window, ALIVE_TOKEN)
  if (!alive) {
    throw new Error(
      `page reloaded between readiness and capture (${spec.name}) — the renderer ` +
        `most likely crashed, so the frame being captured is a fresh, still-loading ` +
        `document rather than the view that was waited on. Nothing was written.`,
    )
  }
}
