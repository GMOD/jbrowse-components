/* eslint-disable no-console */
import fs from 'fs'
import http from 'http'
import path from 'path'
import { fileURLToPath } from 'url'

import pixelmatch from 'pixelmatch'
import { PNG } from 'pngjs'
import { type Browser, type Page, launch } from 'puppeteer'
import handler from 'serve-handler'

import { startBasicAuthServer, startOAuthServer } from './servers.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const args = process.argv.slice(2)
const headed = args.includes('--headed')
const slowMoArg = args.find(a => a.startsWith('--slow-mo='))
const slowMo = slowMoArg ? parseInt(slowMoArg.split('=')[1]!, 10) : 0
const updateSnapshots =
  args.includes('--update-snapshots') || args.includes('-u')

const snapshotsDir = path.resolve(__dirname, '__snapshots__')
const buildPath = path.resolve(__dirname, '../build')
const testDataPath = path.resolve(__dirname, '..')
const volvoxDataPath = path.resolve(__dirname, '../test_data/volvox')
const PORT = 3333
const OAUTH_PORT = 3030
const BASICAUTH_PORT = 3040
const runAuthTests = args.includes('--auth')

// Helpers
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

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

async function waitForLoadingToComplete(page: Page, timeout = 30000) {
  await page.waitForFunction(
    () =>
      document.querySelectorAll('[data-testid="loading-overlay"]').length === 0,
    { timeout },
  )
}

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
  const threshold = 0.05

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
    message: `Snapshot differs by ${(diffPercent * 100).toFixed(2)}% (threshold: ${threshold * 100}%)`,
  }
}

// Server
function startServer(port: number): Promise<http.Server> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = req.url || '/'
      const publicPath = url.startsWith('/test_data/')
        ? testDataPath
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

// Test helpers
async function navigateToApp(
  page: Page,
  config = 'test_data/volvox/config.json',
) {
  await page.goto(`http://localhost:${PORT}/?config=${config}`, {
    waitUntil: 'networkidle0',
    timeout: 60000,
  })
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
  // Set a static session name to avoid snapshot diffs from random names
  await page.evaluate(() => {
    const el = document.querySelector('[data-testid="session_name"]')
    if (el) {
      el.textContent = 'Test Session'
    }
  })
  const result = await capturePageSnapshot(page, name)
  if (!result.passed) {
    throw new Error(result.message)
  }
}

async function handleOAuthLogin(browser: Browser) {
  // Wait for OAuth popup to appear
  const target = await browser.waitForTarget(
    t => t.url().includes('localhost:3030/oauth'),
    { timeout: 15000 },
  )
  const popup = await target.page()
  if (!popup) {
    throw new Error('Could not get OAuth popup page')
  }
  // Wait for the form to be ready
  await popup.waitForSelector('input[type="submit"]', { timeout: 10000 })
  // Small delay to ensure page is fully loaded
  await delay(500)
  const submitBtn = await popup.$('input[type="submit"]')
  await submitBtn?.click()
  // Wait for popup to close after successful auth
  await delay(2000)
}

async function handleBasicAuthLogin(page: Page) {
  const dialog = await findByTestId(page, 'login-httpbasic', 10000)
  if (!dialog) {
    throw new Error('BasicAuth login dialog not found')
  }

  const usernameInput = await findByTestId(
    page,
    'login-httpbasic-username',
    10000,
  )
  const passwordInput = await findByTestId(
    page,
    'login-httpbasic-password',
    10000,
  )
  await usernameInput?.type('admin')
  await passwordInput?.type('password')

  const submitBtn = await findByText(page, 'Submit', 10000)
  await submitBtn?.click()
  await delay(500)
}

async function clearStorageAndNavigate(page: Page, config: string) {
  await page.goto(`http://localhost:${PORT}/`)
  await page.evaluate(() => {
    localStorage.clear()
    sessionStorage.clear()
  })
  await navigateToApp(page, config)
}

async function waitForDisplay(page: Page, trackId: string, timeout = 60000) {
  await page.waitForSelector(`[data-testid^="display-${trackId}"]`, { timeout })
}

// Test suites
interface TestSuite {
  name: string
  tests: {
    name: string
    fn: (page: Page, browser?: Browser) => Promise<void>
  }[]
  requiresAuth?: boolean
}

const testSuites: TestSuite[] = [
  {
    name: 'Workspaces',
    tests: [
      {
        name: 'can add Linear genome view from menu with workspaces enabled',
        fn: async page => {
          await navigateToApp(page)

          // Enable workspaces via Tools menu
          const toolsMenu = await findByText(page, 'Tools', 10000)
          await toolsMenu?.click()
          await delay(300)
          const useWorkspacesCheckbox = await findByText(
            page,
            'Use workspaces',
            10000,
          )
          await useWorkspacesCheckbox?.click()
          await delay(500)

          // Count views before adding
          const searchInputsBefore = await page.$$(
            'input[placeholder="Search for location"]',
          )
          const viewCountBefore = searchInputsBefore.length

          // Click Add menu and then Linear genome view
          const addMenu = await findByText(page, 'Add', 10000)
          await addMenu?.click()
          await delay(300)
          const linearGenomeViewOption = await findByText(
            page,
            'Linear genome view',
            10000,
          )
          await linearGenomeViewOption?.click()

          // Wait for new view to appear by polling for increased view count
          const timeout = 10000
          const start = Date.now()
          let viewCountAfter = viewCountBefore
          while (Date.now() - start < timeout) {
            const searchInputsAfter = await page.$$(
              'input[placeholder="Search for location"]',
            )
            viewCountAfter = searchInputsAfter.length
            if (viewCountAfter > viewCountBefore) {
              break
            }
            await delay(200)
          }

          if (viewCountAfter <= viewCountBefore) {
            throw new Error(
              `New Linear genome view was not added. Views before: ${viewCountBefore}, after: ${viewCountAfter}`,
            )
          }
        },
      },
      {
        name: 'move to new tab enables workspaces',
        fn: async page => {
          await navigateToApp(page)
          // Open view menu
          const viewMenu = await findByTestId(page, 'view_menu_icon', 10000)
          await viewMenu?.click()
          await delay(300)
          // Click View options
          const viewOptions = await findByText(page, 'View options', 10000)
          await viewOptions?.click()
          await delay(300)
          // Click Move to new tab
          const moveToTab = await findByText(page, 'Move to new tab', 10000)
          await moveToTab?.click()
          // Wait for workspaces to be enabled (dockview tabs should appear)
          await delay(1000)
          // Verify dockview is present
          await page.waitForSelector(
            '.dockview-theme-light, .dockview-theme-dark',
            { timeout: 10000 },
          )
        },
      },
      {
        name: 'move to split right enables workspaces',
        fn: async page => {
          await navigateToApp(page)
          // Open view menu
          const viewMenu = await findByTestId(page, 'view_menu_icon', 10000)
          await viewMenu?.click()
          await delay(300)
          // Click View options
          const viewOptions = await findByText(page, 'View options', 10000)
          await viewOptions?.click()
          await delay(300)
          // Click Move to split view
          const moveToSplit = await findByText(
            page,
            'Move to split view',
            10000,
          )
          await moveToSplit?.click()
          // Wait for workspaces to be enabled
          await delay(1000)
          // Verify dockview is present
          await page.waitForSelector(
            '.dockview-theme-light, .dockview-theme-dark',
            { timeout: 10000 },
          )
        },
      },
      {
        name: 'copy view creates second view',
        fn: async page => {
          await navigateToApp(page)
          // Open view menu
          const viewMenu = await findByTestId(page, 'view_menu_icon', 10000)
          await viewMenu?.click()
          await delay(300)
          // Click View options
          const viewOptions = await findByText(page, 'View options', 10000)
          await viewOptions?.click()
          await delay(300)
          // Click Copy view
          const copyView = await findByText(page, 'Copy view', 10000)
          await copyView?.click()
          await delay(1000)
          // Should now have 2 view menus
          const viewMenus = await page.$$('[data-testid="view_menu_icon"]')
          if (viewMenus.length !== 2) {
            throw new Error(`Expected 2 views, got ${viewMenus.length}`)
          }
        },
      },
      {
        name: 'multiple views in workspace - move up and down',
        fn: async page => {
          await navigateToApp(page)
          // First copy the view to get 2 views
          let viewMenu = await findByTestId(page, 'view_menu_icon', 10000)
          await viewMenu?.click()
          await delay(300)
          let viewOptions = await findByText(page, 'View options', 10000)
          await viewOptions?.click()
          await delay(300)
          const copyView = await findByText(page, 'Copy view', 10000)
          await copyView?.click()
          await delay(1000)

          // Enable workspaces by moving to new tab
          const viewMenus = await page.$$('[data-testid="view_menu_icon"]')
          await viewMenus[0]?.click()
          await delay(300)
          viewOptions = await findByText(page, 'View options', 10000)
          await viewOptions?.click()
          await delay(300)
          const moveToTab = await findByText(page, 'Move to new tab', 10000)
          await moveToTab?.click()
          await delay(1000)

          // Wait for dockview
          await page.waitForSelector(
            '.dockview-theme-light, .dockview-theme-dark',
            { timeout: 10000 },
          )

          // Copy view again to have multiple views in one panel
          viewMenu = await findByTestId(page, 'view_menu_icon', 10000)
          await viewMenu?.click()
          await delay(300)
          viewOptions = await findByText(page, 'View options', 10000)
          await viewOptions?.click()
          await delay(300)
          const copyView2 = await findByText(page, 'Copy view', 10000)
          await copyView2?.click()
          await delay(1000)

          // Get the order of view containers before moving
          const getViewOrder = () =>
            page.evaluate(() => {
              const containers = document.querySelectorAll(
                '[data-testid^="view-container-"]',
              )
              return [...containers].map(c => (c as HTMLElement).dataset.testid)
            })

          const orderBefore = await getViewOrder()
          if (orderBefore.length < 2) {
            throw new Error(
              `Expected at least 2 view containers, got ${orderBefore.length}`,
            )
          }

          // Now try to move first view down
          const viewMenusAfter = await page.$$('[data-testid="view_menu_icon"]')
          await viewMenusAfter[0]?.click()
          await delay(300)
          viewOptions = await findByText(page, 'View options', 10000)
          await viewOptions?.click()
          await delay(300)
          const moveDown = await findByText(page, 'Move view down', 10000)
          await moveDown?.click()
          await delay(500)

          // Verify the order actually changed
          const orderAfter = await getViewOrder()
          if (
            orderBefore[0] === orderAfter[0] &&
            orderBefore[1] === orderAfter[1]
          ) {
            throw new Error(
              `View order did not change after move down. Before: ${orderBefore.join(', ')}. After: ${orderAfter.join(', ')}`,
            )
          }
        },
      },
    ],
  },
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
  {
    name: 'MainThreadRPC',
    tests: [
      {
        name: 'loads with main thread RPC',
        fn: async page => {
          await navigateToApp(page, 'test_data/volvox/config_main_thread.json')
          await findByText(page, 'Help', 10000)
        },
      },
      {
        name: 'loads BAM track with main thread RPC',
        fn: async page => {
          await navigateToApp(page, 'test_data/volvox/config_main_thread.json')
          await openTrack(page, 'volvox_sv')
          await findByTestId(page, 'Blockset-pileup', 60000)
        },
      },
      {
        name: 'loads GFF3 track with main thread RPC',
        fn: async page => {
          await navigateToApp(page, 'test_data/volvox/config_main_thread.json')
          await openTrack(page, 'gff3tabix_genes')
          await findByTestId(
            page,
            'display-gff3tabix_genes-LinearBasicDisplay',
            60000,
          )
        },
      },
      {
        name: 'main thread RPC BAM screenshot',
        fn: async page => {
          await navigateToApp(page, 'test_data/volvox/config_main_thread.json')
          await openTrack(page, 'volvox_sv')
          await findByTestId(page, 'Blockset-pileup', 60000)
          await waitForLoadingToComplete(page)
          await snapshot(page, 'main-thread-rpc-bam')
        },
      },
    ],
  },
  {
    name: 'Authentication (WebWorker RPC)',
    requiresAuth: true,
    tests: [
      {
        name: 'loads with auth config',
        fn: async page => {
          await navigateToApp(page, 'test_data/volvox/config_auth.json')
          await findByText(page, 'Help', 10000)
        },
      },
      {
        name: 'loads OAuth BigWig track after login',
        fn: async (page, browser) => {
          await navigateToApp(page, 'test_data/volvox/config_auth.json')
          await openTrack(page, 'oauth_bigwig')
          await handleOAuthLogin(browser!)
          await waitForDisplay(page, 'oauth_bigwig')
        },
      },
      {
        name: 'loads BasicAuth BigWig track after login',
        fn: async page => {
          await navigateToApp(page, 'test_data/volvox/config_auth.json')
          await openTrack(page, 'basicauth_bigwig')
          await handleBasicAuthLogin(page)
          await waitForDisplay(page, 'basicauth_bigwig')
        },
      },
    ],
  },
  {
    name: 'Authentication (MainThread RPC)',
    requiresAuth: true,
    tests: [
      {
        name: 'loads with main thread auth config',
        fn: async page => {
          await navigateToApp(page, 'test_data/volvox/config_auth_main.json')
          await findByText(page, 'Help', 10000)
        },
      },
      {
        name: 'loads OAuth BigWig track after login (main thread)',
        fn: async (page, browser) => {
          await clearStorageAndNavigate(
            page,
            'test_data/volvox/config_auth_main.json',
          )
          await openTrack(page, 'oauth_bigwig')
          await handleOAuthLogin(browser!)
          await waitForDisplay(page, 'oauth_bigwig')
        },
      },
      {
        name: 'loads BasicAuth BigWig track after login (main thread)',
        fn: async page => {
          await clearStorageAndNavigate(
            page,
            'test_data/volvox/config_auth_main.json',
          )
          await openTrack(page, 'basicauth_bigwig')
          await handleBasicAuthLogin(page)
          await waitForDisplay(page, 'basicauth_bigwig')
        },
      },
    ],
  },
]

// Runner
async function runTests(page: Page, browser: Browser, includeAuth: boolean) {
  let passed = 0
  let failed = 0

  const suitesToRun = testSuites.filter(
    suite => !suite.requiresAuth || includeAuth,
  )

  for (const suite of suitesToRun) {
    console.log(`\n  ${suite.name}`)

    for (const test of suite.tests) {
      const start = performance.now()
      process.stdout.write(`    ⏳ ${test.name}...`)

      try {
        await page.goto('about:blank')
        await test.fn(page, browser)

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

  let browser: Browser | undefined
  let oauthServer: http.Server | undefined
  let basicAuthServer: http.Server | undefined

  try {
    if (runAuthTests) {
      console.log('Starting auth servers...')
      oauthServer = await startOAuthServer({
        port: OAUTH_PORT,
        redirectPort: PORT,
        dataPath: volvoxDataPath,
      })
      basicAuthServer = await startBasicAuthServer({
        port: BASICAUTH_PORT,
        dataPath: volvoxDataPath,
      })
    }

    console.log(`Launching browser (headed: ${headed})...`)
    browser = await launch({
      headless: !headed,
      slowMo,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-web-security',
        '--disable-popup-blocking',
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
    if (runAuthTests) {
      console.log('(including auth tests)')
    }
    const { passed, failed } = await runTests(page, browser, runAuthTests)

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
    oauthServer?.close()
    basicAuthServer?.close()
  }
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
main()
