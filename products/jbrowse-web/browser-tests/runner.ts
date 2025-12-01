/* eslint-disable no-console */
import fs from 'fs'
import http from 'http'
import path from 'path'
import { fileURLToPath } from 'url'

import pixelmatch from 'pixelmatch'
import { PNG } from 'pngjs'
import { type Page, launch } from 'puppeteer'
import handler from 'serve-handler'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

interface TestSuite {
  name: string
  tests: { name: string; fn: (page: Page) => Promise<void> }[]
}

const args = process.argv.slice(2)
const headed = args.includes('--headed')
const slowMoArg = args.find(a => a.startsWith('--slow-mo='))
const slowMo = slowMoArg ? parseInt(slowMoArg.split('=')[1]!, 10) : 0
const updateSnapshots =
  args.includes('--update-snapshots') || args.includes('-u')

const snapshotsDir = path.resolve(__dirname, '__snapshots__')
const buildPath = path.resolve(__dirname, '../build')
const PORT = 3333

// Helper functions
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

function startServer(port: number): Promise<http.Server> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = req.url || '/'
      const publicPath = url.startsWith('/test_data/')
        ? path.resolve(__dirname, '..')
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
    server.listen(port, () => {
      resolve(server)
    })
  })
}

async function findByTestId(page: Page, testId: string, timeout = 30000) {
  return page.waitForSelector(`[data-testid="${testId}"]`, {
    timeout,
    visible: true,
  })
}

async function findByText(page: Page, text: string | RegExp, timeout = 30000) {
  const searchText = typeof text === 'string' ? text : text.source
  return page.waitForSelector(`::-p-text(${searchText})`, {
    timeout,
    visible: true,
  })
}

const FAILURE_THRESHOLD = 0.01
const FAILURE_THRESHOLD_TYPE = 'percent'

async function capturePageSnapshot(page: Page, name: string) {
  if (!fs.existsSync(snapshotsDir)) {
    fs.mkdirSync(snapshotsDir, { recursive: true })
  }

  const screenshot = await page.screenshot({ fullPage: true })
  const snapshotPath = path.join(snapshotsDir, `${name}.png`)

  if (updateSnapshots || !fs.existsSync(snapshotPath)) {
    fs.writeFileSync(snapshotPath, screenshot)
    return {
      passed: true,
      message: updateSnapshots ? 'Snapshot updated' : 'Snapshot created',
    }
  }

  const expectedBuffer = fs.readFileSync(snapshotPath)
  const expectedImg = PNG.sync.read(expectedBuffer)
  // @ts-expect-error Uint8Array works at runtime
  const actualImg = PNG.sync.read(screenshot)

  if (
    expectedImg.width !== actualImg.width ||
    expectedImg.height !== actualImg.height
  ) {
    fs.writeFileSync(path.join(snapshotsDir, `${name}.diff.png`), screenshot)
    return {
      passed: false,
      message: `Snapshot size differs: expected ${expectedImg.width}x${expectedImg.height}, got ${actualImg.width}x${actualImg.height}`,
    }
  }

  const { width, height } = expectedImg
  const diffImg = new PNG({ width, height })

  const numDiffPixels = pixelmatch(
    expectedImg.data,
    actualImg.data,
    diffImg.data,
    width,
    height,
    { threshold: 0.1 },
  )

  const totalPixels = width * height
  const diffPercent = numDiffPixels / totalPixels
  const threshold =
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    FAILURE_THRESHOLD_TYPE === 'percent'
      ? FAILURE_THRESHOLD
      : FAILURE_THRESHOLD / totalPixels

  if (diffPercent <= threshold) {
    return { passed: true, message: 'Snapshot matches' }
  }

  fs.writeFileSync(path.join(snapshotsDir, `${name}.diff.png`), screenshot)
  fs.writeFileSync(
    path.join(snapshotsDir, `${name}.diff-visual.png`),
    PNG.sync.write(diffImg),
  )
  return {
    passed: false,
    message: `Snapshot differs by ${(diffPercent * 100).toFixed(2)}% (threshold: ${FAILURE_THRESHOLD * 100}%)`,
  }
}

async function navigateToApp(page: Page) {
  await page.goto(
    `http://localhost:${PORT}/?config=test_data/volvox/config.json`,
    {
      waitUntil: 'networkidle0',
      timeout: 60000,
    },
  )
  await findByText(page, 'ctgA')
}

async function openTrack(page: Page, trackId: string) {
  const trackLabel = await findByTestId(
    page,
    `htsTrackLabel-Tracks,${trackId}`,
    10000,
  )
  await trackLabel?.click()
}

const testSuites: TestSuite[] = [
  {
    name: 'BasicLinearGenomeView',
    tests: [
      {
        name: 'loads the application',
        fn: async page => {
          await navigateToApp(page)
          await findByText(page, 'Help', 10000)
        },
      },
      {
        name: 'opens track selector and loads a track',
        fn: async page => {
          await navigateToApp(page)
          await openTrack(page, 'volvox_refseq')
          await findByTestId(
            page,
            'display-volvox_refseq-LinearReferenceSequenceDisplay',
          )
        },
      },
      {
        name: 'can zoom in and out',
        fn: async page => {
          await navigateToApp(page)
          const zoomIn = await findByTestId(page, 'zoom_in', 10000)
          await zoomIn?.click()
          await delay(500)
          const zoomOut = await findByTestId(page, 'zoom_out', 10000)
          await zoomOut?.click()
        },
      },
      {
        name: 'can access About dialog',
        fn: async page => {
          await navigateToApp(page)
          const helpButton = await findByText(page, 'Help', 10000)
          await helpButton?.click()
          await delay(300)
          const aboutMenuItem = await findByText(page, 'About', 10000)
          await aboutMenuItem?.click()
          await findByText(page, /The Evolutionary Software Foundation/i, 10000)
        },
      },
      {
        name: 'can search for a location',
        fn: async page => {
          await navigateToApp(page)
          const searchInput = await page.waitForSelector(
            'input[placeholder="Search for location"]',
            { timeout: 30000 },
          )
          await searchInput?.click()
          await searchInput?.type('ctgA:1000..2000')
          await page.keyboard.press('Enter')
          await delay(1000)
        },
      },
    ],
  },
  {
    name: 'Alignments Track',
    tests: [
      {
        name: 'loads BAM track',
        fn: async page => {
          await navigateToApp(page)
          await openTrack(page, 'volvox_alignments')
          await findByTestId(page, 'Blockset-pileup', 60000)
        },
      },
      {
        name: 'loads CRAM track',
        fn: async page => {
          await navigateToApp(page)
          await openTrack(page, 'volvox_cram_alignments')
          await findByTestId(page, 'Blockset-pileup', 60000)
        },
      },
      {
        name: 'BAM track screenshot',
        fn: async page => {
          await navigateToApp(page)
          await openTrack(page, 'volvox_alignments')
          await findByTestId(page, 'Blockset-pileup', 60000)
          await delay(2000)
          const result = await capturePageSnapshot(page, 'alignments-bam')
          if (!result.passed) {
            throw new Error(result.message)
          }
        },
      },
    ],
  },
]

async function runTests(page: Page) {
  let passed = 0
  let failed = 0

  for (const suite of testSuites) {
    console.log(`\n  ${suite.name}`)

    for (const test of suite.tests) {
      const start = performance.now()
      process.stdout.write(`    ⏳ ${test.name}...`)

      try {
        await page.goto('about:blank')
        await test.fn(page)

        const duration = performance.now() - start
        passed++

        if (process.stdout.isTTY) {
          process.stdout.clearLine(0)
          process.stdout.cursorTo(0)
        }
        console.log(`    ✓ ${test.name} (${Math.round(duration)}ms)`)
      } catch (e) {
        failed++
        const error = e instanceof Error ? e.message : String(e)

        if (process.stdout.isTTY) {
          process.stdout.clearLine(0)
          process.stdout.cursorTo(0)
        }
        console.log(`    ✗ ${test.name}`)
        console.log(`      Error: ${error}`)
      }
    }
  }

  return { passed, failed }
}

async function main() {
  if (!fs.existsSync(buildPath)) {
    console.error(
      'Error: Build directory not found. Run `yarn build` in products/jbrowse-web first.',
    )
    process.exit(1)
  }

  console.log('Starting test server...')
  const server = await startServer(PORT)

  let browser: Awaited<ReturnType<typeof launch>> | undefined

  try {
    console.log(`Launching browser (headed: ${headed})...`)
    browser = await launch({
      headless: !headed,
      slowMo,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-web-security',
      ],
      defaultViewport: { width: 1280, height: 800 },
    })

    const page = await browser.newPage()
    page.on('console', msg => {
      if (msg.type() === 'error' && !msg.text().includes('favicon')) {
        console.error('  Browser:', msg.text())
      }
    })

    console.log('\nRunning browser tests...')
    const { passed, failed } = await runTests(page)

    console.log(`\n${'─'.repeat(50)}`)
    console.log(`  Tests: ${passed} passed, ${failed} failed`)
    console.log(`${'─'.repeat(50)}\n`)

    process.exit(failed > 0 ? 1 : 0)
  } catch (e) {
    console.error('Fatal error:', e)
    process.exit(1)
  } finally {
    await browser?.close()
    server.close()
  }
}

main().catch((e: unknown) => {
  console.error('Unhandled error:', e)
  process.exit(1)
})
