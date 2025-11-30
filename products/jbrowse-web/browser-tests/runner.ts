import http from 'http'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import puppeteer, { type Browser, type Page } from 'puppeteer'
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
  tests: TestResult[]
}

const args = process.argv.slice(2)
const headed = args.includes('--headed')
const slowMoArg = args.find(a => a.startsWith('--slow-mo='))
const slowMo = slowMoArg ? parseInt(slowMoArg.split('=')[1]!, 10) : 0
const updateSnapshots = args.includes('--update-snapshots') || args.includes('-u')
const testFilter = args.find(a => !a.startsWith('--'))

const snapshotsDir = path.resolve(__dirname, '__snapshots__')

function startTestDataServer(port: number): Promise<http.Server> {
  return new Promise((resolve, reject) => {
    const testDataPath = path.resolve(__dirname, '../test_data')
    const buildPath = path.resolve(__dirname, '../build')

    const server = http.createServer((req, res) => {
      const url = req.url || '/'

      if (url.startsWith('/test_data/')) {
        return handler(req, res, {
          public: path.dirname(testDataPath),
          headers: [
            { source: '**/*', headers: [{ key: 'Access-Control-Allow-Origin', value: '*' }] },
          ],
        })
      }

      return handler(req, res, {
        public: buildPath,
        headers: [
          { source: '**/*', headers: [{ key: 'Access-Control-Allow-Origin', value: '*' }] },
        ],
      })
    })

    server.on('error', reject)
    server.listen(port, () => {
      console.log(`Test data server started on port ${port}`)
      resolve(server)
    })
  })
}

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function ensureSnapshotsDir() {
  if (!fs.existsSync(snapshotsDir)) {
    fs.mkdirSync(snapshotsDir, { recursive: true })
  }
}

async function capturePageSnapshot(
  page: Page,
  snapshotName: string,
): Promise<{ passed: boolean; message: string }> {
  ensureSnapshotsDir()

  const currentBuffer = await page.screenshot({ fullPage: true })

  const snapshotPath = path.join(snapshotsDir, `${snapshotName}.png`)

  if (updateSnapshots || !fs.existsSync(snapshotPath)) {
    fs.writeFileSync(snapshotPath, currentBuffer)
    return { passed: true, message: updateSnapshots ? 'Snapshot updated' : 'Snapshot created' }
  }

  const expectedBuffer = fs.readFileSync(snapshotPath)

  if (currentBuffer.equals(expectedBuffer)) {
    return { passed: true, message: 'Snapshot matches exactly' }
  }

  const diffPath = path.join(snapshotsDir, `${snapshotName}.diff.png`)
  fs.writeFileSync(diffPath, currentBuffer)

  return {
    passed: false,
    message: `Snapshot differs. Diff saved to ${diffPath}`,
  }
}

async function waitForSelector(page: Page, selector: string, options: { timeout?: number; visible?: boolean } = {}) {
  const { timeout = 30000 } = options
  return page.waitForSelector(selector, { timeout, visible: true })
}

async function findByTestId(page: Page, testId: string, options: { timeout?: number } = {}) {
  const selector = `[data-testid="${testId}"]`
  return waitForSelector(page, selector, options)
}

async function findByText(page: Page, text: string | RegExp, options: { timeout?: number; exact?: boolean } = {}) {
  const { timeout = 30000, exact = false } = options
  const start = Date.now()

  while (Date.now() - start < timeout) {
    const elements = await page.$$('body *:not(script):not(style)')

    for (const element of elements) {
      const textContent = await element.evaluate(el => {
        if (el.children.length > 0) {
          const directText = Array.from(el.childNodes)
            .filter(node => node.nodeType === Node.TEXT_NODE)
            .map(node => node.textContent)
            .join('')
            .trim()
          if (directText) return directText
        }
        return el.textContent?.trim() || ''
      })

      if (textContent) {
        if (typeof text === 'string') {
          if (exact ? textContent === text : textContent.includes(text)) {
            const isVisible = await element.evaluate(el => {
              const style = window.getComputedStyle(el)
              return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0'
            })
            if (isVisible) return element
          }
        } else if (text.test(textContent)) {
          const isVisible = await element.evaluate(el => {
            const style = window.getComputedStyle(el)
            return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0'
          })
          if (isVisible) return element
        }
      }
    }

    await delay(100)
  }

  throw new Error(`Could not find element with text: ${text}`)
}

async function clickByText(page: Page, text: string, options: { timeout?: number } = {}) {
  const element = await findByText(page, text, options)
  await element.click()
}

class TestRunner {
  private browser: Browser | null = null
  private page: Page | null = null
  private results: TestSuite[] = []
  private currentSuite: TestSuite | null = null

  async setup(browser: Browser) {
    this.browser = browser
    this.page = await browser.newPage()
    await this.page.setViewport({ width: 1280, height: 800 })

    this.page.on('console', msg => {
      const type = msg.type()
      if (type === 'error' && !msg.text().includes('favicon')) {
        console.error('  Browser:', msg.text())
      }
    })

    this.page.on('pageerror', err => {
      console.error('  Page error:', err.message)
    })
  }

  async teardown() {
    if (this.page) {
      await this.page.close()
    }
  }

  describe(name: string, fn: () => void) {
    this.currentSuite = { name, tests: [] }
    fn()
    this.results.push(this.currentSuite)
    this.currentSuite = null
  }

  test(name: string, fn: (page: Page) => Promise<void>) {
    if (!this.currentSuite) {
      this.currentSuite = { name: 'Default', tests: [] }
      this.results.push(this.currentSuite)
    }

    const suite = this.currentSuite
    const testDef = { name, fn }

    suite.tests.push({
      name,
      passed: false,
      duration: 0,
      // @ts-expect-error storing fn for later
      _testDef: testDef,
    })
  }

  async runAll() {
    for (const suite of this.results) {
      console.log(`\n  ${suite.name}`)

      for (const test of suite.tests) {
        // @ts-expect-error retrieving stored fn
        const { fn } = test._testDef as { fn: (page: Page) => Promise<void> }

        const start = performance.now()

        try {
          process.stdout.write(`    ⏳ ${test.name}...`)

          if (!this.page) {
            throw new Error('Page not initialized')
          }

          await this.page.goto('about:blank')
          await fn(this.page)

          test.passed = true
          test.duration = performance.now() - start

          process.stdout.clearLine(0)
          process.stdout.cursorTo(0)
          console.log(`    ✓ ${test.name} (${Math.round(test.duration)}ms)`)
        } catch (e) {
          test.passed = false
          test.duration = performance.now() - start
          test.error = e instanceof Error ? e.message : String(e)

          process.stdout.clearLine(0)
          process.stdout.cursorTo(0)
          console.log(`    ✗ ${test.name}`)
          console.log(`      Error: ${test.error}`)
        }
      }
    }

    return this.results
  }

  getResults() {
    return this.results
  }
}

function defineTests(runner: TestRunner, baseUrl: string) {
  runner.describe('BasicLinearGenomeView', () => {
    runner.test('loads the application', async (page) => {
      await page.goto(`${baseUrl}/?config=test_data/volvox/config.json`, {
        waitUntil: 'networkidle0',
        timeout: 60000,
      })

      await findByText(page, 'Help', { timeout: 30000 })
    })

    runner.test('opens track selector and loads a track', async (page) => {
      await page.goto(`${baseUrl}/?config=test_data/volvox/config.json`, {
        waitUntil: 'networkidle0',
        timeout: 60000,
      })

      await findByText(page, 'ctgA', { timeout: 30000 })

      // Use the reference sequence track which should always be visible
      const trackLabel = await findByTestId(page, 'htsTrackLabel-Tracks,volvox_refseq', { timeout: 10000 })
      await trackLabel.click()

      await findByTestId(page, 'display-volvox_refseq-LinearReferenceSequenceDisplay', { timeout: 30000 })
    })

    runner.test('can zoom in and out', async (page) => {
      await page.goto(`${baseUrl}/?config=test_data/volvox/config.json`, {
        waitUntil: 'networkidle0',
        timeout: 60000,
      })

      await findByText(page, 'ctgA', { timeout: 30000 })

      const zoomIn = await findByTestId(page, 'zoom_in', { timeout: 10000 })
      await zoomIn.click()
      await delay(500)

      const zoomOut = await findByTestId(page, 'zoom_out', { timeout: 10000 })
      await zoomOut.click()
      await delay(500)
    })

    runner.test('can access About dialog', async (page) => {
      await page.goto(`${baseUrl}/?config=test_data/volvox/config.json`, {
        waitUntil: 'networkidle0',
        timeout: 60000,
      })

      // Click the Help menu button - find button containing "Help" text
      const helpButton = await findByText(page, 'Help', { timeout: 10000, exact: true })
      await helpButton.click()

      await delay(500)

      // Click the About menu item from the dropdown
      const aboutMenuItem = await findByText(page, 'About', { timeout: 10000, exact: true })
      await aboutMenuItem.click()

      // Wait for the About widget/dialog to appear
      await findByText(page, /The Evolutionary Software Foundation/i, { timeout: 10000 })
    })

    runner.test('can search for a location', async (page) => {
      await page.goto(`${baseUrl}/?config=test_data/volvox/config.json`, {
        waitUntil: 'networkidle0',
        timeout: 60000,
      })

      const searchInput = await page.waitForSelector('input[placeholder="Search for location"]', {
        timeout: 30000,
      })

      if (!searchInput) {
        throw new Error('Search input not found')
      }

      await searchInput.click()
      await searchInput.type('ctgA:1000..2000')
      await page.keyboard.press('Enter')

      await delay(1000)
    })
  })

  runner.describe('Alignments Track', () => {
    runner.test('loads alignments track', async (page) => {
      await page.goto(`${baseUrl}/?config=test_data/volvox/config.json`, {
        waitUntil: 'networkidle0',
        timeout: 60000,
      })

      await findByText(page, 'ctgA', { timeout: 30000 })

      const trackLabel = await findByTestId(page, 'htsTrackLabel-Tracks,volvox_alignments', { timeout: 10000 })
      await trackLabel.click()

      await findByTestId(page, 'Blockset-pileup', { timeout: 60000 })
    })

    runner.test('alignments track screenshot', async (page) => {
      await page.goto(`${baseUrl}/?config=test_data/volvox/config.json`, {
        waitUntil: 'networkidle0',
        timeout: 60000,
      })

      await findByText(page, 'ctgA', { timeout: 30000 })

      const trackLabel = await findByTestId(page, 'htsTrackLabel-Tracks,volvox_alignments', { timeout: 10000 })
      await trackLabel.click()

      // Wait for the pileup canvas to render
      await findByTestId(page, 'Blockset-pileup', { timeout: 60000 })

      // Wait for rendering to complete
      await delay(2000)

      const result = await capturePageSnapshot(page, 'alignments-pileup')

      if (!result.passed) {
        throw new Error(result.message)
      }

      console.log(`      ${result.message}`)
    })
  })
}

function printSummary(results: TestSuite[]) {
  const totalPassed = results.flatMap(s => s.tests).filter(t => t.passed).length
  const totalFailed = results.flatMap(s => s.tests).filter(t => !t.passed).length

  console.log('\n' + '─'.repeat(50))
  console.log(`  Tests: ${totalPassed} passed, ${totalFailed} failed`)
  console.log('─'.repeat(50) + '\n')

  return totalFailed === 0
}

async function main() {
  const buildPath = path.resolve(__dirname, '../build')
  if (!fs.existsSync(buildPath)) {
    console.error('Error: Build directory not found. Run `yarn build` in products/jbrowse-web first.')
    process.exit(1)
  }

  const PORT = 3333
  console.log('Starting test server...')
  const server = await startTestDataServer(PORT)

  const baseUrl = `http://localhost:${PORT}`

  let browser: Browser | undefined

  try {
    console.log(`Launching browser (headed: ${headed}, slowMo: ${slowMo})...`)
    browser = await puppeteer.launch({
      headless: !headed,
      slowMo,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security'],
      defaultViewport: { width: 1280, height: 800 },
    })

    const runner = new TestRunner()
    await runner.setup(browser)

    defineTests(runner, baseUrl)

    console.log('\nRunning browser tests...')
    const results = await runner.runAll()

    await runner.teardown()

    const allPassed = printSummary(results)
    process.exit(allPassed ? 0 : 1)
  } catch (e) {
    console.error('Fatal error:', e)
    process.exit(1)
  } finally {
    if (browser) {
      await browser.close()
    }
    server.close()
  }
}

main()
