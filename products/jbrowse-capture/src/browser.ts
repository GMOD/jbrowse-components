import fs from 'node:fs'

import puppeteer from 'puppeteer'

export const BASE_CHROME_ARGS = ['--no-sandbox', '--disable-setuid-sandbox']

const CHROME_PATHS = [
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
]

// `CHROME_PATH`, then a system Chrome, then undefined for Puppeteer's own
export function findChromeExecutable(): string | undefined {
  return process.env.CHROME_PATH ?? CHROME_PATHS.find(p => fs.existsSync(p))
}

export interface LaunchOptions {
  headless?: boolean
  /** Chrome binary. Defaults to $CHROME_PATH, a system Chrome, then Puppeteer's own. */
  executablePath?: string
  /** Extra Chrome flags, appended to the defaults. */
  args?: string[]
}

/**
 * The browser `openJBrowse` drives, for a page it cannot open itself: an
 * embedded view on your own host page, navigated and then waited on with
 * `waitForJBrowseReady`.
 */
export function launchBrowser({
  headless = true,
  executablePath = findChromeExecutable(),
  args = [],
}: LaunchOptions = {}) {
  return puppeteer.launch({
    headless,
    executablePath,
    args: [...BASE_CHROME_ARGS, ...args],
  })
}

const NOISE_NEEDLES = [
  'favicon',
  'window.jb drives this app programmatically',
  'GPU stall',
  '[GPU] WebGPU not supported',
  '[GPU] No compatible GPU adapter',
  '[GPU] WebGPU initialization failed',
  '[GPU] WebGL2 unavailable',
  '[GPU] WebGL2 here is software-rendered',
  '[GPU] WebGPU device creation failed',
  'GroupMarkerNotSet',
  'Automatic fallback to software WebGL',
  'No available adapters',
  'Failed to create WebGPU Context Provider',
]

export function isBrowserConsoleNoise(text: string): boolean {
  if (text.includes('[WebGL2Hal #')) {
    return !text.includes('context LOST') && !text.includes('GL error')
  }
  return NOISE_NEEDLES.some(n => text.includes(n))
}
