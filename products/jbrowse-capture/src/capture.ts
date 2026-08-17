import puppeteer from 'puppeteer'

import {
  BASE_CHROME_ARGS,
  findChromeExecutable,
  isBrowserConsoleNoise,
} from './browser.ts'
import { assemblyFromSession, trackIdsFromSession } from './session.ts'
import {
  hasPaintContract,
  readInstrumentation,
  readSessionSummary,
  waitForSession,
} from './sessionGate.ts'
import { jbrowseUrl } from './url.ts'
import {
  delay,
  hasAppReadyMarker,
  waitForAppReady,
  waitForDisplayPhases,
  waitForDisplaysDone,
  waitForLoadingComplete,
  waitForQuiescent,
  waitForQuietPeriod,
  waitForViewPhases,
} from './waits.ts'

import type { Instrumentation, SessionExpectations } from './sessionGate.ts'
import type { JBrowseUrlOptions } from './url.ts'
import type { Browser, Page } from 'puppeteer'

// A build with no per-display paint attributes gives no signal between "the
// overlay cleared" and "the canvas has pixels on it", so the only thing left is
// to wait. Sized from the measured gap on jbrowse.org/code/jb2/latest between
// the overlay clearing and the tracks being fully drawn.
const LEGACY_PAINT_SETTLE_MS = 1500
// ...and the gap at the OTHER end, which is the one that lands a capture on an
// app that has drawn nothing at all. Measured on the same instance with two
// remote tracks: the session gate is satisfied at ~2.5s, and the loading overlay
// — the only remaining signal there — does not go up until ~3.5s. An
// instrumented build has no such window: `data-display-phase` appears in the
// same frame as the display it belongs to.
//
// So on an uninstrumented build the app has to be seen to START working, and
// then hold still, before it counts as finished. The window is how long the
// first indicator gets to appear before "nothing to wait for" is the better
// reading; the quiet is how long the idle then has to hold.
const LEGACY_BUSY_WINDOW_MS = 4000
const LEGACY_QUIET_MS = 2000

export interface ReadyOptions extends SessionExpectations {
  /** Budget for each individual wait stage. */
  timeout?: number
  /**
   * Also wait out adapter "Downloading…" status text, which can outlive the
   * loading overlay when a track streams a large remote file.
   */
  waitForDownloads?: boolean
  /** Extra settle after everything reports done, for animations and tooltips. */
  settleMs?: number
  /**
   * Skip the session gate. Only for a page that is not jbrowse-web and so
   * publishes no `window.JBrowseSession` — an embedded component, say. You lose
   * the only check that the data you asked for is the data on screen.
   */
  expectSession?: boolean
  /**
   * Return the report instead of throwing when a wait stage times out. For
   * capturing a page that is deliberately mid-load, or accepting a known-slow
   * one. The unsettled stages are still listed in the report either way.
   */
  allowUnsettled?: boolean
}

export interface ReadyReport {
  /** Displays still reporting unpainted at the end of the wait. */
  pending: string[]
  /**
   * Whether every display's paint state was actually measurable — false when
   * tracks are open but the build publishes no `data-display-drawn`. With this
   * false, an empty `pending` means "cannot tell", not "all done".
   */
  paintContract: boolean
  /** Wait stages that hit their timeout instead of being satisfied. */
  unsettled: string[]
  /**
   * Which readiness attributes the build published, read once the session was
   * up. Every `false` here is a wait that could not fail rather than one that
   * passed, and the chain compensates for it — see LEGACY_QUIET_MS.
   */
  instrumentation: Instrumentation
  /**
   * Whether the page published `[data-app-phase]`, the one positive readiness
   * selector. True means the wait was that selector and nothing else; false
   * means the build predates it and the fallback chain ran.
   */
  appMarker: boolean
}

/**
 * Wait until a JBrowse page has finished loading AND finished drawing.
 *
 * One positive gate, then the negative ones. The order is the whole point: the
 * DOM waits all pass on a page that has not started yet, so without the session
 * gate in front the chain returns in under a second (see sessionGate.ts). After
 * it, each stage is only meaningful once the previous has passed — a view still
 * resolving its assembly has mounted no displays, and a display that has mounted
 * but not fetched has nothing to be drawn yet.
 */
export async function waitForJBrowseReady(
  page: Page,
  {
    timeout = 60000,
    waitForDownloads = true,
    settleMs = 0,
    expectSession = true,
    assembly,
    trackIds,
    allowUnsettled = false,
  }: ReadyOptions = {},
): Promise<ReadyReport> {
  const unsettled: string[] = []
  const stage = async (name: string, work: Promise<boolean>) => {
    if (!(await work)) {
      unsettled.push(name)
    }
  }
  // The two hard waits reject with puppeteer's own `Waiting failed: Nms
  // exceeded`, which names neither the stage nor the selector — the whole
  // failure mode this module exists to avoid, arriving as an error message
  // instead of as a blank image. Say which gate it was and what to do.
  const required = async <T>(name: string, work: Promise<T>): Promise<T> => {
    try {
      return await work
    } catch {
      throw new Error(
        `gave up waiting after ${timeout}ms: ${name}. Raise the timeout if the ` +
          'page is merely slow; if it never finishes, open the same URL in a ' +
          'browser — this gate has no content to fall through to.',
      )
    }
  }

  // 0. the session exists and holds what was asked for. Positive, and throws.
  if (expectSession) {
    await waitForSession(page, { assembly, trackIds, timeout })
  }
  // 1. THE WHOLE ANSWER, on any build that has it: the session renders
  //    `[data-app-phase="ready"]` when no view is resolving an assembly and no
  //    display is fetching. It is positive, so unlike everything below it
  //    cannot be satisfied by an app that has not started, and there is nothing
  //    to assemble — wait for the selector and stop.
  //
  //    Everything after this point is the fallback for a deployment older than
  //    the marker, and can be deleted the day the oldest supported build has
  //    it.
  if (await hasAppReadyMarker(page)) {
    const ready = await waitForAppReady(page, { timeout })
    if (!ready) {
      unsettled.push('the app never reported itself ready')
    }
    if (settleMs > 0) {
      await delay(settleMs)
    }
    const report = {
      pending: await pendingDisplays(page),
      paintContract: await hasPaintContract(page),
      unsettled,
      instrumentation: await readInstrumentation(page),
      appMarker: true,
    }
    if (!allowUnsettled && unsettled.length > 0) {
      throw new Error(
        `gave up waiting after ${timeout}ms: ${unsettled.join('; ')}. ` +
          'Raise the timeout, or pass allowUnsettled (--allowUnsettled) to ' +
          'capture the frame as it stands.',
      )
    }
    return report
  }

  // 1b. what an older build can be asked instead. On one that publishes none of
  //     these, the stages below are not gates at all: they are assertions about
  //     absent attributes that no page can fail.
  const instrumentation = await readInstrumentation(page)
  const instrumented =
    instrumentation.displayPhase || instrumentation.displayDrawn
  // A page with no tracks open has nothing to load, so the quiet gate below
  // would be a fixed sleep for an import form or a menu shot.
  const summary = await readSessionSummary(page)
  const needsQuietGate = !instrumented && (summary?.trackIds.length ?? 0) > 0

  // 2. the view has an assembly and its React component has arrived. Also not
  //    best-effort: a view stuck here has no content to fall through to.
  await required(
    'a view never left its loading phase (still resolving its assembly, or its ' +
      'lazily-imported component never arrived)',
    waitForViewPhases(page, timeout),
  )
  // 2. no track is still fetching. One call, two outcomes: the overlay half is
  //    required (an overlay that never clears is a fetch that never finished,
  //    with nothing behind it) and throws; the "Downloading…" half is
  //    best-effort and comes back as the boolean.
  const downloadsSettled = await required(
    'the loading overlay never cleared (a track fetch never finished)',
    waitForLoadingComplete(page, { timeout, waitForDownloads }),
  )
  if (!downloadsSettled) {
    unsettled.push('a track was still downloading')
  }
  await stage(
    'a display was still in its loading phase',
    waitForDisplayPhases(page, timeout),
  )
  // 3. no display is still pending its first paint
  await stage(
    'a display never reported its first paint',
    waitForDisplaysDone(page, timeout),
  )
  // 4. no visible "Loading…/Rendering…/Computing…" text remains, which is how
  //    the views that publish no phase attribute report themselves
  await stage(
    'a "Loading…/Rendering…" label was still on screen',
    waitForQuiescent(page, { timeout }),
  )
  // 5. and on a build that answered none of the above, the one gate that does
  //    not depend on an attribute existing: the app has to hold still. Every
  //    stage before this one passed the moment it was asked, so without it the
  //    chain returns while the first fetch is still being set up.
  if (needsQuietGate) {
    await stage(
      'the app never went quiet for ' +
        `${LEGACY_QUIET_MS}ms (this build publishes no readiness attributes, ` +
        'so being seen to work and then stop is the only finished signal there ' +
        'is)',
      waitForQuietPeriod(page, {
        quietMs: LEGACY_QUIET_MS,
        busyWindowMs: LEGACY_BUSY_WINDOW_MS,
        timeout,
      }),
    )
  }

  const paintContract = await hasPaintContract(page)
  if (!paintContract) {
    await delay(LEGACY_PAINT_SETTLE_MS)
  }
  if (settleMs > 0) {
    await delay(settleMs)
  }
  const report = {
    pending: await pendingDisplays(page),
    paintContract,
    unsettled,
    instrumentation,
    appMarker: false,
  }
  if (!allowUnsettled && unsettled.length > 0) {
    // Throwing is the point. Each of these stages swallows its own timeout so a
    // slow page is not failed for being slow, which historically meant the run
    // ended with an image and an exit code of 0 whether it had settled or not.
    // A caller that genuinely wants the frame anyway asks for it by name.
    throw new Error(
      `gave up waiting after ${timeout}ms: ${unsettled.join('; ')}. ` +
        'Raise the timeout, or pass allowUnsettled (--allowUnsettled) to ' +
        'capture the frame as it stands.',
    )
  }
  return report
}

/**
 * Displays that were still reporting unpainted at the moment of the call.
 *
 * Distinct from `unsettled`, which says a wait ran out of time. This says what
 * the page looked like when the shutter fired, and the two do not imply each
 * other: a display can go back to pending after its stage passed. An empty
 * result means nothing at all on a build with no paint contract — check
 * `paintContract` before reading it as good news.
 */
export function pendingDisplays(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    [
      ...document.querySelectorAll<HTMLElement>('[data-display-drawn="false"]'),
    ].map(el => el.dataset.testid ?? (el.id || 'unnamed display')),
  )
}

export interface OpenOptions extends JBrowseUrlOptions, ReadyOptions {
  width?: number
  height?: number
  /** 2 renders a retina-density image, which is what a figure usually wants. */
  deviceScaleFactor?: number
  headless?: boolean
  /** Chrome binary. Defaults to $CHROME_PATH, a system Chrome, then Puppeteer's own. */
  executablePath?: string
  /** Extra Chrome flags, appended to the defaults. */
  args?: string[]
  /** Called with each page console message that is not known GPU noise. */
  onConsole?: (text: string) => void
}

export interface OpenResult extends ReadyReport {
  browser: Browser
  page: Page
  url: string
}

/**
 * Launch a browser, navigate to a JBrowse session, and wait until it has
 * rendered. The caller owns the returned browser and must close it.
 *
 * Use this when the screenshot is not the end of the job: clicking a feature,
 * reading state back out of `window.JBrowseSession`, capturing a dialog. For a
 * plain image, `captureJBrowse` wraps the whole thing.
 *
 * The assembly and track count asked for in the URL become the session gate's
 * expectations unless you override them, so a mistyped trackId fails here rather
 * than producing an image of an empty browser.
 */
export async function openJBrowse(
  options: OpenOptions = {},
): Promise<OpenResult> {
  const {
    width = 1400,
    height = 900,
    deviceScaleFactor = 2,
    headless = true,
    executablePath = findChromeExecutable(),
    args = [],
    onConsole,
    timeout,
    trackIds,
    // Pulled out only to keep them out of `urlOptions`, which becomes the
    // query string. They reach the ready wait through the `...options` spread
    // below rather than from here.
    waitForDownloads: _waitForDownloads,
    settleMs: _settleMs,
    expectSession: _expectSession,
    allowUnsettled: _allowUnsettled,
    // `assembly` is deliberately NOT pulled out here: it is both a URL option
    // (which assembly to open) and the session gate's expectation (which
    // assembly must end up open), and destructuring it for the second use would
    // have dropped it from the first, silently.
    ...urlOptions
  } = options
  const url = jbrowseUrl(urlOptions)
  const browser = await puppeteer.launch({
    headless,
    executablePath,
    args: [...BASE_CHROME_ARGS, ...args],
  })
  try {
    const page = await browser.newPage()
    await page.setViewport({ width, height, deviceScaleFactor })
    if (onConsole) {
      page.on('console', msg => {
        const text = msg.text()
        if (!isBrowserConsoleNoise(text)) {
          onConsole(text)
        }
      })
    }
    // domcontentloaded, not networkidle2: an app that streams track data may
    // never go idle, and the session gate below is a far better "it is up"
    // signal than the absence of requests.
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout })
    const report = await waitForJBrowseReady(page, {
      // Spread, not a hand-copied field list. `OpenOptions extends
      // ReadyOptions`, so every present and future ready option arrives here by
      // construction. Listing them by hand is what dropped `allowUnsettled`:
      // it was declared, documented, recommended by this function's own timeout
      // message, and silently never forwarded, so `--allowUnsettled` did
      // nothing and a timing-out stage always threw. Only the two options
      // derived from the URL are overridden below.
      ...options,
      // A session spec's own assembly wins over the hub name. `--hub hg38
      // --session spec.json` where the spec opens something else is legitimate
      // (the hub is just supplying the config), and expecting the hub name there
      // would fail a capture that is entirely correct.
      assembly:
        urlOptions.assembly ??
        (urlOptions.session
          ? assemblyFromSession(urlOptions.session)
          : undefined) ??
        (urlOptions.session ? undefined : urlOptions.hub),
      trackIds:
        trackIds ??
        urlOptions.tracks ??
        (urlOptions.session
          ? trackIdsFromSession(urlOptions.session)
          : undefined),
    })
    return { browser, page, url, ...report }
  } catch (error) {
    // A launch that got as far as a page and then failed still holds a Chrome
    // process; without this the caller has no handle to close it.
    await browser.close()
    throw error
  }
}

export interface CaptureOptions extends OpenOptions {
  /** PNG path to write. Omit to get the buffer back and write it yourself. */
  out?: string
  /** Capture the whole scrollable page rather than the viewport. */
  fullPage?: boolean
}

export interface CaptureResult extends ReadyReport {
  url: string
  image: Uint8Array
}

/**
 * Open a JBrowse session, wait for it to render, screenshot it, close the
 * browser. The one-call form.
 */
export async function captureJBrowse(
  options: CaptureOptions = {},
): Promise<CaptureResult> {
  const { out, fullPage = false, ...openOptions } = options
  const { browser, page, url, ...report } = await openJBrowse(openOptions)
  try {
    const image = await page.screenshot({ path: out, fullPage })
    return { url, image, ...report }
  } finally {
    await browser.close()
  }
}
