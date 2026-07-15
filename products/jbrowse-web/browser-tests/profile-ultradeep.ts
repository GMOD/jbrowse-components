/* eslint-disable no-console */
// One-off ultra-deep alignments profiler. See project memory
// "ultra-deep alignments profiling". Not part of the suite.
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  BASE_CHROME_ARGS,
  encodeSessionSpec,
} from '@jbrowse/browser-test-utils'
import { launch } from 'puppeteer'

import { startServer } from './server.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = 3399
const OUT = path.join(__dirname, 'ultradeep-trace.json')
// <20kb window auto-force-loads past the fetchSizeLimit prompt so it renders.
const LOC = process.env.LOC || 'ctgA:14000-26000'

async function main() {
  const server = await startServer(PORT)
  const browser = await launch({ headless: true, args: BASE_CHROME_ARGS })
  const page = await browser.newPage()
  await page.setViewport({ width: 1500, height: 900 })

  const spec = {
    views: [
      {
        type: 'LinearGenomeView',
        assembly: 'volvox',
        loc: LOC,
        tracks: ['volvox_ultradeep'],
      },
    ],
  }
  const config = 'extra_test_data/volvox-ultradeep.json'
  const query = `config=${config}&session=${encodeSessionSpec(
    spec,
  )}&sessionName=Perf&renderer=canvas2d`

  await page.goto(`http://localhost:${PORT}/?config=${config}`, {
    waitUntil: 'networkidle0',
    timeout: 60000,
  })

  await page.tracing.start({
    path: OUT,
    screenshots: false,
    categories: [
      'devtools.timeline',
      'disabled-by-default-v8.cpu_profiler',
      'v8.execute',
      'toplevel',
    ],
  })

  const t0 = Date.now()
  await page.goto(`http://localhost:${PORT}/?${query}`, {
    waitUntil: 'domcontentloaded',
    timeout: 120000,
  })
  let doneMs = -1
  await page
    .waitForSelector('[data-testid="pileup-display-done"]', { timeout: 180000 })
    .then(() => {
      doneMs = Date.now() - t0
    })
    .catch(() => {
      console.log('WARN: pileup-display-done not seen')
    })
  await new Promise(r => setTimeout(r, 1500))

  await page.tracing.stop()
  await browser.close()
  server.close()

  console.log(`region ${LOC}  pileup-done ${doneMs} ms`)
}

void main().then(() => process.exit(0))
