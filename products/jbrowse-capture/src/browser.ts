import fs from 'node:fs'

// Just the sandbox flags, for the scripts that MEASURE cross-origin behaviour
// (COOP/COEP isolation, cancelled cross-origin fetches) and would be measuring
// nothing with web security off. They used to spell this
// `BASE_CHROME_ARGS.filter(a => a !== '--disable-web-security')`, which silently
// stops subtracting the day another security flag is added below.
export const SANDBOX_CHROME_ARGS = ['--no-sandbox', '--disable-setuid-sandbox']

// Chrome flags both harnesses launch with. Backend-specific flags
// (--disable-gpu, --enable-unsafe-swiftshader, --disable-popup-blocking) are
// appended by each caller.
export const BASE_CHROME_ARGS = [
  ...SANDBOX_CHROME_ARGS,
  '--disable-web-security',
]

const CHROME_PATHS = [
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
]

// First installed system Chrome/Chromium, or undefined to let Puppeteer use its
// bundled browser. `CHROME_PATH` wins, so a run can be pinned to one binary --
// which is how you answer "did the browser move under us?" when a figure regen
// reports the whole corpus as changed.
//
// Measured 2026-08-02, because that question came up and the answer was no: the
// same spec rendered under Chrome 147.0.7727.57 and 151.0.7922.47 produces
// byte-identical PNGs, and the system package's 151.0.7922.47 -> .71 roll
// likewise changed nothing. So a corpus-wide diff is accumulated app change
// since the last `Bump snaps` sweep, not the browser -- don't chase it here.
export function findChromeExecutable(): string | undefined {
  return process.env.CHROME_PATH ?? CHROME_PATHS.find(p => fs.existsSync(p))
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
