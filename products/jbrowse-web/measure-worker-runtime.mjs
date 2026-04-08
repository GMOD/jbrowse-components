import { spawn } from 'child_process'
import puppeteer from 'puppeteer'
import fs from 'fs'

const PORT = 9555
const server = spawn('npx', ['serve', 'build', '-l', String(PORT), '--no-clipboard'], {
  stdio: ['ignore', 'pipe', 'pipe'],
})

// Wait for server
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
    devtools: false,
  })
  const page = await browser.newPage()

  const jsFiles = new Map() // filename -> size

  // Intercept all responses
  await page.on('response', response => {
    const url = response.url()
    if (url.includes('/static/js/') && url.endsWith('.js')) {
      const filename = url.split('/').pop()
      // Don't re-measure source maps
      if (!filename.includes('.map')) {
        jsFiles.set(filename, response.headers()['content-length'] || 0)
      }
    }
  })

  console.log('Loading page...')
  const start = Date.now()
  await page.goto(`http://localhost:${PORT}/?config=test_data/volvox/config.json`, {
    waitUntil: 'networkidle0',
    timeout: 60000,
  })
  const pageLoadTime = Date.now() - start

  // Wait for worker to fully initialize
  await new Promise(r => setTimeout(r, 3000))

  let totalBytes = 0
  const files = []
  for (const [name, size] of jsFiles) {
    totalBytes += parseInt(size) || 0
    files.push({ name, size: parseInt(size) || 0 })
  }

  files.sort((a, b) => b.size - a.size)

  console.log(`\n=== Runtime JS Loading Measurement ===`)
  console.log(`Page load time: ${pageLoadTime}ms`)
  console.log(`Total JS loaded: ${(totalBytes / 1024).toFixed(1)} KB`)
  console.log(`Total files: ${jsFiles.size}`)
  console.log(`\nTop 20 largest files:`)
  for (const f of files.slice(0, 20)) {
    console.log(`  ${(f.size / 1024).toFixed(1).padStart(8)} KB  ${f.name}`)
  }

  await browser.close()
  process.exit(0)
} catch(e) {
  console.error(e)
  process.exit(1)
} finally {
  server.kill()
}
