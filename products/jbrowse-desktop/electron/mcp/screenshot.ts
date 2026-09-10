import { nativeImage } from 'electron'

import { resultFields } from './stdioServer.ts'

import type { BridgeToolResult } from './stdioServer.ts'
import type { BrowserWindow, Rectangle } from 'electron'

export const SCREENSHOT_WAIT_MS = 30_000
export const SCREENSHOT_WAIT_MAX_MS = 120_000
const PAINT_WAIT_MS = 10_000
const MEASURE_WAIT_MS = 30_000
const SCALE_MIN = 0.1
const SCALE_MAX = 4

export type Relay = (
  tool: string,
  args: Record<string, unknown>,
  timeoutMs?: number,
) => Promise<BridgeToolResult>

// what the renderer's `measure` answers: the element's viewport box plus the
// page's scroll offset, so the box can be re-addressed in document space
export interface Measured extends Rectangle {
  scrollX: number
  scrollY: number
}

export function isRect(value: unknown): value is Rectangle {
  return (
    typeof value === 'object' &&
    value !== null &&
    ['x', 'y', 'width', 'height'].every(
      k => typeof (value as Record<string, unknown>)[k] === 'number',
    )
  )
}

export function isMeasured(value: unknown): value is Measured {
  return (
    isRect(value) &&
    typeof (value as Measured).scrollX === 'number' &&
    typeof (value as Measured).scrollY === 'number'
  )
}

export function documentRect(measured: Measured): Rectangle {
  return {
    x: measured.x + measured.scrollX,
    y: measured.y + measured.scrollY,
    width: measured.width,
    height: measured.height,
  }
}

/**
 * The crop box in integer coordinates inside the page — a CSS rect off the
 * renderer is fractional and may hang past the edge.
 *
 * A box that misses the page entirely is refused rather than clamped. Clamping
 * it produced a 1px sliver under a `cropped` field naming the box that was
 * asked for, so a stale rect answered with a picture of nothing and said
 * nothing about why.
 */
export function cropTo(
  rect: Rectangle,
  bounds: Rectangle,
): { rect?: Rectangle; error?: string } {
  const x = Math.max(0, Math.floor(rect.x))
  const y = Math.max(0, Math.floor(rect.y))
  const width = Math.min(Math.ceil(rect.width), bounds.width - x)
  const height = Math.min(Math.ceil(rect.height), bounds.height - y)
  return width < 1 || height < 1
    ? {
        error: `the crop box ${JSON.stringify(rect)} falls outside the ${bounds.width}x${bounds.height} page — a view's box comes from jb.sessionSummary() and a selector, and a scrolled page moves it`,
      }
    : { rect: { x, y, width, height } }
}

export function pngSize(png: Buffer) {
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) }
}

export function requestedScale(value: unknown) {
  return typeof value === 'number' && value > 0
    ? Math.min(Math.max(value, SCALE_MIN), SCALE_MAX)
    : 1
}

/**
 * The image resized to `scale` pixels per CSS pixel of the box captured.
 *
 * The two capture routes answer at different densities — `capturePage` in
 * device pixels, the devtools clip in CSS pixels — so one session screenshot at
 * two sizes on a 2x display, and the conformance check comparing the two
 * heights only passed because dev and CI run at 1x. Measured against the CSS
 * box that was asked for rather than trusted, so `scale` means the same thing
 * whatever the display does. Capping it at 1 by default also stops a retina
 * capture spending four times the bytes on detail every client resizes away.
 */
export function atScale(png: Buffer, cssWidth: number, scale: number) {
  const wanted = Math.max(1, Math.round(cssWidth * scale))
  return pngSize(png).width === wanted
    ? png
    : nativeImage
        .createFromBuffer(png)
        .resize({ width: wanted, quality: 'best' })
        .toPNG()
}

// A selector measures where the element sits in the VIEWPORT; the full-page
// capture is addressed in document coordinates, so a scrolled page has the
// renderer's scroll offset added back.
async function cropRect(
  args: Record<string, unknown>,
  bounds: Rectangle,
  inDocument: boolean,
  relay: Relay,
): Promise<{ rect?: Rectangle; error?: string }> {
  const selector = typeof args.selector === 'string' ? args.selector : ''
  if (selector) {
    const measured = await relay('measure', { selector }, MEASURE_WAIT_MS)
    if (measured.error !== undefined) {
      return { error: measured.error }
    }
    if (!isMeasured(measured.result)) {
      return { error: 'the page did not report a rectangle for the selector' }
    }
    const rect = inDocument ? documentRect(measured.result) : measured.result
    return cropTo(rect, bounds)
  }
  return isRect(args.rect) ? cropTo(args.rect, bounds) : {}
}

interface CapturedImage {
  data: Buffer
  rect?: Rectangle
  page?: { width: number; height: number }
  warning?: string
}

// capturePage sees the viewport and nothing past it, and a session taller than
// the window is the common case in every filmed take. The devtools protocol
// captures the laid-out document instead, by widening the viewport for the one
// frame — the same thing puppeteer's fullPage does.
async function captureFullPage(
  contents: BrowserWindow['webContents'],
  args: Record<string, unknown>,
  scale: number,
  relay: Relay,
): Promise<CapturedImage | { error: string }> {
  const dbg = contents.debugger
  // DevTools is the attacher `screenshot` checks for by name, because it is the
  // one a user opens from the View menu and the one worth a remedy. Anything
  // else holding the slot throws here, and a raw "Another debugger is already
  // attached" says nothing about what to do with it.
  try {
    dbg.attach('1.3')
  } catch (e) {
    return {
      error: `fullPage needs the devtools protocol and something else is holding it (${e instanceof Error ? e.message : String(e)}) — close DevTools, or screenshot the viewport instead`,
    }
  }
  try {
    const metrics = (await dbg.sendCommand('Page.getLayoutMetrics')) as {
      cssContentSize?: { width: number; height: number }
      contentSize: { width: number; height: number }
    }
    const content = metrics.cssContentSize ?? metrics.contentSize
    const bounds = { x: 0, y: 0, ...content }
    const crop = await cropRect(args, bounds, true, relay)
    if (crop.error !== undefined) {
      return { error: crop.error }
    }
    const clip = crop.rect ?? bounds
    const shot = (await dbg.sendCommand('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: true,
      clip: { ...clip, scale: 1 },
    })) as { data: string }
    return {
      rect: crop.rect,
      page: content,
      data: atScale(Buffer.from(shot.data, 'base64'), clip.width, scale),
    }
  } finally {
    dbg.detach()
  }
}

export function createScreenshotTool({
  getWindow,
  relay,
}: {
  getWindow: () => BrowserWindow | null
  relay: Relay
}) {
  // The devtools protocol admits one debugger per webContents, so a second
  // full-page capture while the first holds it throws "Another debugger is
  // already attached". Serialized rather than refused: two clients both asked
  // for the document, and answering one of them with the viewport is the wrong
  // picture under a plausible result.
  let fullPageTurn: Promise<unknown> = Promise.resolve()
  function takeTurn<T>(work: () => Promise<T>): Promise<T> {
    const next = fullPageTurn.then(work, work)
    fullPageTurn = next.catch(() => {})
    return next
  }

  return async function screenshot(
    args: Record<string, unknown>,
  ): Promise<BridgeToolResult> {
    // clamped under the relay timeout, which would otherwise fire first and
    // silently convert a long wait into a warning
    const timeoutMs = Math.min(
      typeof args.timeoutMs === 'number' ? args.timeoutMs : SCREENSHOT_WAIT_MS,
      SCREENSHOT_WAIT_MAX_MS,
    )
    // budget the relay against the wait actually requested: a timeoutMs: 0
    // screenshot must not be able to block for the default relay timeout
    const settled = await relay(
      'wait_ready',
      { timeoutMs },
      Math.max(timeoutMs + 15_000, 30_000),
    )
    const win = getWindow()
    if (!win) {
      return { error: 'JBrowse Desktop has no window open' }
    }
    const scale = requestedScale(args.scale)
    const { width, height } = win.getContentBounds()
    const viewport = { x: 0, y: 0, width, height }
    // DevTools holds the only debugger slot a webContents has, so a full-page
    // capture with it open used to throw. The viewport is the honest fallback,
    // and it says which of the two it gave back.
    const devtools =
      args.fullPage === true && win.webContents.isDevToolsOpened()
    const fullPage = args.fullPage === true && !devtools
    const crop = fullPage ? {} : await cropRect(args, viewport, false, relay)
    if (crop.error !== undefined) {
      return { error: crop.error }
    }
    // An occluded window composites nothing new, and capturePage then answers
    // with whatever frame it last had: three captures across two navigations
    // came back byte-identical, each under a settled: true. Throttling off for
    // the capture lets the hidden page paint the settled DOM, and the renderer
    // says when a frame has actually been produced.
    const contents = win.webContents
    const throttled = contents.getBackgroundThrottling()
    contents.setBackgroundThrottling(false)
    let painted
    let captured: CapturedImage | { error: string }
    try {
      painted = await relay('paint', {}, PAINT_WAIT_MS)
      captured = fullPage
        ? await takeTurn(() => captureFullPage(contents, args, scale, relay))
        : {
            rect: crop.rect,
            data: atScale(
              (await contents.capturePage(crop.rect)).toPNG(),
              crop.rect?.width ?? width,
              scale,
            ),
          }
    } finally {
      contents.setBackgroundThrottling(throttled)
    }
    if ('error' in captured) {
      return captured
    }
    const paint = (painted.result ?? {}) as {
      hidden?: boolean
      painted?: boolean
    }
    const stale =
      painted.error !== undefined || paint.painted === false
        ? `the window is hidden and produced no new frame before the capture, so the image may be stale — bring JBrowse Desktop to the front (${painted.error ?? 'paint timed out'})`
        : undefined
    const warnings = [
      settled.error,
      stale,
      devtools
        ? 'fullPage needs the devtools protocol, which DevTools itself is holding — this is the viewport instead; close DevTools for the whole document'
        : undefined,
    ].filter(w => w !== undefined)
    return {
      result: {
        ...(settled.error ? {} : resultFields(settled.result)),
        ...(warnings.length ? { warning: warnings.join('; ') } : {}),
        ...(captured.rect ? { cropped: captured.rect } : {}),
        ...(captured.page ? { page: captured.page } : {}),
        image: pngSize(captured.data),
      },
      image: {
        data: captured.data.toString('base64'),
        mimeType: 'image/png',
      },
    }
  }
}
