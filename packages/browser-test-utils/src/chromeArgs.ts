import { BASE_CHROME_ARGS as CAPTURE_CHROME_ARGS } from '@jbrowse/capture'

// The harness serves fixtures from several local origins; @jbrowse/capture
// keeps CORS on so a capture fails where a user's browser would.
export const BASE_CHROME_ARGS = [
  ...CAPTURE_CHROME_ARGS,
  '--disable-web-security',
]

/**
 * Launch args and viewport for a Chrome that renders at `dpr` as a hi-dpi
 * screen does. Puppeteer's `deviceScaleFactor` emulates the scale instead:
 * the page lays out on whole CSS px and Chrome scales the result, so at a
 * fractional dpr a canvas on an odd CSS px lands half a device px off and
 * blurs, and overlays over it smear, which no real screen shows. A viewport
 * `deviceScaleFactor` of 0 keeps the window size without that override.
 */
export function chromeAtDpr(dpr: number, width: number, height: number) {
  return {
    args: [`--force-device-scale-factor=${dpr}`],
    defaultViewport: { width, height, deviceScaleFactor: 0 },
  }
}
