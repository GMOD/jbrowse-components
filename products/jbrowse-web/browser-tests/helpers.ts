import { Buffer } from 'node:buffer'

import {
  delay,
  displayPainted,
  encodeSessionSpec,
  waitForLoadingComplete,
  waitForSelectorAttributed,
  waitForViewPhases,
} from '@jbrowse/browser-test-utils'

import { waitForAppMounted } from './appMounted.ts'
import { analyzeCanvasPng, assertNonBlank } from './canvasContent.ts'
import {
  canvasSelfReport,
  captureElementPng,
  snapshotConfig,
} from './snapshot.ts'

import type { Browser, ElementHandle, Page } from 'puppeteer'

// re-exported so the suites keep importing it from './helpers'
export { delay }

// Not a constant: the runner may have to move off the default when another
// process in the worktree holds it, and every url built below has to follow.
// Read through the live binding rather than copying it into a module scope.
export let PORT = 3333
export function setPort(port: number) {
  PORT = port
}
export const OAUTH_PORT = 3030
export const BASICAUTH_PORT = 3040

export function appendGpuParam(url: string) {
  const { backend } = snapshotConfig
  if (!backend) {
    return url
  }
  const sep = url.includes('?') ? '&' : '?'
  return `${url}${sep}renderer=${backend}`
}

// Both finders below RESOLVE TO A HANDLE OR THROW — never to null. That matters
// because essentially every caller is `(await findByX(...)).click()`, and while
// they returned `ElementHandle | null` those calls were written `?.click()`,
// which turns "the thing I need isn't there" into a silent no-op: the test kept
// going, asserted against a page nothing had been clicked on, and passed or
// failed somewhere unrelated. `waitForSelector` only returns null for a
// `hidden: true` wait, which neither of these does.
//
// What they throw is the display census, not puppeteer's bare `TimeoutError`:
// the commonest reason either one expires is a display that never got there,
// and its own phase is what separates a slow fetch from a display that says it
// finished without painting. See `waitForSelectorAttributed`.
export function findByTestId(
  page: Page,
  testId: string,
  timeout = 30000,
): Promise<ElementHandle> {
  return waitForSelectorAttributed(page, `[data-testid="${testId}"]`, timeout)
}

/**
 * Wait for a display of the given TYPE to finish first paint.
 *
 * The puppeteer counterpart of the jest `findDisplayPainted`, and what replaced
 * `findByTestId(page, '<base>-done')`: `data-testid` names the type and no
 * longer mutates on paint, so readiness is `data-display-drawn` (ADR-065).
 */
export function findDisplayPainted(
  page: Page,
  testId: string,
  timeout = 30000,
): Promise<ElementHandle> {
  return waitForSelectorAttributed(page, displayPainted(testId), timeout)
}

// What the page looked like when a wait gave up. Separates the two failures
// that a bare "not found" conflates — the deadline expired with the app in some
// state, versus the evaluation never got to run — and reports the app's own
// startup stages, so "never mounted", "mounted but the assembly never arrived"
// and "loaded fine, the text is simply absent" are distinguishable from the
// message alone. Best-effort: a destroyed context can't be queried either, and
// saying so is itself the answer.
async function describePage(page: Page, timeout: number, cause: unknown) {
  const reason = String(cause)
  const timedOut = /waiting failed|timeout/i.test(reason)
  const stage = timedOut
    ? `waited ${timeout}ms`
    : `the wait itself failed (${reason.split('\n')[0]})`
  try {
    const state = await page.evaluate(() => ({
      rootChildren: document.getElementById('root')?.childElementCount ?? -1,
      loadingOverlays: document.querySelectorAll(
        '[data-testid="loading-overlay"]',
      ).length,
      url: window.location.href,
      // enough to tell an error boundary or a "no assembly" message from a
      // rendered view, without pasting a whole page into the log
      text: document.body.textContent.replaceAll(/\s+/g, ' ').slice(0, 300),
    }))
    return `${stage}; #root children ${state.rootChildren}, ${state.loadingOverlays} loading overlay(s), url ${state.url}, body text: "${state.text}"`
  } catch {
    return `${stage}; the page could not be queried afterwards (context gone)`
  }
}

// Wait for the deepest element whose trimmed text matches, and hand back a
// handle to it. The predicate crosses into the page, so it takes a regex as
// source+flags rather than as a RegExp.
async function waitForTextMatch(
  page: Page,
  source: string,
  flags: string,
  timeout: number,
  describe: string,
): Promise<ElementHandle> {
  const handle = await page
    .waitForFunction(
      (src: string, f: string) => {
        const re = new RegExp(src, f)
        const walk = document.createTreeWalker(
          document.body,
          NodeFilter.SHOW_ELEMENT,
        )
        let match: Node | null = null
        for (let node = walk.nextNode(); node; node = walk.nextNode()) {
          if (re.test((node.textContent ?? '').trim())) {
            match = node
          }
        }
        return match
      },
      { timeout },
      source,
      flags,
    )
    .catch(async (cause: unknown) => {
      // `waitForFunction` rejects for two unrelated reasons and this used to
      // report both as "no element with text X": the deadline expired, or the
      // evaluation itself blew up (execution context destroyed by a navigation,
      // target closed). They need opposite responses — wait longer vs. look at
      // what the page did — so say which one happened, and describe the page
      // rather than only the text that was missing. Diagnosing the `ctgA` flake
      // was guesswork without this.
      throw new Error(
        `no element with text ${describe} — ${await describePage(page, timeout, cause)}`,
        { cause },
      )
    })
  const el = handle.asElement()
  if (!el) {
    throw new Error(`no element with text ${describe}`)
  }
  return el as ElementHandle
}

const escapeRegExp = (s: string) => s.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&')

export async function findByText(
  page: Page,
  text: string | RegExp,
  timeout = 30000,
): Promise<ElementHandle> {
  if (typeof text === 'string') {
    // ::-p-text() is unreliable in Firefox BiDi with per-browser restarts.
    // Fall back to the DOM walk if the Puppeteer selector fails. The fallback
    // used to only wait for the text to EXIST and then return null, so from
    // there on every caller's click silently did nothing.
    try {
      const handle = await page.waitForSelector(`::-p-text(${text})`, {
        timeout: Math.min(timeout, 3000),
      })
      if (handle) {
        return handle
      }
    } catch {
      // fall through to the DOM walk
    }
    return waitForTextMatch(
      page,
      escapeRegExp(text),
      '',
      timeout,
      JSON.stringify(text),
    )
  }
  // ::-p-text() can't do regex — it matches the source string literally, so
  // anchors (`^identity$`) and escapes never hit.
  return waitForTextMatch(page, text.source, text.flags, timeout, String(text))
}

export async function waitForLoadingToComplete(page: Page, timeout = 30000) {
  await waitForLoadingComplete(page, { timeout })
}

export async function waitForDataLoaded(page: Page, timeout = 60000) {
  // A view still waiting on its assembly has no displays mounted, so it raises no
  // overlay at all and every wait below reads "loaded" through it
  await waitForViewPhases(page, timeout)
  // Wait for loading overlay to appear (briefly) then disappear.
  // Use a short timeout since fast-loading data may never show the overlay.
  try {
    await page.waitForSelector('[data-testid="loading-overlay"]', {
      timeout: 500,
    })
  } catch {
    // loading may have completed before we checked — that's fine
  }
  await waitForLoadingComplete(page, { timeout })
}

// Firefox BiDi (the webgpu backend) stalls on networkidle0 — analytics requests
// keep the network busy past the 30s idle wait. 'load' is reliable there. Chrome
// backends keep networkidle0 (it settles fast and waits out late-loading data).
function gotoWaitUntil(): 'load' | 'networkidle0' {
  return snapshotConfig.backend === 'webgpu' ? 'load' : 'networkidle0'
}

// Navigate to an app URL given the query string after `?` (e.g.
// `config=...&sessionName=...`). Centralizes the gpu-param append and the
// backend-aware wait so suites stop hardcoding `networkidle0`, which stalls the
// webgpu (Firefox BiDi) backend — see gotoWaitUntil.
export async function navigateToUrl(page: Page, query: string) {
  const url = appendGpuParam(`http://localhost:${PORT}/?${query}`)
  await page.goto(url, { waitUntil: gotoWaitUntil(), timeout: 60000 })
  // Navigation isn't finished until the app is on screen: `goto` resolves
  // before the bundle executes, so without this every caller's own wait is also
  // paying for Chrome's cold start out of its deadline. See waitForAppMounted.
  await waitForAppMounted(page)
}

export async function navigateToApp(
  page: Page,
  config = 'test_data/volvox/config.json',
  sessionName = 'Test Session',
) {
  await navigateToUrl(
    page,
    `config=${config}&sessionName=${encodeURIComponent(sessionName)}`,
  )
  await findByText(page, 'ctgA')
}

export async function navigateWithSessionSpec(
  page: Page,
  spec: Record<string, unknown>,
  config = 'test_data/volvox/config.json',
) {
  await navigateToUrl(
    page,
    `config=${config}&session=${encodeSessionSpec(spec)}&sessionName=Test%20Session`,
  )
}

// Click the zoom-out button `times` times, then wait for the re-fetch to
// settle. Used by redraw tests that verify a track repaints after zooming.
export async function zoomOut(page: Page, times = 1) {
  const button = await findByTestId(page, 'zoom_out', 10000)
  for (let i = 0; i < times; i++) {
    await button.click()
  }
  await delay(2000)
  await waitForDataLoaded(page, 90000)
}

export async function openTrack(page: Page, trackId: string) {
  const trackLabel = await findByTestId(
    page,
    `htsTrackLabel-Tracks,${trackId}`,
    10000,
  )
  await trackLabel.click()
}

export async function waitForDisplay(
  page: Page,
  trackId: string,
  timeout = 60000,
) {
  await page.waitForSelector(`[data-display-id^="${trackId}"]`, { timeout })
}

/**
 * Wait for one specific display to finish its first paint.
 *
 * `data-display-id` + `data-display-drawn`, not a testid: a `data-testid` is the
 * display *type*'s base (`maf-display`, `feature-display`), so two tracks of the
 * same type share it and it says nothing about paint state. This pair says which
 * display and whether it painted, without either ambiguity. Replaced
 * `findByTestId(page, 'display-<displayId>-done')`, which worked only while a
 * second wrapper element existed to emit that id.
 */
export async function waitForDisplayDrawn(
  page: Page,
  displayId: string,
  timeout = 60000,
) {
  await page.waitForSelector(
    `[data-display-id="${displayId}"][data-display-drawn="true"]`,
    { timeout },
  )
}

// A display that is reporting the region-size gate, found by walking the session
// across nested views (a synteny or breakpoint view's panels).
interface GatedDisplay {
  trackId: string
  reason: string
}

// Wait for a display's paint-complete element, and fail the moment the gate
// makes that impossible instead of sitting out the timeout.
//
// A display whose region is too large mounts TooLargeMessage INSTEAD of its
// canvas body, so the paint-complete test-id never appears — and the plain wait
// reports `Waiting for selector … failed`, which is the same sentence a broken
// adapter, an unreachable host and a renamed test-id all produce. That cost a
// real diagnosis: the Nanopore EGFR demo test asked for a 1 Mb window on an
// alignments track, was gated at 11.4 Mb against CramAdapter's 3 MB default, and
// had never passed once — no golden was ever written, and nothing in the failure
// said why.
//
// The race is on the MODEL, not on a banner appearing or on a grace period.
// `regionTooLarge` is terminal by construction (the fetch autoruns hold off
// while it is true, so the display has stopped, not slowed), which makes "this
// will never paint" a fact to read rather than an interval to guess at.
//
// `assertNothingGated` in website/scripts/cancel-bench.ts is the post-hoc
// version, for a driver whose waits are all best-effort. The session walk is
// duplicated there rather than shared because both run inside the page:
// `waitForFunction`/`evaluate` serialize the callback, so it cannot close over
// an import.
export async function waitForDisplayPaint(
  page: Page,
  selector: string,
  timeout = 60000,
) {
  const gated = await page
    .waitForFunction(
      (sel: string) => {
        if (document.querySelector(sel)) {
          return { done: true, gated: [] }
        }
        interface LiveView {
          views?: LiveView[]
          tracks?: {
            configuration?: { trackId?: string }
            displays?: {
              regionTooLarge?: boolean
              regionTooLargeReason?: string
            }[]
          }[]
        }
        const out: { trackId: string; reason: string }[] = []
        const walk = (views: LiveView[] | undefined) => {
          for (const v of views ?? []) {
            for (const t of v.tracks ?? []) {
              for (const d of t.displays ?? []) {
                if (d.regionTooLarge) {
                  out.push({
                    trackId: t.configuration?.trackId ?? '?',
                    reason: d.regionTooLargeReason ?? '',
                  })
                }
              }
            }
            walk(v.views)
          }
        }
        walk(
          (window as unknown as { JBrowseSession?: { views?: LiveView[] } })
            .JBrowseSession?.views,
        )
        return out.length > 0 ? { done: false, gated: out } : null
      },
      { timeout, polling: 200 },
      selector,
    )
    .then(handle => handle.jsonValue() as Promise<{ gated: GatedDisplay[] }>)
    .catch(() => {
      throw new Error(`timed out waiting for ${selector}`)
    })

  if (gated.gated.length > 0) {
    const detail = gated.gated
      .map(g => `${g.trackId}${g.reason ? ` (${g.reason})` : ''}`)
      .join(', ')
    throw new Error(
      `region too large — the display never mounted its canvas, so ${selector} ` +
        `will never appear: ${detail}. Zoom the spec's loc in, or open the track ` +
        `as { trackId, forceLoad: true } to render it regardless.`,
    )
  }
}

// Wait until at least `count` elements match `selector` — used by tests that
// add a second view/display and must wait for it to mount before snapshotting.
export async function waitForElementCount(
  page: Page,
  selector: string,
  count: number,
  timeout = 60000,
) {
  await page.waitForFunction(
    (sel: string, n: number) => document.querySelectorAll(sel).length >= n,
    { timeout },
    selector,
    count,
  )
}

// waitForSelector + boundingBox with the null-checks every caller repeats.
async function elementBox(page: Page, selector: string, timeout = 60000) {
  const el = await page.waitForSelector(selector, { timeout })
  if (!el) {
    throw new Error(`element not found: ${selector}`)
  }
  const box = await el.boundingBox()
  if (!box) {
    throw new Error(`bounding box not found: ${selector}`)
  }
  return box
}

// Right-click an element at a fractional position within its box (0..1 on each
// axis), e.g. (0.5, 0.3) is horizontal-center, 30% down. Used to land a
// right-click on rendered canvas content for context-menu tests.
export async function rightClickAtFraction(
  page: Page,
  selector: string,
  fractionX: number,
  fractionY: number,
) {
  const box = await elementBox(page, selector)
  await page.mouse.click(
    box.x + box.width * fractionX,
    box.y + box.height * fractionY,
    { button: 'right' },
  )
}

export async function getContextMenuItems(page: Page) {
  return page.evaluate(() =>
    [...document.querySelectorAll('[role="menuitem"]')].map(m => m.textContent),
  )
}

export async function assertContextMenuContains(page: Page, label: string) {
  const items = await getContextMenuItems(page)
  if (!items.includes(label)) {
    throw new Error(`"${label}" not in context menu. Got: ${items.join(', ')}`)
  }
}

// Asserts a rendered element actually drew something interesting — not a
// blank or single-color fill. The snapshot system treats blank captures as
// passes (auto-creates goldens, skips blank WebGL frames), so this is the
// explicit "the display shows real data" gate. Counts distinct quantized
// colors and the fraction of pixels that aren't the dominant background.
export async function assertCanvasHasContent(
  page: Page,
  selector: string,
  {
    minDistinctColors = 8,
    minNonBgFraction = 0.005,
    timeout = 60000,
  }: {
    minDistinctColors?: number
    minNonBgFraction?: number
    timeout?: number
  } = {},
) {
  await page.waitForSelector(selector, { timeout })
  const buf = await captureElementPng(
    page,
    selector,
    `assertCanvasHasContent(${selector})`,
  )
  let stats = analyzeCanvasPng(buf)
  // Same render-vs-capture question canvasSnapshot asks, on the other path that
  // can report a blank — a blank arriving through here was invisible to that
  // instrumentation and is how the first run with it produced no verdict.
  const wouldFail =
    stats.distinctColors < minDistinctColors ||
    stats.nonBgFraction < minNonBgFraction
  const selfReport = wouldFail
    ? await canvasSelfReport(page, selector)
    : { note: '' }
  // The question this helper asks is "did the display draw", and the backing
  // store answers it directly when the compositor hands back an empty capture.
  // Safe here, and ONLY here, because no bytes are compared against anything —
  // feeding a backing-store read into a snapshot comparison mixes capture paths
  // and produces false drift (see the block above canvasSelfReport). A canvas
  // that self-reports blank has no dataUrl and still fails.
  if (selfReport.dataUrl) {
    stats = analyzeCanvasPng(
      Buffer.from(
        selfReport.dataUrl.slice(selfReport.dataUrl.indexOf(',') + 1),
        'base64',
      ),
    )
  }
  assertNonBlank(
    stats,
    `assertCanvasHasContent: ${selector}${selfReport.note}`,
    { minDistinctColors, minNonBgFraction },
  )
  return stats
}

export async function clearStorageAndNavigate(
  page: Page,
  config: string,
  sessionName = 'Test Session',
) {
  await page.goto(`http://localhost:${PORT}/`)
  await page.evaluate(() => {
    localStorage.clear()
    sessionStorage.clear()
  })
  await navigateToApp(page, config, sessionName)
}

// Auth helpers
export async function handleOAuthLogin(browser: Browser) {
  const target = await browser.waitForTarget(
    t => t.url().includes('localhost:3030/oauth'),
    { timeout: 15000 },
  )
  const popup = await target.page()
  if (!popup) {
    throw new Error('Could not get OAuth popup page')
  }
  const submitBtn = await popup.waitForSelector('input[type="submit"]', {
    timeout: 10000,
  })
  if (!submitBtn) {
    throw new Error('OAuth submit button not found')
  }
  await delay(500)
  await submitBtn.click()
  await delay(2000)
}

export async function handleBasicAuthLogin(
  page: Page,
  username = 'admin',
  password = 'password',
) {
  // throws by itself if the dialog never appears
  await findByTestId(page, 'login-httpbasic', 10000)

  const usernameInput = await findByTestId(
    page,
    'login-httpbasic-username',
    10000,
  )
  const passwordInput = await findByTestId(
    page,
    'login-httpbasic-password',
    10000,
  )
  await usernameInput.type(username)
  await passwordInput.type(password)

  const submitBtn = await findByText(page, 'Submit', 10000)
  await submitBtn.click()
  await delay(500)
}

// Workspace helpers
export async function waitForWorkspacesReady(page: Page) {
  // Our own hook, not a library's class names — the workspace is ours now, and
  // a test that waits on a dependency's stylesheet class breaks when the
  // dependency does, which is how these six failed the day dockview left.
  await page.waitForSelector('[data-testid="workspace"]', {
    timeout: 10000,
  })
  await page.waitForSelector('[data-testid^="view-container-"]', {
    timeout: 10000,
  })
  await page.waitForSelector('input[placeholder="Search for location"]', {
    timeout: 10000,
  })
  await waitForLoadingToComplete(page)
  await delay(1000)
}

export async function copyView(page: Page) {
  const viewMenu = await findByTestId(page, 'view_menu_icon', 10000)
  await viewMenu.click()
  await delay(300)
  const viewOptions = await findByText(page, 'View options', 10000)
  await viewOptions.click()
  await delay(300)
  const copyViewBtn = await findByText(page, 'Copy view', 10000)
  await copyViewBtn.click()
  await delay(1000)
}

export async function clickViewMenuOption(
  page: Page,
  optionText: string,
  viewIndex = 0,
) {
  const viewMenus = await page.$$('[data-testid="view_menu_icon"]')
  await viewMenus[viewIndex]?.click()
  await delay(300)
  const viewOptions = await findByText(page, 'View options', 10000)
  await viewOptions.click()
  await delay(300)
  const option = await findByText(page, optionText, 10000)
  await option.click()
}

export async function setupWorkspacesViaMoveToTab(page: Page) {
  await copyView(page)
  await clickViewMenuOption(page, 'Move to new tab', 0)
  await waitForWorkspacesReady(page)
}

// Regression guard for GPU/DOM scroll tearing. The canvas GPU displays scroll
// VIRTUALLY: a fixed (position:absolute) canvas painting from model.scrollTop, a
// VerticalScrollbar overlay, and DOM overlays translated by the same
// model.scrollTop — so the glyphs and their overlays share one scroll source and
// can't tear apart. The failure mode this guards against is regressing to a
// native overflow container (a second, compositor-driven scroll space): assert
// the canvas is absolutely positioned, no ancestor up to the outer container is
// a native scroll port, and the outer TrackRenderingContainer isn't itself a
// scroll port (a spurious second scrollbar). Callers wait for the
// vertical-scrollbar test-id first to confirm the display actually overflows.
export async function assertVirtualScrollStructure(
  page: Page,
  canvasSelector: string,
) {
  const checks = await page.evaluate((canvasSel: string) => {
    const css = (el: Element, p: string) =>
      getComputedStyle(el).getPropertyValue(p)
    const outer = document.querySelector(
      '[data-testid^="trackRenderingContainer"]',
    )
    const canvas = document.querySelector(canvasSel)
    let nativeScroller = false
    let el = canvas?.parentElement ?? null
    while (el && el !== outer) {
      if (/auto|scroll/.test(css(el, 'overflow-y'))) {
        nativeScroller = true
        break
      }
      el = el.parentElement
    }
    return {
      hasCanvas: !!canvas,
      hasOuter: !!outer,
      outerOverflowY: outer ? css(outer, 'overflow-y') : null,
      outerContain: outer ? css(outer, 'contain') : null,
      canvasPosition: canvas ? css(canvas, 'position') : null,
      nativeScroller,
    }
  }, canvasSelector)

  if (!checks.hasCanvas || !checks.hasOuter) {
    throw new Error(
      `missing canvas (${canvasSelector}) or trackRenderingContainer`,
    )
  }
  // The outer container must clip rather than be a scroll port — that's what
  // prevents a spurious second scrollbar. Two mechanisms clip, and which one is
  // in use is a perf detail this assertion shouldn't pin: `overflow:hidden/clip`
  // or paint containment (`contain:strict`, what TrackRenderingContainer uses
  // since b203a529b3 — hidden makes the box a scroll container the browser
  // keeps recomputing). What is NOT allowed either way is `auto`/`scroll`.
  // (Not asserting scrollHeight===clientHeight: absolutely-positioned chrome
  // like the expand-indicator can extend a few px past a very short track and
  // get harmlessly clipped here; no scrollbar renders regardless.)
  const clipsByOverflow = /hidden|clip/.test(checks.outerOverflowY ?? '')
  const clipsByContainment = /strict|content|paint/.test(
    checks.outerContain ?? '',
  )
  if (!clipsByOverflow && !clipsByContainment) {
    throw new Error(
      `outer TrackRenderingContainer must clip, but has overflow-y '${checks.outerOverflowY}' and contain '${checks.outerContain}'`,
    )
  }
  if (/auto|scroll/.test(checks.outerOverflowY ?? '')) {
    throw new Error(
      `outer TrackRenderingContainer is a scroll port (overflow-y '${checks.outerOverflowY}') — that is the spurious second scrollbar`,
    )
  }
  if (checks.canvasPosition !== 'absolute') {
    throw new Error(
      `canvas position expected 'absolute' (virtual scroll), got '${checks.canvasPosition}'`,
    )
  }
  if (checks.nativeScroller) {
    throw new Error(
      'found a native overflow scroll container — display regressed to native scroll (tearing risk)',
    )
  }
  await assertScrollbarOnRightEdge(page)
}

// The other half of "the display owns its scroll": the affordance is only an
// affordance if it is on screen. `VerticalScrollbar` anchors by `right: 0`, so
// it lands wherever its nearest positioned ancestor happens to be — and a
// display that mounts it inside a container holding nothing but absolutely
// positioned children mounts it inside a 0x0 box, putting the thumb one track
// width LEFT of the display and the edge fade at zero width. Both variant
// displays shipped exactly that, invisible to a test asserting the element
// exists, and invisible on screen because `contain: strict` clips it away.
//
// Measured rather than structural: which ancestor is positioned is a layout
// detail each display may change, where "the thumb is inside the track box, at
// its right edge" is the property that has to hold for all of them.
async function assertScrollbarOnRightEdge(page: Page) {
  const box = await page.evaluate(() => {
    const outer = document
      .querySelector('[data-testid^="trackRenderingContainer"]')
      ?.getBoundingClientRect()
    const bar = document
      .querySelector('[data-testid="vertical-scrollbar"]')
      ?.getBoundingClientRect()
    return outer && bar
      ? {
          gap: outer.right - bar.right,
          left: bar.left - outer.left,
          w: bar.width,
        }
      : undefined
  })
  if (!box) {
    return
  }
  // A few px of slack: a display may inset the track past a sidebar or a
  // border. Being outside the box at all, or hard against its left edge, is the
  // failure — the broken variant displays measured a gap of the full track width.
  if (box.gap < -1 || box.gap > 4 || box.left < 0 || box.w < 1) {
    throw new Error(
      `vertical scrollbar is not on the display's right edge: ${box.w}px wide, ${box.gap}px from the right edge and ${box.left}px from the left. A 0x0 positioned ancestor is the usual cause — see assertScrollbarOnRightEdge.`,
    )
  }
}
