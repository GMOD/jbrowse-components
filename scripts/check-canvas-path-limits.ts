// Draws each batched Canvas2D painter past the path size where Chrome's
// GPU-rasterized canvas silently paints nothing, and fails on any pixel column
// the painter should have inked and did not.
//
//   pnpm check-canvas-path-limits

import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { build } from 'esbuild'
import puppeteer from 'puppeteer'

import { findChromeExecutable } from '../products/jbrowse-capture/src/browser.ts'

const here = path.dirname(fileURLToPath(import.meta.url))

// Headless Chrome rasterizes Canvas2D in software unless the GPU blocklist is
// off, and the software rasterizer has no path limit to find.
const GPU_CANVAS_ARGS = [
  '--no-sandbox',
  '--enable-unsafe-swiftshader',
  '--use-gl=angle',
  '--use-angle=swiftshader',
  '--ignore-gpu-blocklist',
]

const bundle = await build({
  entryPoints: [path.join(here, 'canvasPathLimits.page.ts')],
  bundle: true,
  write: false,
  format: 'iife',
  logLevel: 'error',
})

const browser = await puppeteer.launch({
  headless: true,
  executablePath: findChromeExecutable(),
  args: GPU_CANVAS_ARGS,
  protocolTimeout: 600_000,
})
let failed = false
try {
  const page = await browser.newPage()
  await page.addScriptTag({ content: bundle.outputFiles[0]!.text })
  const controlUnlit = await page.evaluate(() => window.runCanvasPathControl())
  if (controlUnlit === 0) {
    failed = true
    console.error(
      'control: 200,000 discs in one path painted, so this browser does not drop an oversized path and the checks below prove nothing',
    )
  }
  const count = await page.evaluate(() => window.canvasPathCaseCount)
  for (let i = 0; i < count; i++) {
    const { name, shapes, unlitColumns } = await page.evaluate(
      j => window.runCanvasPathCase(j),
      i,
    )
    const ok = unlitColumns === 0
    failed ||= !ok
    console.log(
      `${ok ? 'ok  ' : 'FAIL'} ${name}, ${shapes.toLocaleString()} shapes${ok ? '' : `: ${unlitColumns} columns unpainted`}`,
    )
  }
} finally {
  await browser.close()
}
process.exit(failed ? 1 : 0)
