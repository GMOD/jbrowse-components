/* eslint-disable no-console */
import fs from 'fs'
import http from 'http'
import path from 'path'
import { fileURLToPath } from 'url'

import { type Page, launch } from 'puppeteer'
import {
  type TestSuite,
  capturePageSnapshot,
  delay,
  findByTestId,
  findByText,
  parseArgs,
  runTests,
  waitForLoadingToComplete,
} from '../../../puppeteer-test-utils/src/index.ts'
import handler from 'serve-handler'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const args = process.argv.slice(2)
const { headed, slowMo, updateSnapshots } = parseArgs(args)

const snapshotsDir = path.resolve(__dirname, '__snapshots__')
const buildPath = path.resolve(__dirname, '../build')
const PORT = 3333

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

async function snapshot(page: Page, name: string) {
  const result = await capturePageSnapshot(page, name, {
    snapshotsDir,
    updateSnapshots,
  })
  if (!result.passed) {
    throw new Error(result.message)
  }
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
          await waitForLoadingToComplete(page)
          await snapshot(page, 'alignments-bam')
        },
      },
    ],
  },
]

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
    const { passed, failed } = await runTests(page, testSuites)

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
