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
const outDir = path.resolve(__dirname, '..', 'docs', 'img')
const VOLVOX_CONFIG = 'test_data/volvox/config.json'
const DEFAULT_SETTLE_MS = 2500

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

function startServer(port: number): Promise<http.Server> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = req.url ?? '/'
      const publicPath = url.startsWith('/test_data/')
        ? testDataRoot
        : buildPath
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

async function openTrack(page: Page, trackId: string) {
  const label = await page.waitForSelector(
    `[data-testid="htsTrackLabel-Tracks,${trackId}"]`,
    { visible: true, timeout: 15000 },
  )
  await label?.click()
}

async function captureLGV(page: Page, spec: ScreenshotSpec & { mode?: 'lgv' }, port: number) {
  const config = spec.config ?? VOLVOX_CONFIG
  await page.goto(
    `http://localhost:${port}/?config=${config}&sessionName=Screenshot`,
    { waitUntil: 'networkidle0', timeout: 60000 },
  )

  // Wait for the view to be fully initialized (ctgA appears in the default volvox session)
  await page.waitForSelector('::-p-text(ctgA)', { visible: true, timeout: 30000 })
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

async function captureUrl(page: Page, spec: ScreenshotSpec & { mode: 'url' }, port: number) {
  await page.goto(`http://localhost:${port}/${spec.url}`, {
    waitUntil: 'networkidle0',
    timeout: 60000,
  })

  if (spec.readyText) {
    await page.waitForSelector(`::-p-text(${spec.readyText})`, {
      visible: true,
      timeout: 30000,
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
            scale: 1,
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

  let server: http.Server | undefined
  const port = externalPort ?? DEFAULT_PORT

  if (!externalPort) {
    if (!fs.existsSync(buildPath)) {
      console.error(
        `Build not found at ${buildPath}. Run "pnpm build" in products/jbrowse-web first, or pass --port=N to use an existing server.`,
      )
      process.exit(1)
    }
    server = await startServer(port)
    console.log(`Server on port ${port}`)
  } else {
    console.log(`Using server on port ${port}`)
  }

  const chromePaths = [
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
  ]
  const executablePath = chromePaths.find(p => fs.existsSync(p))

  const browser = await launch({
    headless: !headed,
    executablePath,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security',
    ],
    defaultViewport: { width: 1280, height: 800, deviceScaleFactor: 2 },
  })

  let passed = 0
  let failed = 0
  const failures: string[] = []

  try {
    const page = await browser.newPage()
    page.on('console', msg => {
      if (msg.type() === 'error' && !msg.text().includes('favicon')) {
        console.error(`    browser: ${msg.text().substring(0, 120)}`)
      }
    })

    for (const spec of filteredSpecs) {
      try {
        await captureSpec(page, spec, port)
        passed++
      } catch (err) {
        console.error(`  ✗ ${spec.name}: ${err}`)
        failed++
        failures.push(spec.name)
      }
    }
  } finally {
    await browser.close()
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
