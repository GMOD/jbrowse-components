import { getBackend } from './snapshot.ts'

import type { Browser, Page } from 'puppeteer'

export const PORT = 3333
export const OAUTH_PORT = 3030
export const BASICAUTH_PORT = 3040

function appendGpuParam(url: string) {
  const backend = getBackend()
  if (!backend) {
    return url
  }
  const sep = url.includes('?') ? '&' : '?'
  return `${url}${sep}gpu=${backend}`
}

export const delay = (ms: number) =>
  new Promise(resolve => setTimeout(resolve, ms))

export async function findByTestId(
  page: Page,
  testId: string,
  timeout = 30000,
) {
  return page.waitForSelector(`[data-testid="${testId}"]`, {
    timeout,
    visible: true,
  })
}

export async function findByText(
  page: Page,
  text: string | RegExp,
  timeout = 30000,
) {
  const searchText = typeof text === 'string' ? text : text.source
  return page.waitForSelector(`::-p-text(${searchText})`, {
    timeout,
    visible: true,
  })
}

export async function waitForLoadingToComplete(page: Page, timeout = 30000) {
  await page.waitForFunction(
    () =>
      document.querySelectorAll('[data-testid="loading-overlay"]').length === 0,
    { timeout },
  )
}

export async function waitForCanvasRendered(
  page: Page,
  selector: string,
  timeout = 30000,
) {
  await page.waitForFunction(
    (sel: string) => {
      const canvas = document.querySelector(sel) as HTMLCanvasElement | null
      if (!canvas || canvas.width === 0 || canvas.height === 0) {
        return false
      }
      const w = Math.min(canvas.width, 100)
      const h = Math.min(canvas.height, 100)
      const gl =
        (canvas.getContext('webgl2', {
          preserveDrawingBuffer: true,
        }) as WebGL2RenderingContext | null) ||
        (canvas.getContext('webgl', {
          preserveDrawingBuffer: true,
        }) as WebGLRenderingContext | null)
      if (gl) {
        const pixels = new Uint8Array(w * h * 4)
        gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels)
        for (let i = 3; i < pixels.length; i += 4) {
          if (pixels[i]! > 0) {
            return true
          }
        }
        return false
      }
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      if (!ctx) {
        return false
      }
      const { data } = ctx.getImageData(0, 0, w, h)
      for (let i = 3; i < data.length; i += 4) {
        if (data[i]! > 0) {
          return true
        }
      }
      return false
    },
    { timeout, polling: 200 },
    selector,
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

export async function handleBasicAuthLogin(page: Page) {
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
  await usernameInput?.type('admin')
  await passwordInput?.type('password')

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
