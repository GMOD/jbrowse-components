/* eslint-disable no-console */
import { BASE_CHROME_ARGS, encodeSessionSpec } from '@jbrowse/browser-test-utils'
import { launch } from 'puppeteer'

import { startServer } from './server.ts'

const PORT = 3345

// Measure real bytes-over-the-wire (CDP encodedDataLength) for JS, for two
// scenarios: cold app shell, and opening a track (pulls plugin chunks + worker).
async function measure(
  label: string,
  buildUrlSuffix: string,
  waitSelector: string,
) {
  const browser = await launch({ headless: true, args: BASE_CHROME_ARGS })
  const page = await browser.newPage()
  const client = await page.target().createCDPSession()
  await client.send('Network.enable')

  const urlByReq = new Map<string, string>()
  let jsBytes = 0
  let jsCount = 0
  let allBytes = 0
  client.on('Network.responseReceived', (e: any) => {
    urlByReq.set(e.requestId, e.response.url)
  })
  client.on('Network.loadingFinished', (e: any) => {
    const url = urlByReq.get(e.requestId) || ''
    allBytes += e.encodedDataLength || 0
    if (url.endsWith('.js') || url.includes('.js?')) {
      jsBytes += e.encodedDataLength || 0
      jsCount++
    }
  })

  await page.goto(`http://localhost:${PORT}/?${buildUrlSuffix}`, {
    waitUntil: 'networkidle0',
    timeout: 60000,
  })
  await page.waitForSelector(waitSelector, { timeout: 45000 }).catch(() => {})
  await new Promise(r => setTimeout(r, 1000))

  await browser.close()
  return { label, jsBytes, jsCount, allBytes }
}

async function main() {
  const server = await startServer(PORT)
  const k = (n: number) => (n / 1024).toFixed(0) + ' KB'

  const shell = await measure(
    'cold app shell',
    'config=test_data/volvox/config.json&renderer=canvas2d',
    '#root *',
  )

  const spec = {
    views: [
      {
        type: 'LinearGenomeView',
        assembly: 'volvox',
        loc: 'ctgA:1-50000',
        tracks: ['volvox_microarray_line'],
      },
    ],
  }
  const track = await measure(
    'open a track',
    `config=test_data/volvox/config.json&session=${encodeSessionSpec(spec)}&sessionName=M&renderer=canvas2d`,
    '[data-testid$="-done"]',
  )

  for (const r of [shell, track]) {
    console.log(
      `${r.label.padEnd(16)} JS over wire: ${k(r.jsBytes).padStart(9)} in ${r.jsCount} reqs  | all assets: ${k(r.allBytes)}`,
    )
  }
  server.close()
  process.exit(0)
}

void main()
