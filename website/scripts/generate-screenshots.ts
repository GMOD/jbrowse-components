/* eslint-disable no-console */
import fs from 'fs'
import http from 'http'
import path from 'path'
import { fileURLToPath } from 'url'

import { launch } from 'puppeteer'
import handler from 'serve-handler'

import { specs } from './screenshot-specs.ts'
import type { ScreenshotAction, ScreenshotSpec } from './screenshot-specs.ts'
import type { Page } from 'puppeteer'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const cliArgs = process.argv.slice(2)
const headed = cliArgs.includes('--headed')
const filterArg = cliArgs.find(a => a.startsWith('--filter='))
const filter = filterArg?.split('=')[1]
const portArg = cliArgs.find(a => a.startsWith('--port='))
const externalPort = portArg ? parseInt(portArg.split('=')[1]!, 10) : undefined
const DEFAULT_PORT = 3334

const repoRoot = path.resolve(__dirname, '..', '..')
const buildPath = path.resolve(repoRoot, 'products', 'jbrowse-web', 'build')
const testDataRoot = path.resolve(repoRoot, 'products', 'jbrowse-web')
const outDir = path.resolve(__dirname, '..', 'static', 'img')
const VOLVOX_CONFIG = 'test_data/volvox/config.json'
const DEFAULT_SETTLE_MS = 2500

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

function proxyToPort(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  targetPort: number,
) {
  const options: http.RequestOptions = {
    hostname: 'localhost',
    port: targetPort,
    path: req.url ?? '/',
    method: req.method,
    headers: req.headers,
  }
  const proxyReq = http.request(options, proxyRes => {
    res.writeHead(proxyRes.statusCode ?? 200, proxyRes.headers)
    proxyRes.pipe(res, { end: true })
  })
  proxyReq.on('error', err => {
    console.error(`    proxy error: ${err.message}`)
    res.writeHead(502)
    res.end('Bad Gateway')
  })
  req.pipe(proxyReq, { end: true })
}

function startServer(port: number, proxyPort?: number): Promise<http.Server> {
  const corsHeaders = [
    { source: '**/*', headers: [{ key: 'Access-Control-Allow-Origin', value: '*' }] },
  ]
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = req.url ?? '/'
      if (url.startsWith('/test_data/')) {
        return handler(req, res, { public: testDataRoot, headers: corsHeaders })
      } else if (url.startsWith('/extra_test_data/')) {
        return handler(req, res, { public: repoRoot, headers: corsHeaders })
      } else if (proxyPort !== undefined) {
        proxyToPort(req, res, proxyPort)
      } else {
        return handler(req, res, { public: buildPath, headers: corsHeaders })
      }
    })
    server.on('error', reject)
    server.listen(port, () => resolve(server))
  })
}

async function waitForLoadingComplete(page: Page, timeout = 30000) {
  await page.waitForFunction(
    () =>
      document.querySelectorAll('[data-testid="loading-overlay"]').length === 0,
    { timeout },
  )
}

async function runAction(page: Page, action: ScreenshotAction) {
  if (action.type === 'delay') {
    await delay(action.ms ?? 500)
  } else if (action.type === 'click' && action.selector) {
    await page.click(action.selector)
  } else if (action.type === 'waitForText' && action.text) {
    await page.waitForSelector(`::-p-text(${action.text})`, {
      visible: true,
      timeout: 30000,
    })
  }
}

async function setLocation(page: Page, loc: string) {
  const locBox = await page.waitForSelector(
    'input[placeholder="Search for location"]',
    { visible: true, timeout: 15000 },
  )
  await locBox?.click({ clickCount: 3 })
  await locBox?.type(loc)
  await page.keyboard.press('Enter')
  await delay(300)
}

async function scrollTrackListUntilVisible(page: Page, trackId: string) {
  const selector = `[data-testid="htsTrackLabel-Tracks,${trackId}"]`
  // The track list is virtualized, so scroll its container until the item renders
  for (let step = 0; step < 30; step++) {
    const found = await page.$(selector)
    if (found) {
      return found
    }
    await page.evaluate((s: number) => {
      // Find the scrollable track list container (overflowY:auto with scrollable content)
      const containers = Array.from(document.querySelectorAll<HTMLElement>('*'))
      const scrollable = containers.find(
        el =>
          window.getComputedStyle(el).overflowY === 'auto' &&
          el.scrollHeight > el.clientHeight + 10,
      )
      if (scrollable) {
        scrollable.scrollTop = s * 150
      }
    }, step)
    await delay(100)
  }
  return null
}

async function openTrack(page: Page, trackId: string) {
  const selector = `[data-testid="htsTrackLabel-Tracks,${trackId}"]`
  // First check if it's already in the DOM
  const quick = await page.$(selector)
  if (!quick) {
    await scrollTrackListUntilVisible(page, trackId)
  }
  const label = await page.waitForSelector(selector, { timeout: 5000 })
  await label?.click()
}

async function captureLGV(
  page: Page,
  spec: ScreenshotSpec & { mode?: 'lgv' },
  port: number,
) {
  const config = spec.config ?? VOLVOX_CONFIG
  await page.goto(
    `http://localhost:${port}/?config=${config}&sessionName=Screenshot`,
    { waitUntil: 'networkidle0', timeout: 60000 },
  )

  // Wait for the view to be fully initialized (ctgA appears in the default volvox session)
  await page.waitForSelector('::-p-text(ctgA)', {
    visible: true,
    timeout: 30000,
  })
  await waitForLoadingComplete(page)

  if (spec.loc) {
    await setLocation(page, spec.loc)
    await delay(500)
  }

  for (const trackId of spec.openTracks ?? []) {
    await openTrack(page, trackId)
    await delay(300)
  }

  await delay(spec.settleMs ?? DEFAULT_SETTLE_MS)
}

async function debugDump(page: Page, name: string) {
  const bodyText = await page
    .evaluate(() => document.body?.innerText?.substring(0, 800))
    .catch(() => 'eval failed')
  console.error(
    `    debug text: ${(bodyText ?? '').replace(/\s+/g, ' ').trim()}`,
  )
  const debugPath = path.join(
    outDir,
    `debug_${name.replace(/\//g, '_')}.png`,
  )
  await page
    .screenshot()
    .then(png => fs.writeFileSync(debugPath, png))
    .catch(() => {})
  console.error(`    debug screenshot: ${debugPath}`)
}

async function captureUrl(
  page: Page,
  spec: ScreenshotSpec & { mode: 'url' },
  port: number,
) {
  const fullUrl = spec.url.startsWith('http')
    ? spec.url
    : `http://localhost:${port}/${spec.url}`
  await page.goto(fullUrl, {
    waitUntil:
      spec.waitUntil ?? (spec.url.startsWith('http') ? 'domcontentloaded' : 'networkidle0'),
    timeout: 60000,
  })

  const readyTimeout = spec.readyTimeout ?? 30000
  if (spec.readyText) {
    await page
      .waitForSelector(`::-p-text(${spec.readyText})`, {
        visible: true,
        timeout: readyTimeout,
      })
      .catch(async e => {
        await debugDump(page, spec.name)
        throw e
      })
  }
  if (spec.readySelector) {
    await page
      .waitForSelector(spec.readySelector, {
        visible: true,
        timeout: readyTimeout,
      })
      .catch(async e => {
        await debugDump(page, spec.name)
        throw e
      })
  }

  await waitForLoadingComplete(page)
  await delay(spec.settleMs ?? DEFAULT_SETTLE_MS)
}

async function captureSpec(page: Page, spec: ScreenshotSpec, port: number) {
  console.log(`  → ${spec.name}`)

  if (spec.mode === 'url') {
    await captureUrl(page, spec, port)
  } else {
    await captureLGV(page, spec, port)
  }

  for (const action of spec.actions ?? []) {
    await runAction(page, action)
  }

  const screenshotOptions =
    spec.crop !== undefined
      ? {
          clip: {
            x: spec.crop.x,
            y: spec.crop.y,
            width: spec.crop.width,
            height: spec.crop.height,
          },
        }
      : {}

  const png = await page.screenshot(screenshotOptions)
  const outputPath = path.join(outDir, `${spec.name}.png`)
  const outputDir = path.dirname(outputPath)
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }
  fs.writeFileSync(outputPath, png)
  console.log(`  ✓ ${spec.name}.png`)
}

async function main() {
  const filteredSpecs = filter
    ? specs.filter(s => s.name.includes(filter))
    : specs

  if (filteredSpecs.length === 0) {
    console.error(`No specs match filter: ${filter}`)
    process.exit(1)
  }

  console.log(
    `Generating ${filteredSpecs.length} screenshot(s)${filter ? ` (filter: ${filter})` : ''}`,
  )

  const needsLocalServer = filteredSpecs.some(
    s => s.mode !== 'url' || !s.url.startsWith('http'),
  )

  let server: http.Server | undefined
  const port = DEFAULT_PORT

  if (needsLocalServer) {
    if (!externalPort && !fs.existsSync(buildPath)) {
      console.error(
        `Build not found at ${buildPath}. Run "pnpm build" in products/jbrowse-web first, or pass --port=N to use an existing server.`,
      )
      process.exit(1)
    }
    server = await startServer(port, externalPort)
    console.log(
      externalPort
        ? `Proxy on port ${port}, app on port ${externalPort}`
        : `Server on port ${port}`,
    )
  }

  const chromePaths = [
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
  ]
  const executablePath = chromePaths.find(p => fs.existsSync(p))

  const launchOptions = {
    headless: !headed,
    executablePath,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security',
    ],
    defaultViewport: { width: 1280, height: 800, deviceScaleFactor: 2 },
  }

  let passed = 0
  let failed = 0
  const failures: string[] = []

  try {
    for (const spec of filteredSpecs) {
      // Fresh browser per spec to avoid service worker caching between navigations
      const browser = await launch(launchOptions)
      try {
        const page = await browser.newPage()
        page.on('console', msg => {
          const t = msg.type()
          if ((t === 'error' || t === 'warning') && !msg.text().includes('favicon')) {
            console.error(`    browser[${t}]: ${msg.text().substring(0, 200)}`)
          }
        })
        await captureSpec(page, spec, port)
        passed++
      } catch (err) {
        console.error(`  ✗ ${spec.name}: ${err}`)
        failed++
        failures.push(spec.name)
      } finally {
        await browser.close()
      }
    }
  } finally {
    server?.close()
  }

  console.log(`\n${passed} succeeded, ${failed} failed`)
  if (failures.length > 0) {
    console.error('Failed:', failures.join(', '))
    process.exit(1)
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
