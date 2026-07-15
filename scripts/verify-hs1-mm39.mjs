#!/usr/bin/env node
// Drives the hs1 vs mm39 defaultSession in a headless browser and screenshots
// the synteny canvas after init/diagonalization completes. Used by the verify
// skill to confirm autoDiagonalize / colorBy=query / minAlignmentLength wiring
// is hit on first load.

import http from 'http'
import path from 'path'
import { fileURLToPath } from 'url'

import { launch } from 'puppeteer'
import handler from 'serve-handler'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO = path.resolve(__dirname, '..')
const BUILD = path.join(REPO, 'products/jbrowse-web/build')
const PORT = 3399

function startServer() {
  return new Promise(resolve => {
    const server = http.createServer((req, res) => {
      const url = req.url || '/'
      const publicPath =
        url.startsWith('/test_data/') || url.startsWith('/extra_test_data/')
          ? REPO
          : BUILD
      return handler(req, res, {
        public: publicPath,
        headers: [
          {
            source: '**/*',
            headers: [{ key: 'Access-Control-Allow-Origin', value: '*' }],
          },
        ],
      })
    })
    server.listen(PORT, () => {
      resolve(server)
    })
  })
}

async function main() {
  const server = await startServer()
  console.log(`server on http://localhost:${PORT}`)
  const browser = await launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: { width: 1920, height: 1080 },
  })
  const page = await browser.newPage()
  const consoleLines = []
  page.on('console', msg => {
    consoleLines.push(`[${msg.type()}] ${msg.text()}`)
  })
  page.on('pageerror', err => {
    consoleLines.push(`[pageerror] ${err.message}`)
  })
  const url = `http://localhost:${PORT}/?config=test_data/hs1_vs_mm39/config.json`
  console.log(`navigating ${url}`)
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 })

  // Wait for the synteny canvas to settle. The test rig uses the
  // synteny_canvas_done test id.
  const startWait = Date.now()
  try {
    await page.waitForSelector('[data-testid="synteny_canvas_done"]', {
      timeout: 120000,
    })
    console.log(`canvas done after ${Date.now() - startWait}ms`)
  } catch (e) {
    console.warn(`timeout waiting for synteny_canvas_done: ${e.message}`)
  }

  // Give the autoDiagonalize autorun extra time after the first render — it
  // mutates displayedRegions which forces a refetch.
  await new Promise(r => setTimeout(r, 8000))

  // Pull the refName order off the visible scale ruler labels. The
  // LinearGenomeView's overview/scale bar renders chrom labels in displayed
  // order, so this is a side-channel way to confirm diagonalization fired
  // without needing the root model exposed.
  const chromLabels = await page.evaluate(() => {
    // Find every text node inside the synteny view that looks like a chrom
    // label (chr-anything). Returns top-row vs bottom-row by y-coordinate.
    const out = []
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
    )
    let n = walker.nextNode()
    while (n) {
      const txt = (n.textContent ?? '').trim()
      if (/^chr[\w.-]+$/i.test(txt)) {
        const parent = n.parentElement
        const r = parent?.getBoundingClientRect()
        if (r && r.width > 0) {
          out.push({ text: txt, x: r.x, y: r.y })
        }
      }
      n = walker.nextNode()
    }
    return out
  })

  const outPng = path.join(REPO, 'verify-hs1-mm39.png')
  await page.screenshot({ path: outPng, fullPage: false })
  console.log(`screenshot ${outPng}`)
  console.log(`found ${chromLabels.length} chrom labels`)
  // Group labels by approximate y to identify rows
  chromLabels.sort((a, b) => a.y - b.y || a.x - b.x)
  const rowGroups = []
  for (const l of chromLabels) {
    const lastRow = rowGroups[rowGroups.length - 1]
    if (lastRow && Math.abs(lastRow[0].y - l.y) < 20) {
      lastRow.push(l)
    } else {
      rowGroups.push([l])
    }
  }
  for (const [i, row] of rowGroups.entries()) {
    console.log(
      `row ${i} (y=${row[0].y.toFixed(0)}): ${row.map(r => r.text).join(' ')}`,
    )
  }

  // Tail of console output for debugging
  console.log('--- last console lines ---')
  for (const line of consoleLines.slice(-30)) {
    console.log(line)
  }

  await browser.close()
  server.close()
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
