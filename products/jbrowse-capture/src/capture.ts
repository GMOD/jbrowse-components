import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

import puppeteer from 'puppeteer'

import {
  BASE_CHROME_ARGS,
  findChromeExecutable,
  isBrowserConsoleNoise,
} from './browser.ts'
import { assertSupportedInstance } from './instanceVersion.ts'
import { waitForJBrowseReady } from './ready.ts'
import { assemblyFromSession, trackIdsFromSession } from './session.ts'
import { PUBLIC_INSTANCE, jbrowseUrl } from './url.ts'
import { waitForAppSettled } from './waits.ts'

import type { ReadyOptions, ReadyReport } from './ready.ts'
import type { JBrowseUrlOptions } from './url.ts'
import type { Browser, Page } from 'puppeteer'

// Puppeteer's own `goto` default is 30s, half of what a caller passing nothing
// is told each wait stage gets. Defaulted here so the navigation, the chain and
// the fullPage re-settle all run on one budget.
const DEFAULT_TIMEOUT = 60000

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
    timeout = DEFAULT_TIMEOUT,
    trackIds,
    ...urlOptions
  } = options
  const url = jbrowseUrl(urlOptions)
  await assertSupportedInstance(urlOptions.instance ?? PUBLIC_INSTANCE)
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
    const { session, assembly, hub, tracks } = urlOptions
    // Spread rather than listed, so every ready option arrives by construction:
    // a hand-copied list is what once dropped `allowUnsettled`.
    const report = await waitForJBrowseReady(page, {
      ...options,
      timeout,
      // a spec may open another assembly than the hub that supplies its config
      assembly: session ? assemblyFromSession(session) : (assembly ?? hub),
      trackIds: trackIds ?? (session ? trackIdsFromSession(session) : tracks),
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
        // grew gained rows to draw), so the frame has to settle again — on the
        // same budget the chain used, and with its outcome reported. Dropping
        // the outcome made this the one stage that could give up and still
        // report `unsettled: []`, over the frame most likely to be half-drawn.
        const settled = await waitForAppSettled(page, {
          timeout: openOptions.timeout ?? DEFAULT_TIMEOUT,
        })
        if (!settled) {
          report.unsettled.push('the app never re-settled after the resize')
          if (!openOptions.allowUnsettled) {
            throw new Error(
              `gave up waiting after ${openOptions.timeout ?? DEFAULT_TIMEOUT}ms: ` +
                'the app never re-settled after the fullPage resize. Raise the ' +
                'timeout, or pass allowUnsettled (--allowUnsettled) to capture ' +
                'the frame as it stands.',
            )
          }
        }
      }
    }
    const image = await page.screenshot({ path: out })
    return { url, image, ...report }
  } finally {
    await browser.close()
  }
}
