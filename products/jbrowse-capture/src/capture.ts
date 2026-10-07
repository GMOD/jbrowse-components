import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

import { assertValidAnnotations } from './annotationSpec.ts'
import { drawAnnotations } from './annotations.ts'
import { isBrowserConsoleNoise, launchBrowser } from './browser.ts'
import { canonicalSessionAssembly, resolveAgainstConfig } from './catalog.ts'
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
import { PUBLIC_INSTANCE, assertCoherentOptions, jbrowseUrl } from './url.ts'

import type { Annotation } from './annotationOverlay.ts'
import type { LaunchOptions } from './browser.ts'
import type { ReadyOptions, ReadyReport } from './ready.ts'
import type { JBrowseUrlOptions } from './url.ts'
import type { Browser, Page } from 'puppeteer'

export interface OpenOptions
  extends JBrowseUrlOptions, ReadyOptions, LaunchOptions {
  width?: number
  height?: number
  /** Device pixel ratio. Default 2, the density a figure usually wants. */
  dpr?: number
  /** Called with each page console message that is not known GPU noise, each uncaught page error, and each failed or HTTP 4xx/5xx request. */
  onConsole?: (text: string) => void
}

export interface OpenResult extends ReadyReport {
  browser: Browser
  page: Page
  url: string
}

async function prepareOpen(options: OpenOptions) {
  const {
    width = 1400,
    height = 900,
    dpr = 2,
    headless,
    executablePath,
    args,
    onConsole,
    timeout = DEFAULT_TIMEOUT,
    trackIds,
    ...given
  } = options
  assertCoherentOptions(given)
  const [urlOptions] = await Promise.all([
    resolveAgainstConfig(given),
    assertSupportedInstance(given.instance ?? PUBLIC_INSTANCE),
  ])
  // named, so the header carries no timestamp that differs on every capture
  const url = jbrowseUrl({
    ...urlOptions,
    sessionName: urlOptions.sessionName ?? 'Screenshot',
  })
  const { spec, session, assembly, hub, tracks } = urlOptions
  const opens = spec ?? (session && savedSnapshot(session))
  const sessionAssembly = opens && assemblyFromSession(opens)
  const expectedAssembly = opens
    ? sessionAssembly &&
      (await canonicalSessionAssembly(urlOptions, sessionAssembly))
    : (assembly ?? hub)
  return {
    url,
    viewport: { width, height, deviceScaleFactor: dpr },
    onConsole,
    timeout,
    ready: {
      ...options,
      assembly: expectedAssembly,
      trackIds: trackIds ?? (opens ? trackIdsFromSession(opens) : tracks),
    },
  }
}

async function openPage(
  browser: Browser,
  {
    url,
    viewport,
    onConsole,
    timeout,
    ready,
  }: Awaited<ReturnType<typeof prepareOpen>>,
) {
  // a window each: a tab behind another stops painting, and a batch has
  // several pages open
  const page = await browser.newPage({ type: 'window' })
  try {
    await page.setViewport(viewport)
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
      page.on('requestfailed', request => {
        const reason = request.failure()?.errorText
        if (reason !== 'net::ERR_ABORTED') {
          onConsole(`request failed: ${request.url()} (${reason})`)
        }
      })
      page.on('response', response => {
        if (response.status() >= 400) {
          onConsole(`HTTP ${response.status()}: ${response.url()}`)
        }
      })
    }
    // an app streaming track data may never reach networkidle; the session
    // gate is the signal that it is up
    const response = await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout,
    })
    // 304: a page after the first in a batch comes from the shared cache
    if (response && !response.ok() && response.status() !== 304) {
      throw new Error(
        `${url} answered HTTP ${response.status()}. Check --instance.`,
      )
    }
    const report = await waitForJBrowseReady(page, ready)
    return { page, url, ...report }
  } catch (error) {
    await page.close().catch(() => {})
    throw error
  }
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
  const prepared = await prepareOpen(options)
  const browser = await launchBrowser(options)
  try {
    return { browser, ...(await openPage(browser, prepared)) }
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
  /**
   * Callouts drawn over the settled view before the screenshot, in the shape
   * the JBrowse docs figures use: arrows, boxes, labels and badges, each
   * anchored to a locus, a graph node, a dotplot cell or an element.
   */
  annotations?: Annotation[]
}

export interface CaptureResult extends ReadyReport {
  url: string
  image: Uint8Array
}

function assertCapturable({ out, annotations }: CaptureOptions) {
  if (annotations) {
    assertValidAnnotations(annotations)
  }
  if (out) {
    assertImagePath(out)
    mkdirSync(dirname(out), { recursive: true })
  }
}

async function shoot(
  page: Page,
  opened: ReadyReport,
  { out, fullPage = false, annotations, ...openOptions }: CaptureOptions,
) {
  let report = opened
  const overflow = fullPage ? await page.evaluate(sessionOverflowInPage) : 0
  const viewport = page.viewport()
  if (viewport && overflow > 0) {
    await page.setViewport({
      ...viewport,
      height: viewport.height + overflow,
    })
    report = await waitForFrame(page, openOptions)
  }
  if (annotations?.length) {
    await drawAnnotations(page, annotations)
  }
  const image = await page.screenshot({ path: out })
  return { image, ...report }
}

/**
 * Open a JBrowse session, wait for it to render, screenshot it, and close the
 * browser.
 */
export async function captureJBrowse(
  options: CaptureOptions = {},
): Promise<CaptureResult> {
  assertCapturable(options)
  const { browser, page, url, ...opened } = await openJBrowse(options)
  try {
    return { url, ...(await shoot(page, opened, options)) }
  } finally {
    await browser.close().catch(() => {})
  }
}

export interface BatchOptions extends LaunchOptions {
  /** Pages open at once. Default 4. */
  concurrency?: number
  /** Called as each capture finishes, in completion order. */
  onResult?: (result: BatchResult, index: number) => void
}

export type BatchResult = { out?: string; ms: number } & (
  | ({ ok: true } & CaptureResult)
  | { ok: false; error: Error }
)

/**
 * Screenshot many sessions from one browser, each on a page of its own that is
 * closed after its screenshot. A failed capture is reported in its result and
 * the rest carry on; a browser that died is relaunched for the captures left.
 * Results come back in the order of `captures`.
 */
export async function captureBatch(
  captures: CaptureOptions[],
  { concurrency = 4, onResult, ...launch }: BatchOptions = {},
): Promise<BatchResult[]> {
  for (const capture of captures) {
    assertCapturable(capture)
  }
  const results: BatchResult[] = []
  let browser: Promise<Browser> | undefined
  // chained, so workers that find no live browser share one launch
  const liveBrowser = () => {
    const launched = () => launchBrowser(launch)
    browser = browser
      ? browser.then(b => (b.connected ? b : launched()), launched)
      : launched()
    return browser
  }
  let next = 0
  const worker = async () => {
    while (next < captures.length) {
      const index = next++
      const capture = captures[index]!
      const start = performance.now()
      let result: BatchResult
      let page: Page | undefined
      try {
        const prepared = await prepareOpen(capture)
        const opened = await openPage(await liveBrowser(), prepared)
        page = opened.page
        const { url } = opened
        result = {
          ok: true,
          out: capture.out,
          url,
          ...(await shoot(page, opened, capture)),
          ms: performance.now() - start,
        }
      } catch (error) {
        result = {
          ok: false,
          out: capture.out,
          error: error instanceof Error ? error : new Error(String(error)),
          ms: performance.now() - start,
        }
      } finally {
        await page?.close().catch(() => {})
      }
      results[index] = result
      onResult?.(result, index)
    }
  }
  try {
    await Promise.all(
      Array.from({ length: Math.min(concurrency, captures.length) }, worker),
    )
  } finally {
    const launched = await browser?.catch(() => undefined)
    await launched?.close().catch(() => {})
  }
  return results
}
