import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

import puppeteer from 'puppeteer'

import {
  BASE_CHROME_ARGS,
  findChromeExecutable,
  isBrowserConsoleNoise,
} from './browser.ts'
import { waitForJBrowseReady } from './ready.ts'
import { assemblyFromSession, trackIdsFromSession } from './session.ts'
import { jbrowseUrl } from './url.ts'
import { waitForAppSettled } from './waits.ts'

import type { ReadyOptions, ReadyReport } from './ready.ts'
import type { JBrowseUrlOptions } from './url.ts'
import type { Browser, Page } from 'puppeteer'

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
    // Defaulted here as well as in waitForJBrowseReady, so the navigation gets
    // the same budget as the wait stages — puppeteer's own goto default is 30s,
    // half of what a caller passing nothing was told each stage would get.
    timeout = 60000,
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
      // nothing and a timing-out stage always threw. Overridden below: the
      // defaulted timeout, and the two options derived from the URL.
      ...options,
      timeout,
      // A session spec's own assembly wins over the hub name. `--hub hg38
      // --session spec.json` where the spec opens something else is legitimate
      // (the hub is just supplying the config), and expecting the hub name there
      // would fail a capture that is entirely correct.
      assembly: urlOptions.session
        ? (urlOptions.assembly ?? assemblyFromSession(urlOptions.session))
        : (urlOptions.assembly ?? urlOptions.hub),
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
    // process; without this the caller has no handle to close it. The close is
    // guarded so its own failure cannot replace the error worth reporting.
    await browser.close().catch(() => {})
    throw error
  }
}

export interface CaptureOptions extends OpenOptions {
  /** PNG path to write. Omit to get the buffer back and write it yourself. */
  out?: string
  /**
   * Capture the whole scrollable page rather than the viewport. Implemented by
   * growing the viewport to the page height and re-settling, never by
   * `page.screenshot({ fullPage: true })` — puppeteer implements that flag with
   * the same viewport resize but shoots immediately, and the capture can return
   * before the content re-rasters (measured in the browser-test suites as a
   * 10–25% image diff that moves run to run).
   */
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
  if (out) {
    // Before the browser launches: a missing parent directory otherwise fails
    // at the screenshot, after the whole launch-navigate-wait cycle.
    mkdirSync(dirname(out), { recursive: true })
  }
  const { browser, page, url, ...report } = await openJBrowse(openOptions)
  try {
    if (fullPage) {
      const viewport = page.viewport()
      const pageHeight = await page.evaluate(() =>
        Math.ceil(
          Math.max(
            document.documentElement.scrollHeight,
            document.body.scrollHeight,
          ),
        ),
      )
      if (viewport && pageHeight > viewport.height) {
        await page.setViewport({ ...viewport, height: pageHeight })
        // The resize invalidates the raster and can start work (a display that
        // grew gained rows to draw), so the frame has to settle again.
        await waitForAppSettled(page, { timeout: openOptions.timeout })
      }
    }
    const image = await page.screenshot({ path: out })
    return { url, image, ...report }
  } finally {
    await browser.close()
  }
}
