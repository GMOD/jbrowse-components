#!/usr/bin/env node
// Drives the hs1 vs mm39 dotplot session-spec URL and screenshots the result
// after autoDiagonalize completes.

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

const spec = encodeURIComponent(
  JSON.stringify({
    views: [
      {
        type: 'DotplotView',
        tracks: ['hs1ToMm39.over.chain.pif'],
        views: [{ assembly: 'hs1' }, { assembly: 'mm39' }],
        autoDiagonalize: true,
        colorBy: 'query',
        minAlignmentLength: 1000000,
      },
    ],
  }),
)

async function main() {
  const server = await startServer()
  console.log(`server on http://localhost:${PORT}`)
  const browser = await launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: { width: 1920, height: 1080 },
  })
  const page = await browser.newPage()
  page.on('console', msg => {
    const t = msg.text()
    if (t.includes('error') || t.includes('Error') || t.includes('diagonal')) {
      console.log(`[${msg.type()}] ${t}`)
    }
  })
  page.on('pageerror', err => {
    console.log(`[pageerror] ${err.message}`)
  })
  const url = `http://localhost:${PORT}/?config=test_data/hs1_vs_mm39/config.json&session=spec-${spec}`
  console.log(`navigating ${url.slice(0, 120)}...`)
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 })

  // Dotplot uses a generic 'canvas_done' or similar — wait for any canvas.
  // Conservative: wait for either a 'canvas_done' testid or 60s, then a
  // post-fetch settle window for autoDiagonalize.
  const start = Date.now()
  try {
    await page.waitForSelector('canvas', { timeout: 60000 })
    console.log(`first canvas after ${Date.now() - start}ms`)
  } catch (e) {
    console.warn(`timeout waiting for canvas: ${e.message}`)
  }
  await new Promise(r => setTimeout(r, 12000))

  const outPng = path.join(REPO, 'verify-hs1-mm39-dotplot.png')
  await page.screenshot({ path: outPng, fullPage: false })
  console.log(`screenshot ${outPng}`)

  await browser.close()
  server.close()
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
