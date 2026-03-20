import { launch } from 'puppeteer'

import { startServer } from './browser-tests/server.ts'

const server = await startServer(3334)
const browser = await launch({
  browser: 'firefox',
  executablePath: '/usr/bin/firefox-nightly',
  headless: false,
  timeout: 60000,
  extraPrefsFirefox: {
    'dom.webgpu.enabled': true,
    'gfx.webrender.all': true,
    'gfx.webgpu.ignore-blocklist': true,
  },
  defaultViewport: { width: 1280, height: 800 },
})

const page = await browser.newPage()
const t0 = performance.now()
const ts = l => {
  console.log(`[+${((performance.now() - t0) / 1000).toFixed(1)}s] ${l}`)
}

page.on('console', msg => {
  const text = msg.text()
  if (
    text.includes('Feature') ||
    text.includes('GPU') ||
    text.includes('drawn') ||
    text.includes('Device') ||
    text.includes('init') ||
    text.includes('error') ||
    text.includes('Error') ||
    text.includes('fallback')
  ) {
    ts(`  Browser: ${text}`)
  }
})

const spec = JSON.stringify({
  views: [
    {
      type: 'LinearGenomeView',
      assembly: 'volvox',
      loc: 'ctgA:907..15319',
      tracks: ['bed_genes'],
    },
  ],
})
const url = `http://localhost:3334/?config=test_data/volvox/config.json&session=spec-${encodeURIComponent(
  spec,
)}&gpu=webgpu`

ts(`navigating to: ${url.slice(0, 80)}...`)
await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 })
ts('networkidle0')

// Check for display element
const displayExists = await page.evaluate(() => {
  return {
    displays: document.querySelectorAll('[data-testid^="display-"]').length,
    canvases: document.querySelectorAll('[data-testid^="display-"] canvas')
      .length,
    drawnElements: Array.from(
      document.querySelectorAll('[data-testid^="drawn-"]'),
    ).map(e => e.dataset.testid),
  }
})
ts(`DOM state: ${JSON.stringify(displayExists)}`)

// Wait for canvas
try {
  await page.waitForSelector('[data-testid^="display-"] canvas', {
    timeout: 15000,
  })
  ts('canvas found')
} catch {
  ts('canvas NOT found after 15s')
}

// Wait for drawn-true
try {
  await page.waitForFunction(
    () => {
      const el = document.querySelector('[data-testid^="drawn-"]')
      return el?.dataset.testid === 'drawn-true'
    },
    { timeout: 15000, polling: 200 },
  )
  ts('drawn-true')
} catch {
  const state = await page.evaluate(() => {
    const el = document.querySelector('[data-testid^="drawn-"]')
    return el ? el.dataset.testid : 'no drawn element found'
  })
  ts(`drawn-true NOT reached. Current: ${state}`)
}

// Check canvas content
const check = await page.evaluate(() => {
  const c = document.querySelector('[data-testid^="display-"] canvas')
  if (!c) {
    return 'no canvas'
  }
  try {
    const ctx = c.getContext('2d')
    if (!ctx) {
      return `getContext(2d) returned null - canvas is ${
        c.getContext('webgpu') ? 'webgpu' : 'unknown'
      }`
    }
    const d = ctx.getImageData(0, 0, c.width, c.height).data
    let nonBlank = 0
    for (let i = 3; i < d.length; i += 4) {
      if (d[i] > 0) {
        nonBlank++
      }
    }
    return `pixels: ${nonBlank}/${c.width * c.height} (${(
      (nonBlank / (c.width * c.height)) *
      100
    ).toFixed(1)}% filled)`
  } catch (e) {
    return `error: ${e.message}`
  }
})
ts(`canvas check: ${check}`)

// Wait 5 more seconds and recheck
await new Promise(r => setTimeout(r, 5000))
const check2 = await page.evaluate(() => {
  const c = document.querySelector('[data-testid^="display-"] canvas')
  if (!c) {
    return 'no canvas'
  }
  try {
    const ctx = c.getContext('2d')
    if (!ctx) {
      return 'no 2d context'
    }
    const d = ctx.getImageData(0, 0, c.width, c.height).data
    let nonBlank = 0
    for (let i = 3; i < d.length; i += 4) {
      if (d[i] > 0) {
        nonBlank++
      }
    }
    return `pixels: ${nonBlank}/${c.width * c.height} (${(
      (nonBlank / (c.width * c.height)) *
      100
    ).toFixed(1)}% filled)`
  } catch (e) {
    return `error: ${e.message}`
  }
})
ts(`canvas check +5s: ${check2}`)

await page.close()
await browser.close()
server.close()
process.exit(0)
