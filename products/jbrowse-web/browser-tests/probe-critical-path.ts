/* eslint-disable no-console */
// Load the cold shell, collect the JS chunks it actually pulls, then grep only
// those for marker strings of libraries we want off the critical path.
import fs from 'node:fs'
import path from 'node:path'
import { gzipSync } from 'node:zlib'

import { BASE_CHROME_ARGS } from '@jbrowse/browser-test-utils'
import { launch } from 'puppeteer'

import { collectWireRequests, isJsOrCssUrl } from './cdpNetwork.ts'
import { buildPath, startServer } from './server.ts'

// A marker has to be long enough to mean something. `dockview css` used to be
// probed as `dv-`, which matched React's SVG attribute table (`horiz-adv-x`) and
// so reported ON CRITICAL PATH forever — including after ADR-068 removed
// dockview from the tree entirely, when there was nothing left to find.
const MARKERS: Record<string, string> = {
  '@floating-ui': 'clippingAncestors',
  '@leeoniya/ufuzzy': 'test man ger pp a',
  'pako inflate': 'incorrect header check',
  'MUI Autocomplete': 'MuiAutocomplete',
  'MUI Slider': 'MuiSlider',
  '@popperjs': 'popperOffsets',
  // the stack-trace dialog's source-map consumer, which every route into it
  // reaches through a lazy() — so a static import creeping back in is the thing
  // this line is here to catch
  'source-map-js': 'Expected more digits in base 64 VLQ value.',
}

const PORT = 3352

async function main() {
  const server = await startServer(PORT)
  const browser = await launch({ headless: true, args: BASE_CHROME_ARGS })
  const page = await browser.newPage()
  const requests = await collectWireRequests(page)
  await page.goto(
    `http://localhost:${PORT}/?config=test_data/volvox/config.json&renderer=canvas2d`,
    { waitUntil: 'networkidle0', timeout: 90000 },
  )
  await page.waitForSelector('#root *', { timeout: 60000 }).catch(() => {})
  await new Promise(r => setTimeout(r, 1500))
  await browser.close()
  server.close()

  const files = new Set(
    requests
      .filter(r => isJsOrCssUrl(r.url) && r.url.includes('/static/'))
      .map(r => r.url.split('/static/')[1]!.split('?')[0]!),
  )

  let rawTotal = 0
  let gzTotal = 0
  const contents: { file: string; text: string }[] = []
  for (const f of [...files].sort()) {
    const p = path.join(buildPath, 'static', f)
    if (fs.existsSync(p)) {
      const buf = fs.readFileSync(p)
      rawTotal += buf.length
      gzTotal += gzipSync(buf).length
      contents.push({ file: f, text: buf.toString('latin1') })
    }
  }
  const k = (n: number) => `${(n / 1024).toFixed(1)} KB`
  console.log(
    `cold shell: ${contents.length} static assets, ${k(rawTotal)} minified, ${k(gzTotal)} gzipped`,
  )
  console.log(
    `  (${contents.filter(c => c.file.endsWith('.css')).length} css, ${contents.filter(c => c.file.endsWith('.js')).length} js)\n`,
  )
  for (const [label, marker] of Object.entries(MARKERS)) {
    const hits = contents.filter(c => c.text.includes(marker))
    console.log(
      `${hits.length ? 'ON CRITICAL PATH' : 'absent          '}  ${label.padEnd(18)} ${hits.map(h => h.file.split('/').pop()).join(' ')}`,
    )
  }
  process.exit(0)
}

void main()
