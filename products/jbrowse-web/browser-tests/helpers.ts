import {
  delay,
  encodeSessionSpec,
  waitForLoadingComplete,
} from '@jbrowse/browser-test-utils'

import { analyzeCanvasPng, assertNonBlank } from './canvasContent.ts'
import { snapshotConfig } from './snapshot.ts'

import type { Browser, ElementHandle, Page } from 'puppeteer'

// re-exported so the suites keep importing it from './helpers'
export { delay }

export const PORT = 3333
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

export async function findByTestId(
  page: Page,
  testId: string,
  timeout = 30000,
) {
  return page.waitForSelector(`[data-testid="${testId}"]`, { timeout })
}

export async function findByText(
  page: Page,
  text: string | RegExp,
  timeout = 30000,
): Promise<ElementHandle | null> {
  if (typeof text === 'string') {
    // ::-p-text() is unreliable in Firefox BiDi with per-browser restarts.
    // Fall back to DOM-based text search if the Puppeteer selector fails.
    try {
      const handle = await page.waitForSelector(`::-p-text(${text})`, {
        timeout: Math.min(timeout, 3000),
      })
      return handle
    } catch {
      await page.waitForFunction(
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        (t: string) => document.body?.textContent?.includes(t) ?? false,
        { timeout },
        text,
      )
      return null
    }
  }
  // ::-p-text() can't do regex — it matches the source string literally, so
  // anchors (`^identity$`) and escapes never hit. Walk the DOM instead and
  // return a handle to the deepest element whose trimmed text matches.
  const handle = await page.waitForFunction(
    (source: string, flags: string) => {
      const re = new RegExp(source, flags)
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
    text.source,
    text.flags,
  )
  return handle.asElement() as ElementHandle | null
}

export async function waitForLoadingToComplete(page: Page, timeout = 30000) {
  await waitForLoadingComplete(page, { timeout })
}

export async function waitForDataLoaded(page: Page, timeout = 60000) {
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
    await button?.click()
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
  await trackLabel?.click()
}

export async function waitForDisplay(
  page: Page,
  trackId: string,
  timeout = 60000,
) {
  await page.waitForSelector(`[data-testid^="display-${trackId}"]`, { timeout })
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
  const el = await page.waitForSelector(selector, { timeout })
  if (!el) {
    throw new Error(`assertCanvasHasContent: element not found: ${selector}`)
  }
  const buf = await el.screenshot({ type: 'png' })
  const stats = analyzeCanvasPng(buf)
  assertNonBlank(stats, `assertCanvasHasContent: ${selector}`, {
    minDistinctColors,
    minNonBgFraction,
  })
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
  await popup.waitForSelector('input[type="submit"]', { timeout: 10000 })
  await delay(500)
  const submitBtn = await popup.$('input[type="submit"]')
  await submitBtn?.click()
  await delay(2000)
}

export async function handleBasicAuthLogin(
  page: Page,
  username = 'admin',
  password = 'password',
) {
  const dialog = await findByTestId(page, 'login-httpbasic', 10000)
  if (!dialog) {
    throw new Error('BasicAuth login dialog not found')
  }

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
  await usernameInput?.type(username)
  await passwordInput?.type(password)

  const submitBtn = await findByText(page, 'Submit', 10000)
  await submitBtn?.click()
  await delay(500)
}

// Workspace helpers
export async function waitForWorkspacesReady(page: Page) {
  await page.waitForSelector('.dockview-theme-light, .dockview-theme-dark', {
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
  await viewMenu?.click()
  await delay(300)
  const viewOptions = await findByText(page, 'View options', 10000)
  await viewOptions?.click()
  await delay(300)
  const copyViewBtn = await findByText(page, 'Copy view', 10000)
  await copyViewBtn?.click()
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
  await viewOptions?.click()
  await delay(300)
  const option = await findByText(page, optionText, 10000)
  await option?.click()
}

export async function setupWorkspacesViaMoveToTab(page: Page) {
  await copyView(page)
  await clickViewMenuOption(page, 'Move to new tab', 0)
  await waitForWorkspacesReady(page)
}

// Regression guard for GPU/DOM scroll tearing (ScrollLockedOverlay). A display
// that scrolls a position:sticky GPU canvas in a native overflow container has
// two scroll spaces: the DOM's compositor scrollTop and the main-thread
// model.scrollTop the canvas paints from. A DOM overlay that rides native
// scroll tears away from its glyphs when the main thread trails the compositor.
// We simulate that lag deterministically (headless scrolls synchronously so it
// can't reproduce the race on its own) by no-op'ing requestAnimationFrame — the
// DOM->model rAF sync then never fires, so model.scrollTop stays 0 — then
// scrolling the native container: the sticky canvas must not move, and the
// overlay must stay locked to it. Before the fix the overlay moved by -scroll.
export async function assertOverlayScrollLockedToCanvas(
  page: Page,
  canvasSelector: string,
  overlaySelector: string,
) {
  const res = await page.evaluate(
    (canvasSel: string, overlaySel: string) => {
      const canvas = document.querySelector(canvasSel)
      let el = canvas?.parentElement ?? null
      while (el && !/auto|scroll/.test(getComputedStyle(el).overflowY)) {
        el = el.parentElement
      }
      const overlay = document.querySelector(overlaySel)
      if (!el || !canvas || !overlay) {
        return { setupFailed: true as const }
      }
      const overlayBefore = overlay.getBoundingClientRect().top
      const canvasBefore = canvas.getBoundingClientRect().top
      const origRaf = window.requestAnimationFrame
      window.requestAnimationFrame = () => 0
      el.scrollTop = 60
      const overlayMoved = overlay.getBoundingClientRect().top - overlayBefore
      const canvasMoved = canvas.getBoundingClientRect().top - canvasBefore
      window.requestAnimationFrame = origRaf
      el.scrollTop = 0
      return {
        overflow: el.scrollHeight - el.clientHeight,
        overlayMoved,
        canvasMoved,
      }
    },
    canvasSelector,
    overlaySelector,
  )
  if (res.setupFailed) {
    throw new Error(
      `could not locate scroll container / canvas (${canvasSelector}) / overlay (${overlaySelector})`,
    )
  }
  if (res.overflow < 60) {
    throw new Error(
      `display did not overflow enough to scroll (${res.overflow}px)`,
    )
  }
  if (Math.abs(res.canvasMoved) > 1) {
    throw new Error(`sticky canvas moved ${res.canvasMoved}px (expected 0)`)
  }
  if (Math.abs(res.overlayMoved) > 1) {
    throw new Error(
      `overlay tore from the canvas: moved ${res.overlayMoved}px (expected ~0) — it is riding native scroll instead of model.scrollTop`,
    )
  }
}
