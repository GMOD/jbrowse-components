import http from 'http'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import puppeteer, { type Browser, type Page, type ElementHandle } from 'puppeteer'
import handler from 'serve-handler'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

interface TestResult {
  name: string
  passed: boolean
  error?: string
  duration: number
}

interface TestSuite {
  name: string
  tests: { name: string; fn: (page: Page) => Promise<void> }[]
}

const args = process.argv.slice(2)
const headed = args.includes('--headed')
const slowMoArg = args.find(a => a.startsWith('--slow-mo='))
const slowMo = slowMoArg ? parseInt(slowMoArg.split('=')[1]!, 10) : 0
const updateSnapshots = args.includes('--update-snapshots') || args.includes('-u')

const snapshotsDir = path.resolve(__dirname, '__snapshots__')
const buildPath = path.resolve(__dirname, '../build')
const PORT = 3333

// Helper functions
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

function startServer(port: number): Promise<http.Server> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = req.url || '/'
      const publicPath = url.startsWith('/test_data/') ? path.resolve(__dirname, '..') : buildPath
      return handler(req, res, {
        public: publicPath,
        headers: [{ source: '**/*', headers: [{ key: 'Access-Control-Allow-Origin', value: '*' }] }],
      })
    })
    server.on('error', reject)
    server.listen(port, () => resolve(server))
  })
}

async function findByTestId(page: Page, testId: string, timeout = 30000) {
  const el = await page.waitForSelector(`[data-testid="${testId}"]`, { timeout, visible: true })
  if (!el) throw new Error(`Element not found: ${testId}`)
  return el
}

async function findByText(page: Page, text: string | RegExp, { timeout = 30000, exact = false } = {}): Promise<ElementHandle> {
  const start = Date.now()

  while (Date.now() - start < timeout) {
    const elements = await page.$$('body *:not(script):not(style)')

    for (const element of elements) {
      const result = await element.evaluate((el, searchText, exactMatch) => {
        const getTextContent = () => {
          if (el.children.length > 0) {
            const directText = Array.from(el.childNodes)
              .filter(node => node.nodeType === Node.TEXT_NODE)
              .map(node => node.textContent)
              .join('')
              .trim()
            if (directText) return directText
          }
          return el.textContent?.trim() || ''
        }

        const textContent = getTextContent()
        if (!textContent) return false

        const style = window.getComputedStyle(el)
        const isVisible = style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0'
        if (!isVisible) return false

        if (typeof searchText === 'string') {
          return exactMatch ? textContent === searchText : textContent.includes(searchText)
        }
        return new RegExp(searchText).test(textContent)
      }, typeof text === 'string' ? text : text.source, exact)

      if (result) return element
    }
    await delay(100)
  }

  throw new Error(`Could not find element with text: ${text}`)
}

async function capturePageSnapshot(page: Page, name: string) {
  if (!fs.existsSync(snapshotsDir)) {
    fs.mkdirSync(snapshotsDir, { recursive: true })
  }

  const currentBuffer = await page.screenshot({ fullPage: true })
  const snapshotPath = path.join(snapshotsDir, `${name}.png`)

  if (updateSnapshots || !fs.existsSync(snapshotPath)) {
    fs.writeFileSync(snapshotPath, currentBuffer)
    return { passed: true, message: updateSnapshots ? 'Snapshot updated' : 'Snapshot created' }
  }

  const expectedBuffer = fs.readFileSync(snapshotPath)
  if (currentBuffer.equals(expectedBuffer)) {
    return { passed: true, message: 'Snapshot matches' }
  }

  fs.writeFileSync(path.join(snapshotsDir, `${name}.diff.png`), currentBuffer)
  return { passed: false, message: 'Snapshot differs' }
}

// Navigate to app with config
async function navigateToApp(page: Page, baseUrl: string) {
  await page.goto(`${baseUrl}/?config=test_data/volvox/config.json`, {
    waitUntil: 'networkidle0',
    timeout: 60000,
  })
  await findByText(page, 'ctgA', { timeout: 30000 })
}

// Click a track in the track selector
async function openTrack(page: Page, trackId: string) {
  const trackLabel = await findByTestId(page, `htsTrackLabel-Tracks,${trackId}`, 10000)
  await trackLabel.click()
}

// Test definitions
function defineTests(baseUrl: string): TestSuite[] {
  return [
    {
      name: 'BasicLinearGenomeView',
      tests: [
        {
          name: 'loads the application',
          fn: async (page) => {
            await navigateToApp(page, baseUrl)
            await findByText(page, 'Help', { timeout: 10000 })
          },
        },
        {
          name: 'opens track selector and loads a track',
          fn: async (page) => {
            await navigateToApp(page, baseUrl)
            await openTrack(page, 'volvox_refseq')
            await findByTestId(page, 'display-volvox_refseq-LinearReferenceSequenceDisplay', 30000)
          },
        },
        {
          name: 'can zoom in and out',
          fn: async (page) => {
            await navigateToApp(page, baseUrl)
            const zoomIn = await findByTestId(page, 'zoom_in', 10000)
            await zoomIn.click()
            await delay(500)
            const zoomOut = await findByTestId(page, 'zoom_out', 10000)
            await zoomOut.click()
          },
        },
        {
          name: 'can access About dialog',
          fn: async (page) => {
            await navigateToApp(page, baseUrl)
            const helpButton = await findByText(page, 'Help', { timeout: 10000, exact: true })
            await helpButton.click()
            await delay(300)
            const aboutMenuItem = await findByText(page, 'About', { timeout: 10000, exact: true })
            await aboutMenuItem.click()
            await findByText(page, /The Evolutionary Software Foundation/i, { timeout: 10000 })
          },
        },
        {
          name: 'can search for a location',
          fn: async (page) => {
            await navigateToApp(page, baseUrl)
            const searchInput = await page.waitForSelector('input[placeholder="Search for location"]', { timeout: 30000 })
            if (!searchInput) throw new Error('Search input not found')
            await searchInput.click()
            await searchInput.type('ctgA:1000..2000')
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
          fn: async (page) => {
            await navigateToApp(page, baseUrl)
            await openTrack(page, 'volvox_alignments')
            await findByTestId(page, 'Blockset-pileup', 60000)
          },
        },
        {
          name: 'loads CRAM track',
          fn: async (page) => {
            await navigateToApp(page, baseUrl)
            await openTrack(page, 'volvox_cram_alignments')
            await findByTestId(page, 'Blockset-pileup', 60000)
          },
        },
        {
          name: 'BAM track screenshot',
          fn: async (page) => {
            await navigateToApp(page, baseUrl)
            await openTrack(page, 'volvox_alignments')
            await findByTestId(page, 'Blockset-pileup', 60000)
            await delay(2000)
            const result = await capturePageSnapshot(page, 'alignments-bam')
            if (!result.passed) throw new Error(result.message)
          },
        },
      ],
    },
  ]
}

async function runTests(suites: TestSuite[], page: Page): Promise<TestResult[]> {
  const results: TestResult[] = []

  for (const suite of suites) {
    console.log(`\n  ${suite.name}`)

    for (const test of suite.tests) {
      const start = performance.now()
      process.stdout.write(`    ⏳ ${test.name}...`)

      try {
        await page.goto('about:blank')
        await test.fn(page)

        const duration = performance.now() - start
        results.push({ name: test.name, passed: true, duration })

        process.stdout.clearLine(0)
        process.stdout.cursorTo(0)
        console.log(`    ✓ ${test.name} (${Math.round(duration)}ms)`)
      } catch (e) {
        const duration = performance.now() - start
        const error = e instanceof Error ? e.message : String(e)
        results.push({ name: test.name, passed: false, error, duration })

        process.stdout.clearLine(0)
        process.stdout.cursorTo(0)
        console.log(`    ✗ ${test.name}`)
        console.log(`      Error: ${error}`)
      }
    }
  }

  return results
}

async function main() {
  if (!fs.existsSync(buildPath)) {
    console.error('Error: Build directory not found. Run `yarn build` in products/jbrowse-web first.')
    process.exit(1)
  }

  console.log('Starting test server...')
  const server = await startServer(PORT)

  let browser: Browser | undefined

  try {
    console.log(`Launching browser (headed: ${headed})...`)
    browser = await puppeteer.launch({
      headless: !headed,
      slowMo,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security'],
      defaultViewport: { width: 1280, height: 800 },
    })

    const page = await browser.newPage()
    page.on('console', msg => {
      if (msg.type() === 'error' && !msg.text().includes('favicon')) {
        console.error('  Browser:', msg.text())
      }
    })

    const suites = defineTests(`http://localhost:${PORT}`)
    console.log('\nRunning browser tests...')
    const results = await runTests(suites, page)

    const passed = results.filter(r => r.passed).length
    const failed = results.filter(r => !r.passed).length

    console.log('\n' + '─'.repeat(50))
    console.log(`  Tests: ${passed} passed, ${failed} failed`)
    console.log('─'.repeat(50) + '\n')

    process.exit(failed > 0 ? 1 : 0)
  } catch (e) {
    console.error('Fatal error:', e)
    process.exit(1)
  } finally {
    await browser?.close()
    server.close()
  }
}

main()
