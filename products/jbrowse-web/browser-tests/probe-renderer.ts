/* eslint-disable no-console */
// Which rasterizer does each runner launch configuration actually get?
//
// The threshold audit in crossBackendGate.ts turns on a rasterizer test: render
// the same build under two different rasterizers, and if a pair's drift is
// **identical to two decimals** it cannot be antialiasing, so something is being
// drawn differently. That inference is only as good as the two runs actually
// differing — and the recipe for the second run ("omit --swiftshader") does not
// do what it reads like:
//
//   headless, no flags            ANGLE (Google, Vulkan 1.3.0 (SwiftShader …))
//   headless --use-gl=swiftshader ANGLE (Google, Vulkan 1.3.0 (SwiftShader …))
//   headless --use-gl=angle       ANGLE (Intel, Mesa Intel(R) UHD Graphics 630)
//   headless --disable-gpu        ANGLE (Google, Vulkan 1.3.0 (SwiftShader …))
//
// Measured 2026-08-11 on a box with two discrete GPUs. **Headless Chrome does
// not pick up the machine's GPU on its own**, so "with and without
// --swiftshader" is SwiftShader against SwiftShader and every pair agrees to two
// decimals for a reason that has nothing to do with rendering — a check that
// passes by proving nothing. `runner.ts --real-gpu` pushes `--use-gl=angle` and
// is the flag that makes the comparison real.
//
// Run it when that claim needs re-checking on a different box, a different
// Chrome, or a headed run:
//
//   node products/jbrowse-web/browser-tests/probe-renderer.ts
import { BASE_CHROME_ARGS } from '@jbrowse/browser-test-utils'
import puppeteer from 'puppeteer'

const BASE = [...BASE_CHROME_ARGS, '--disable-popup-blocking']

const CONFIGS: [string, string[]][] = [
  ['no flags (runner without --swiftshader)', BASE],
  [
    '--use-gl=swiftshader (runner --swiftshader)',
    [...BASE, '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  ],
  ['--use-gl=angle (runner --real-gpu)', [...BASE, '--use-gl=angle']],
  ['--disable-gpu (the canvas2d backend)', [...BASE, '--disable-gpu']],
]

for (const [label, args] of CONFIGS) {
  try {
    const browser = await puppeteer.launch({ headless: true, args })
    const page = await browser.newPage()
    // UNMASKED_RENDERER_WEBGL, not RENDERER — the masked string is a fixed
    // "WebKit WebGL" on every backend and would report all four as identical,
    // which is the exact false negative this probe exists to rule out.
    const renderer = await page.evaluate(() => {
      const gl = document.createElement('canvas').getContext('webgl2')
      if (!gl) {
        return 'no webgl2 context'
      }
      const ext = gl.getExtension('WEBGL_debug_renderer_info')
      return ext
        ? (gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) as string)
        : `${gl.getParameter(gl.RENDERER) as string} (masked; no debug ext)`
    })
    console.log(`  ${label.padEnd(46)} ${renderer}`)
    await browser.close()
  } catch (e) {
    console.log(
      `  ${label.padEnd(46)} LAUNCH FAILED: ${e instanceof Error ? e.message : e}`,
    )
  }
}
