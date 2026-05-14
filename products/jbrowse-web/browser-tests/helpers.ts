import { PNG } from 'pngjs'

import { snapshotConfig } from './snapshot.ts'

import type { Browser, Page } from 'puppeteer'

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

export const delay = (ms: number) =>
  new Promise(resolve => setTimeout(resolve, ms))

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
) {
  const searchText = typeof text === 'string' ? text : text.source
  // ::-p-text() is unreliable in Firefox BiDi with per-browser restarts.
  // Fall back to DOM-based text search if the Puppeteer selector fails.
  try {
    return await page.waitForSelector(`::-p-text(${searchText})`, {
      timeout: Math.min(timeout, 3000),
    })
  } catch {
    await page.waitForFunction(
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      (t: string) => document.body?.textContent?.includes(t) ?? false,
      { timeout },
      searchText,
    )
    return null
  }
}

export async function waitForLoadingToComplete(page: Page, timeout = 30000) {
  await page.waitForFunction(
    () =>
      document.querySelectorAll('[data-testid="loading-overlay"]').length === 0,
    { timeout },
  )
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
  await page.waitForFunction(
    () =>
      document.querySelectorAll('[data-testid="loading-overlay"]').length === 0,
    { timeout },
  )
}

export async function navigateToApp(
  page: Page,
  config = 'test_data/volvox/config.json',
  sessionName = 'Test Session',
) {
  const url = appendGpuParam(
    `http://localhost:${PORT}/?config=${config}&sessionName=${encodeURIComponent(sessionName)}`,
  )
  await page.goto(url, {
    waitUntil: 'networkidle0',
    timeout: 60000,
  })
  await findByText(page, 'ctgA')
}

export async function navigateWithSessionSpec(
  page: Page,
  spec: Record<string, unknown>,
  config = 'test_data/volvox/config.json',
) {
  const specParam = encodeURIComponent(JSON.stringify(spec))
  const url = appendGpuParam(
    `http://localhost:${PORT}/?config=${config}&session=spec-${specParam}&sessionName=Test%20Session`,
  )
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 })
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

export async function waitForCanvas(
  page: Page,
  testIdOrRegex: string,
  timeout = 60000,
) {
  await page.waitForSelector(`[data-testid="${testIdOrRegex}"]`, { timeout })
}

// Asserts a rendered element actually drew something interesting — not a
// blank or single-color fill. The snapshot system treats blank captures as
// passes (auto-creates goldens, skips blank WebGL frames), so this is the
// explicit "the display shows real data" gate. Counts distinct quantized
// colors and the fraction of pixels differing from the top-left background.
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
  // @ts-expect-error pngjs accepts a Uint8Array at runtime
  const { data, width, height } = PNG.sync.read(buf)
  const total = width * height
  const colors = new Set<number>()
  const bgR = data[0]!
  const bgG = data[1]!
  const bgB = data[2]!
  let nonBg = 0
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]!
    const g = data[i + 1]!
    const b = data[i + 2]!
    // quantize to 4 bits/channel so antialiasing noise isn't counted as color
    colors.add(((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4))
    if (
      Math.abs(r - bgR) > 12 ||
      Math.abs(g - bgG) > 12 ||
      Math.abs(b - bgB) > 12
    ) {
      nonBg++
    }
  }
  const nonBgFraction = nonBg / total
  if (colors.size < minDistinctColors || nonBgFraction < minNonBgFraction) {
    throw new Error(
      `assertCanvasHasContent: ${selector} looks blank — ` +
        `${colors.size} distinct colors (need ${minDistinctColors}), ` +
        `${(nonBgFraction * 100).toFixed(3)}% non-background pixels ` +
        `(need ${(minNonBgFraction * 100).toFixed(3)}%)`,
    )
  }
  return { distinctColors: colors.size, nonBgFraction }
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
