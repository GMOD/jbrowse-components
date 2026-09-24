import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

import puppeteer from 'puppeteer'

import {
  BASE_CHROME_ARGS,
  findChromeExecutable,
  isBrowserConsoleNoise,
} from './browser.ts'
import { resolveAgainstConfig } from './catalog.ts'
import { assertImagePath } from './imagePath.ts'
import { assertSupportedInstance } from './instanceVersion.ts'
import { DEFAULT_TIMEOUT } from './poll.ts'
import { waitForFrame, waitForJBrowseReady } from './ready.ts'
import {
  assemblyFromSession,
  savedSnapshot,
  trackIdsFromSession,
} from './session.ts'
import { sessionOverflowInPage } from './sessionOverflow.ts'
import { PUBLIC_INSTANCE, assertSessionStandsAlone, jbrowseUrl } from './url.ts'

import type { ReadyOptions, ReadyReport } from './ready.ts'
import type { JBrowseUrlOptions } from './url.ts'
import type { Browser, Page } from 'puppeteer'

export interface OpenOptions extends JBrowseUrlOptions, ReadyOptions {
  width?: number
  height?: number
  /** Device pixel ratio. Default 2, the density a figure usually wants. */
  deviceScaleFactor?: number
  headless?: boolean
  /** Chrome binary. Defaults to $CHROME_PATH, a system Chrome, then Puppeteer's own. */
  executablePath?: string
  /** Extra Chrome flags, appended to the defaults. */
  args?: string[]
  /** Called with each page console message that is not known GPU noise, and each uncaught page error. */
  onConsole?: (text: string) => void
}

export interface OpenResult extends ReadyReport {
  browser: Browser
  page: Page
  url: string
}

/**
 * Launch a browser, open a JBrowse session, and wait until it has rendered.
 * The caller owns the returned browser and must close it. The assembly and
 * tracks asked for become the session gate's expectations unless `trackIds`
 * names others.
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
    ...given
  } = options
  assertSessionStandsAlone(given)
  const [urlOptions] = await Promise.all([
    resolveAgainstConfig(given),
    assertSupportedInstance(given.instance ?? PUBLIC_INSTANCE),
  ])
  // named, so the header carries no timestamp that differs on every capture
  const url = jbrowseUrl({
    ...urlOptions,
    sessionName: urlOptions.sessionName ?? 'Screenshot',
  })
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
      page.on('pageerror', error => {
        onConsole(`uncaught ${error instanceof Error ? error.stack : error}`)
      })
    }
    // an app streaming track data may never reach networkidle; the session
    // gate is the signal that it is up
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout })
    const { spec, session, assembly, hub, tracks } = urlOptions
    const opens = spec ?? (session && savedSnapshot(session))
    const report = await waitForJBrowseReady(page, {
      ...options,
      assembly: opens ? assemblyFromSession(opens) : (assembly ?? hub),
      trackIds: trackIds ?? (opens ? trackIdsFromSession(opens) : tracks),
    })
    return { browser, page, url, ...report }
  } catch (error) {
    await browser.close().catch(() => {})
    throw error
  }
}

export interface CaptureOptions extends OpenOptions {
  /**
   * Image path to write, `.png`, `.jpg`/`.jpeg` or `.webp`. Omit to get the PNG
   * buffer back and write it yourself.
   */
  out?: string
  /**
   * Capture every view rather than the viewport: the viewport grows by however
   * far the session runs past it, and the frame is waited for again.
   */
  fullPage?: boolean
}

export interface CaptureResult extends ReadyReport {
  url: string
  image: Uint8Array
}

/**
 * Open a JBrowse session, wait for it to render, screenshot it, and close the
 * browser.
 */
export async function captureJBrowse(
  options: CaptureOptions = {},
): Promise<CaptureResult> {
  const { out, fullPage = false, ...openOptions } = options
  if (out) {
    assertImagePath(out)
    mkdirSync(dirname(out), { recursive: true })
  }
  const { browser, page, url, ...opened } = await openJBrowse(openOptions)
  try {
    let report: ReadyReport = opened
    const overflow = fullPage ? await page.evaluate(sessionOverflowInPage) : 0
    const viewport = page.viewport()
    if (viewport && overflow > 0) {
      await page.setViewport({
        ...viewport,
        height: viewport.height + overflow,
      })
      report = await waitForFrame(page, openOptions)
    }
    const image = await page.screenshot({ path: out })
    return { url, image, ...report }
  } finally {
    await browser.close()
  }
}
