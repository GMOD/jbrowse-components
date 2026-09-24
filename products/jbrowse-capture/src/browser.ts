import fs from 'node:fs'

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
