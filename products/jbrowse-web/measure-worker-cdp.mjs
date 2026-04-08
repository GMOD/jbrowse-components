import { spawn } from 'child_process'
import puppeteer from 'puppeteer'

const PORT = 9555
const server = spawn('npx', ['serve', 'build', '-l', String(PORT), '--no-clipboard'], {
  stdio: ['ignore', 'pipe', 'pipe'],
})

for (let i = 0; i < 20; i++) {
  try {
    await fetch(`http://localhost:${PORT}/`)
    break
  } catch {
    await new Promise(r => setTimeout(r, 500))
  }
}

try {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox'],
  })
  const page = await browser.newPage()

  const jsStats = {
    requests: [],
    totalUncompressed: 0,
  }

  const client = await page.createCDPSession()
  await client.send('Network.enable')

  // Track all network responses
  client.on('Network.responseReceived', event => {
    const { response, requestId } = event
    if (response.url.includes('/static/js/') && response.url.endsWith('.js')) {
      // Get the actual response body
      client.send('Network.getResponseBody', { requestId }).then(body => {
        const filename = response.url.split('/').pop()
        const uncompressedSize = body.body.length
        jsStats.requests.push({
          filename,
          url: response.url,
          size: uncompressedSize,
        })
        jsStats.totalUncompressed += uncompressedSize
      }).catch(() => {})
    }
  })

  console.log('Loading page...')
  const start = Date.now()
  await page.goto(`http://localhost:${PORT}/?config=test_data/volvox/config.json`, {
    waitUntil: 'networkidle0',
    timeout: 60000,
  })
  const pageLoadTime = Date.now() - start

  await new Promise(r => setTimeout(r, 3000))

  // Sort by size
  jsStats.requests.sort((a, b) => b.size - a.size)

  console.log(`\n=== Runtime JS Loading (Uncompressed) ===`)
  console.log(`Page load time: ${pageLoadTime}ms`)
  console.log(`Total uncompressed JS: ${(jsStats.totalUncompressed / 1024).toFixed(1)} KB`)
  console.log(`Files loaded: ${jsStats.requests.length}`)
  console.log(`\nTop 20 largest files:`)
  for (const f of jsStats.requests.slice(0, 20)) {
    console.log(`  ${(f.size / 1024).toFixed(1).padStart(8)} KB  ${f.filename}`)
  }

  await browser.close()
  process.exit(0)
} catch(e) {
  console.error(e)
  process.exit(1)
} finally {
  server.kill()
}
