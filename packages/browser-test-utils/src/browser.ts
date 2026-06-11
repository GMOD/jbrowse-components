import fs from 'fs'

// Chrome flags both harnesses launch with. Backend-specific flags
// (--disable-gpu, --enable-unsafe-swiftshader, --disable-popup-blocking) are
// appended by each caller.
export const BASE_CHROME_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-web-security',
]

const CHROME_PATHS = [
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
]

// First installed system Chrome/Chromium, or undefined to let Puppeteer use its
// bundled browser.
export function findChromeExecutable(): string | undefined {
  return CHROME_PATHS.find(p => fs.existsSync(p))
}

// GPU/WebGL lifecycle chatter that isn't a real error. Real GPU failures
// (`context LOST`, `GL error`) are deliberately NOT suppressed.
const NOISE_NEEDLES = [
  'favicon',
  'GPU stall',
  '[GPU] WebGPU not supported',
  '[GPU] No compatible GPU adapter',
  '[GPU] WebGPU initialization failed',
  '[GPU] WebGL2 unavailable',
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
