/* eslint-disable no-console */
import { BASE_CHROME_ARGS } from '@jbrowse/browser-test-utils'
import { launch } from 'puppeteer'

import { startServer } from './server.ts'

const PORT = 3346

// List every JS chunk actually pulled over the wire on cold shell load, with
// per-file encodedDataLength, so we can see exactly what the cold start costs.
async function main() {
  const server = await startServer(PORT)
  const browser = await launch({ headless: true, args: BASE_CHROME_ARGS })
  const page = await browser.newPage()
  const client = await page.createCDPSession()
  await client.send('Network.enable')

  const urlByReq = new Map<string, string>()
  const files: { url: string; bytes: number }[] = []
  client.on('Network.responseReceived', (e: any) => {
    urlByReq.set(e.requestId, e.response.url)
  })
  client.on('Network.loadingFinished', (e: any) => {
    const url = urlByReq.get(e.requestId) || ''
    if (url.endsWith('.js') || url.includes('.js?')) {
      files.push({ url: url.split('/').pop()!, bytes: e.encodedDataLength || 0 })
    }
  })

  await page.goto(
    `http://localhost:${PORT}/?config=test_data/volvox/config.json&renderer=canvas2d`,
    { waitUntil: 'networkidle0', timeout: 60000 },
  )
  await page.waitForSelector('#root *', { timeout: 45000 }).catch(() => {})
  await new Promise(r => setTimeout(r, 1500))
  await browser.close()

  files.sort((a, b) => b.bytes - a.bytes)
  let total = 0
  for (const f of files) {
    total += f.bytes
    console.log(`${(f.bytes / 1024).toFixed(1).padStart(9)} KB  ${f.url}`)
  }
  console.log(
    `\nTOTAL cold-shell JS over wire: ${(total / 1024).toFixed(1)} KB in ${files.length} files`,
  )
  server.close()
  process.exit(0)
}

void main()
