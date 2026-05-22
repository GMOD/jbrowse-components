/* eslint-disable no-console */
import fs from 'fs'
import path from 'path'
import { fileURLToPath, pathToFileURL } from 'url'

import { launch } from 'puppeteer'

import { BASICAUTH_PORT, OAUTH_PORT, PORT } from './helpers.ts'
import { buildPath, startServer } from './server.ts'
import { startBasicAuthServer, startOAuthServer } from './servers.ts'
import { snapshotConfig } from './snapshot.ts'

import type { TestSuite } from './types.ts'
import type { Server } from 'http'
import type { Browser, Page } from 'puppeteer'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const volvoxDataPath = path.resolve(__dirname, '../test_data/volvox')

const args = process.argv.slice(2)
const headed = args.includes('--headed')
const slowMoArg = args.find(a => a.startsWith('--slow-mo='))
const slowMo = slowMoArg ? parseInt(slowMoArg.split('=')[1]!, 10) : 0
const updateSnapshots =
  args.includes('--update-snapshots') || args.includes('-u')
const runAuthTests = args.includes('--auth')
const filterArg = args.find(a => a.startsWith('--filter='))
const filter = filterArg ? filterArg.split('=')[1]!.toLowerCase() : ''
// --smoke is the full local smoke test: runs every suite, including the
// requiresRemote ones (grape/peach + hs1/mm39 synteny, graph-server).
// Those tests fetch data straight from S3/UCSC at runtime — so it works on any machine online.
const smoke = args.includes('--smoke')
const includeRemote = args.includes('--include-remote') || smoke
const backendArg = args.find(a => a.startsWith('--backend='))
const backendValue = backendArg ? backendArg.split('=')[1]! : undefined
const skipWebGPU = args.includes('--skip-webgpu')
const quiet = args.includes('--quiet')
const debug = args.includes('--debug')
const useFirefoxArg = args.find(a => a.startsWith('--firefox='))
const firefoxPath = useFirefoxArg
  ? useFirefoxArg.split('=')[1]!
  : args.includes('--firefox')
    ? (process.env.FIREFOX_NIGHTLY_PATH ?? '/usr/bin/firefox-nightly')
    : undefined

snapshotConfig.updateSnapshots = updateSnapshots

type Backend = 'webgl' | 'webgpu' | 'canvas2d'

function chromeArgsForBackend(backend?: Backend) {
  const chromeArgs = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-web-security',
    '--disable-popup-blocking',
  ]
  if (backend === 'webgl') {
    chromeArgs.push(
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
    )
  } else if (backend === 'webgpu') {
    // WebGPU requires Vulkan. Use lavapipe (software Vulkan) via:
    //   VK_ICD_FILENAMES=/usr/share/vulkan/icd.d/lvp_icd.json
    // and run under xvfb-run (headless: false + virtual framebuffer):
    //   xvfb-run --auto-servernum node browser-tests/runner.ts --backend=webgpu
    chromeArgs.push(
      '--enable-unsafe-webgpu',
      '--enable-features=Vulkan,UseSkiaRenderer',
      '--use-angle=vulkan',
      '--disable-vulkan-surface',
    )
  } else if (backend === 'canvas2d') {
    chromeArgs.push('--disable-gpu')
  }
  return chromeArgs
}

async function discoverSuites(): Promise<TestSuite[]> {
  const suitesDir = path.resolve(__dirname, 'suites')
  const files = fs
    .readdirSync(suitesDir)
    .filter(f => f.endsWith('.ts'))
    .sort()
  const suites: TestSuite[] = []

  for (const file of files) {
    const mod = await import(pathToFileURL(path.join(suitesDir, file)).href)
    const exported = mod.default
    if (Array.isArray(exported)) {
      for (const s of exported) {
        suites.push(s)
      }
    } else {
      suites.push(exported)
    }
  }

  return suites
}

async function runTests(
  initialPage: Page,
  browser: Browser,
  suites: TestSuite[],
  includeAuth: boolean,
  launchBrowser?: () => Promise<Browser>,
) {
  let passed = 0
  let failed = 0
  const failures: { suite: string; test: string; error: string }[] = []
  let page = initialPage

  const suitesToRun = suites.filter(suite => {
    if (suite.requiresAuth && !includeAuth) {
      return false
    }
    if (suite.requiresRemote && !includeRemote) {
      return false
    }
    if (filter && !suite.name.toLowerCase().includes(filter)) {
      return false
    }
    return true
  })

  for (const suite of suitesToRun) {
    console.log(`\n  ${suite.name}`)

    // Recycle the page between suites to release accumulated GPU/memory
    // resources and prevent OOM crashes during long test runs
    try {
      await page.close()
      page = await setupPage(browser)
    } catch (recycleErr) {
      console.warn(
        `  [warn] Failed to recycle page before suite "${suite.name}": ${recycleErr instanceof Error ? recycleErr.message : recycleErr}`,
      )
    }

    for (const test of suite.tests) {
      if (test.requiresRemote && !includeRemote) {
        console.log(`    ⚡ ${test.name} (skipped — requires --include-remote)`)
        continue
      }
      if (test.requiresAuth && !includeAuth) {
        console.log(`    ⚡ ${test.name} (skipped — requires --auth)`)
        continue
      }

      const start = performance.now()
      testStartTime = start
      const progress = `[${suitesToRun.indexOf(suite) + 1}/${suitesToRun.length}]`
      process.stdout.write(`    ⏳ ${progress} ${test.name}...`)

      try {
        await page.goto(`http://localhost:${PORT}/test_data/volvox/config.json`)
        await page.evaluate(() => {
          localStorage.clear()
          sessionStorage.clear()
        })
        await page.goto('about:blank')
        await test.fn(page, browser)

        // Clean up any GPU resources after test completes, before we navigate again
        try {
          await page.evaluate(() => {
            const w = window as typeof window & {
              __jbrowseCleanupGpuBackends?: () => void
            }
            if (w.__jbrowseCleanupGpuBackends) {
              w.__jbrowseCleanupGpuBackends()
            }
          })
        } catch {
          // Cleanup might fail if page has been navigated away, that's ok
        }

        const duration = performance.now() - start
        passed++

        if (process.stdout.isTTY) {
          process.stdout.clearLine(0)
          process.stdout.cursorTo(0)
        }
        console.log(
          `    ✓ ${progress} ${test.name} (${Math.round(duration)}ms)`,
        )

        // Recycle browser after every test to prevent resource exhaustion
        // (swiftshader limitation in headless Chrome accumulates resources across tests)
        if (launchBrowser) {
          try {
            await browser.close()
            browser = await launchBrowser()
            page = await setupPage(browser)
          } catch (recycleErr) {
            console.warn(
              `      [browser recycle] Failed to recycle browser: ${recycleErr instanceof Error ? recycleErr.message : recycleErr}`,
            )
          }
        }
      } catch (e) {
        failed++
        const error = e instanceof Error ? e.message : String(e)
        failures.push({ suite: suite.name, test: test.name, error })

        if (process.stdout.isTTY) {
          process.stdout.clearLine(0)
          process.stdout.cursorTo(0)
        }
        console.log(`    ✗ ${progress} FAILED: ${suite.name} > ${test.name}`)
        console.log(`      Error: ${error}`)

        // Always recycle browser after failed test to ensure clean state for next test
        if (launchBrowser) {
          try {
            await browser.close().catch(() => {})
            browser = await launchBrowser()
            page = await setupPage(browser)
          } catch (recycleErr) {
            console.error(
              `      [recovery] Browser recycle failed, cannot recover: ${recycleErr instanceof Error ? recycleErr.message : recycleErr}`,
            )
            return { passed, failed, failures }
          }
        }
      }
    }
  }

  return { passed, failed, failures }
}

// Firefox leaks WebGPU device resources across navigations, causing
// cascading timeouts after ~50-60 tests. This variant restarts the
// browser between suites to prevent resource exhaustion.
async function runTestsWithRestart(
  launchBrowser: () => Promise<Browser>,
  suites: TestSuite[],
  includeAuth: boolean,
) {
  let passed = 0
  let failed = 0
  const failures: { suite: string; test: string; error: string }[] = []

  const suitesToRun = suites.filter(suite => {
    if (suite.requiresAuth && !includeAuth) {
      return false
    }
    if (suite.requiresRemote && !includeRemote) {
      return false
    }
    if (filter && !suite.name.toLowerCase().includes(filter)) {
      return false
    }
    return true
  })

  // Launch a fresh browser for each test to avoid Firefox's
  // WebWorker/GPU resource accumulation across tabs. The ~2s browser
  // launch overhead is far less than the 15-30s penalty from resource
  // buildup when reusing a single browser with multiple tabs.
  for (const suite of suitesToRun) {
    console.log(`\n  ${suite.name}`)

    for (const test of suite.tests) {
      if (test.requiresRemote && !includeRemote) {
        console.log(`    ⚡ ${test.name} (skipped — requires --include-remote)`)
        continue
      }
      if (test.requiresAuth && !includeAuth) {
        console.log(`    ⚡ ${test.name} (skipped — requires --auth)`)
        continue
      }

      const start = performance.now()
      testStartTime = start
      const progress = `[${suitesToRun.indexOf(suite) + 1}/${suitesToRun.length}]`
      process.stdout.write(`    ⏳ ${progress} ${test.name}...`)

      let browser: Browser | undefined
      try {
        browser = await launchBrowser()
        const page = await setupPage(browser)
        await test.fn(page, browser)

        const duration = performance.now() - start
        passed++

        if (process.stdout.isTTY) {
          process.stdout.clearLine(0)
          process.stdout.cursorTo(0)
        }
        console.log(
          `    ✓ ${progress} ${test.name} (${Math.round(duration)}ms)`,
        )
      } catch (e) {
        failed++
        const error = e instanceof Error ? e.message : String(e)
        failures.push({ suite: suite.name, test: test.name, error })

        if (process.stdout.isTTY) {
          process.stdout.clearLine(0)
          process.stdout.cursorTo(0)
        }
        console.log(`    ✗ ${progress} FAILED: ${suite.name} > ${test.name}`)
        console.log(`      Error: ${error}`)
      } finally {
        if (browser) {
          await browser.close().catch((e: unknown) => {
            console.warn(
              `    (browser close error: ${e instanceof Error ? e.message : e})`,
            )
          })
        }
      }
    }
  }
  return { passed, failed, failures }
}

let testStartTime = 0

function isGpuLifecycleNoise(text: string): boolean {
  if (text.includes('[WebGL2Hal #')) {
    return !text.includes('context LOST') && !text.includes('GL error')
  }
  return (
    text.includes('[GPU] WebGPU not supported') ||
    text.includes('[GPU] No compatible GPU adapter') ||
    text.includes('[GPU] WebGPU initialization failed') ||
    text.includes('[GPU] WebGL2 unavailable') ||
    text.includes('[GPU] WebGPU device creation failed') ||
    text.includes('GroupMarkerNotSet') ||
    text.includes('Automatic fallback to software WebGL') ||
    text.includes('No available adapters')
  )
}

async function setupPage(browser: Browser) {
  const page = await browser.newPage()

  page.on('console', msg => {
    const text = msg.text()
    if (
      text.includes('favicon') ||
      text.includes('GPU stall due to ReadPixels')
    ) {
      return
    }
    const type = msg.type()
    if (quiet && type !== 'error') {
      return
    }
    if (!debug && isGpuLifecycleNoise(text)) {
      return
    }
    const elapsed =
      testStartTime > 0
        ? `+${((performance.now() - testStartTime) / 1000).toFixed(1)}s`
        : ''
    const prefix = elapsed ? `  [${elapsed}] Browser:` : '  Browser:'
    if (type === 'error') {
      console.error(prefix, text)
    } else if (type === 'warn') {
      console.warn(prefix, text)
    } else {
      console.log(prefix, text)
    }
  })
  page.on('pageerror', err => {
    const elapsed =
      testStartTime > 0
        ? `+${((performance.now() - testStartTime) / 1000).toFixed(1)}s`
        : ''
    if (err instanceof Error) {
      console.error(`  [${elapsed}] PageError:`, err.stack || err.message)
    } else {
      console.error(`  [${elapsed}] PageError:`, err)
    }
  })
  return page
}

async function runWithBackend(
  suites: TestSuite[],
  backend: Backend | undefined,
) {
  snapshotConfig.backend = backend ?? ''

  // WebGPU needs a real display (xvfb-run) — force headless: false
  // Chrome + lavapipe doesn't render WebGPU canvases, so always use Firefox for WebGPU
  const needsDisplay = backend === 'webgpu'
  const useHeadless = needsDisplay ? false : !headed

  // Always use Firefox for WebGPU — Chrome + lavapipe produces blank canvases
  const resolvedFirefoxPath =
    firefoxPath ??
    process.env.FIREFOX_NIGHTLY_PATH ??
    '/usr/bin/firefox-nightly'
  const useFirefox = backend === 'webgpu'

  if (useFirefox) {
    console.log(`  Using Firefox Nightly: ${resolvedFirefoxPath}`)
    const launchFirefox = () =>
      launch({
        browser: 'firefox',
        executablePath: resolvedFirefoxPath,
        headless: useHeadless,
        slowMo,
        timeout: 60000,
        extraPrefsFirefox: {
          'dom.webgpu.enabled': true,
          'gfx.webrender.all': true,
          'gfx.webgpu.ignore-blocklist': true,
        },
        defaultViewport: { width: 1280, height: 800 },
      })
    return runTestsWithRestart(launchFirefox, suites, runAuthTests)
  }

  const chromeArgs = chromeArgsForBackend(backend)
  const browser = await launch({
    headless: useHeadless,
    slowMo,
    args: chromeArgs,
    defaultViewport: { width: 1280, height: 800 },
  })

  const page = await setupPage(browser)

  // Create a factory function to relaunch the browser for GPU-heavy tests
  const launchBrowser = () =>
    launch({
      headless: useHeadless,
      slowMo,
      args: chromeArgs,
      defaultViewport: { width: 1280, height: 800 },
    })

  try {
    return await runTests(page, browser, suites, runAuthTests, launchBrowser)
  } finally {
    await browser.close()
  }
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

  let oauthServer: Server | undefined
  let basicAuthServer: Server | undefined

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

    console.log('Discovering test suites...')
    const suites = await discoverSuites()
    console.log(`Found ${suites.length} test suites`)

    let backends: (Backend | undefined)[]
    if (backendValue === 'all') {
      backends = skipWebGPU
        ? ['canvas2d', 'webgl']
        : ['canvas2d', 'webgl', 'webgpu']
    } else {
      backends = [backendValue as Backend | undefined]
    }

    let totalPassed = 0
    let totalFailed = 0
    const allFailures: {
      backend: string
      suite: string
      test: string
      error: string
    }[] = []

    for (const backend of backends) {
      console.log(`\nLaunching browser (headed: ${headed})...`)
      if (runAuthTests) {
        console.log('(including auth tests)')
      }
      if (filter) {
        console.log(`(filtering by: ${filter})`)
      }
      if (smoke) {
        console.log('(smoke test: running all suites including remote)')
      }
      console.log(`(backend: ${backend ?? 'default'})`)

      const { passed, failed, failures } = await runWithBackend(suites, backend)
      totalPassed += passed
      totalFailed += failed
      for (const f of failures) {
        allFailures.push({ backend: backend ?? 'default', ...f })
      }
    }

    console.log(`\n${'─'.repeat(50)}`)
    console.log(`  Tests: ${totalPassed} passed, ${totalFailed} failed`)
    if (backends.length > 1) {
      console.log(`  Backends tested: ${backends.join(', ')}`)
    }
    if (allFailures.length > 0) {
      console.log(`\n  Failed tests:`)
      for (const f of allFailures) {
        const prefix = backends.length > 1 ? `[${f.backend}] ` : ''
        console.log(`    ✗ ${prefix}${f.suite} > ${f.test}`)
        console.log(`      ${f.error}`)
      }
    }
    console.log(`${'─'.repeat(50)}\n`)

    // Auto-run cross-backend comparison when multiple backends were tested
    if (backends.length > 1) {
      console.log('Running cross-backend comparison...\n')
      const { runComparison } = await import('./compare-backends.ts')
      runComparison()
    }

    process.exit(totalFailed > 0 ? 1 : 0)
  } catch (e) {
    console.error('Fatal error:', e)
    process.exit(1)
  } finally {
    server.close()
    oauthServer?.close()
    basicAuthServer?.close()
  }
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
main()
