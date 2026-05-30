/* eslint-disable no-console */
import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath, pathToFileURL } from 'url'

import { launch } from 'puppeteer'

import { BASICAUTH_PORT, OAUTH_PORT, PORT } from './helpers.ts'
import { buildPath, startServer } from './server.ts'
import { startBasicAuthServer, startOAuthServer } from './servers.ts'
import { snapshotConfig } from './snapshot.ts'

import type { TestCase, TestSuite } from './types.ts'
import type { Server } from 'http'
import type { Browser } from 'puppeteer'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const volvoxDataPath = path.resolve(__dirname, '../test_data/volvox')

const args = process.argv.slice(2)
const headed = args.includes('--headed')
const slowMoArg = args.find(a => a.startsWith('--slow-mo='))
const slowMo = slowMoArg ? parseInt(slowMoArg.split('=')[1]!, 10) : 0
const updateSnapshots =
  args.includes('--update-snapshots') || args.includes('-u')
const runAuthTests = args.includes('--auth')
// --filter= accepts comma-separated values and/or multiple flags:
//   --filter=grape,hs1   or   --filter=grape --filter=hs1
// Matching is case-insensitive substring against suite name.
const filters = args
  .filter(a => a.startsWith('--filter='))
  .flatMap(a => a.split('=')[1]!.toLowerCase().split(','))
  .filter(Boolean)
// --test= filters individual test cases within matched suites (substring match).
const testFilterArg = args.find(a => a.startsWith('--test='))
const testFilter = testFilterArg
  ? testFilterArg.split('=')[1]!.toLowerCase()
  : ''
// --smoke is the full local smoke test: runs every suite, including the
// requiresRemote ones (grape/peach + hs1/mm39 synteny).
// Those tests fetch data straight from S3/UCSC at runtime — so it works on any machine online.
const smoke = args.includes('--smoke')
// Auto-enable remote when a filter is specified — you shouldn't need to know
// about --include-remote when targeting a specific suite by name.
const includeRemote =
  args.includes('--include-remote') || smoke || filters.length > 0
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

type RenderingBackend = 'webgl' | 'webgpu' | 'canvas2d'

function chromeArgsForRenderingBackend(backend?: RenderingBackend) {
  const chromeArgs = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-web-security',
    '--disable-popup-blocking',
  ]
  // webgl runs on the machine's real GPU (run headed) — no swiftshader, whose
  // per-context memory growth is why we moved off it (see
  // agent-docs/BROWSER_TEST_STABILIZATION.md). webgpu does not use Chrome at all
  // (it requires Firefox Nightly, see runWithRenderingBackend), so neither needs
  // extra chrome flags.
  if (backend === 'canvas2d') {
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

// Whether a suite passes the auth/remote/name-filter gates for this run.
function suiteIncluded(suite: TestSuite, includeAuth: boolean) {
  const authOk = !suite.requiresAuth || includeAuth
  const remoteOk = !suite.requiresRemote || includeRemote
  const filterOk =
    filters.length === 0 ||
    filters.some(f => suite.name.toLowerCase().includes(f))
  return authOk && remoteOk && filterOk
}

// Reason this individual test is skipped (logged), or undefined to run it.
function testSkipReason(test: TestCase, includeAuth: boolean) {
  return test.requiresRemote && !includeRemote
    ? 'requires --include-remote'
    : test.requiresAuth && !includeAuth
      ? 'requires --auth'
      : undefined
}

function clearProgressLine() {
  if (process.stdout.isTTY) {
    process.stdout.clearLine(0)
    process.stdout.cursorTo(0)
  }
}

// Run a single test in its own fresh browser, always closing it afterward.
// Returns the error message on failure, or undefined on success.
async function runOneTest(
  launchBrowser: () => Promise<Browser>,
  suiteName: string,
  test: TestCase,
  progress: string,
) {
  const start = performance.now()
  testStartTime = start
  process.stdout.write(`    ⏳ ${progress} ${test.name}...`)

  let browser: Browser | undefined
  let error: string | undefined
  try {
    browser = await launchBrowser()
    const page = await setupPage(browser)
    await test.fn(page, browser)
    clearProgressLine()
    console.log(
      `    ✓ ${progress} ${test.name} (${Math.round(performance.now() - start)}ms)`,
    )
  } catch (e) {
    error = e instanceof Error ? e.message : String(e)
    clearProgressLine()
    console.log(`    ✗ ${progress} FAILED: ${suiteName} > ${test.name}`)
    console.log(`      Error: ${error}`)
  } finally {
    await browser?.close().catch((e: unknown) => {
      console.warn(
        `    (browser close error: ${e instanceof Error ? e.message : e})`,
      )
    })
  }
  return error
}

// Run all selected suites, launching a fresh browser per test. A clean browser
// each time is what keeps long runs stable: headless Chrome on swiftshader and
// Firefox/WebGPU both accumulate per-context GPU/worker memory across tabs that
// never returns to the OS (see agent-docs/BROWSER_TEST_STABILIZATION.md), and
// the ~2s relaunch is far cheaper than the 15-30s penalty from that buildup.
async function runSuites(
  launchBrowser: () => Promise<Browser>,
  suites: TestSuite[],
  includeAuth: boolean,
) {
  let passed = 0
  let failed = 0
  const failures: { suite: string; test: string; error: string }[] = []
  const suitesToRun = suites.filter(s => suiteIncluded(s, includeAuth))

  for (const suite of suitesToRun) {
    console.log(`\n  ${suite.name}`)
    const progress = `[${suitesToRun.indexOf(suite) + 1}/${suitesToRun.length}]`

    for (const test of suite.tests) {
      const skip = testSkipReason(test, includeAuth)
      const filteredOut =
        testFilter && !test.name.toLowerCase().includes(testFilter)
      if (skip) {
        console.log(`    ⚡ ${test.name} (skipped — ${skip})`)
      } else if (!filteredOut) {
        const error = await runOneTest(
          launchBrowser,
          suite.name,
          test,
          progress,
        )
        if (error === undefined) {
          passed++
        } else {
          failed++
          failures.push({ suite: suite.name, test: test.name, error })
        }
      }
    }
  }

  return { passed, failed, failures }
}

let testStartTime = 0

function isRenderLifecycleNoise(text: string): boolean {
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
    if (!debug && isRenderLifecycleNoise(text)) {
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

async function runWithRenderingBackend(
  suites: TestSuite[],
  backend: RenderingBackend,
) {
  snapshotConfig.backend = backend

  // WebGPU requires Firefox Nightly on the real GPU, run headed. Chrome +
  // puppeteer does not render WebGPU canvases (blank canvas / adapter-validation
  // errors), so WebGPU always goes through Firefox Nightly.
  const needsDisplay = backend === 'webgpu'
  const useHeadless = needsDisplay ? false : !headed

  const resolvedFirefoxPath =
    firefoxPath ??
    process.env.FIREFOX_NIGHTLY_PATH ??
    '/usr/bin/firefox-nightly'
  const useFirefox = backend === 'webgpu'

  const launchBrowser = useFirefox
    ? () =>
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
        }).then(trackBrowser)
    : () =>
        launch({
          headless: useHeadless,
          slowMo,
          args: chromeArgsForRenderingBackend(backend),
          defaultViewport: { width: 1280, height: 800 },
        }).then(trackBrowser)

  if (useFirefox) {
    console.log(`  Using Firefox Nightly: ${resolvedFirefoxPath}`)
  }

  return runSuites(launchBrowser, suites, runAuthTests)
}

// Browsers this process launched. Tracked so an exit backstop can force-kill
// any that survive a crash path `finally { browser.close() }` doesn't catch
// (uncaughtException, process.exit from a nested error). Only ever touches our
// own browsers — never another agent's run.
const liveBrowsers = new Set<Browser>()
function trackBrowser(browser: Browser) {
  liveBrowsers.add(browser)
  browser.once('disconnected', () => liveBrowsers.delete(browser))
  return browser
}
process.on('exit', () => {
  for (const browser of liveBrowsers) {
    browser.process()?.kill('SIGKILL')
  }
})

// Reap puppeteer browsers leaked by *prior* runs that were SIGKILLed or
// OOM-killed — paths no in-process handler can catch, so they accumulate
// (~300MB-900MB each) until the kernel OOM-kills a live renderer mid-run.
// Puppeteer can't fix this itself; an external startup reaper is the standard
// remedy:
//   https://github.com/puppeteer/puppeteer/issues/1367
//   https://github.com/puppeteer/puppeteer/issues/12854
//
// A leaked browser carries puppeteer's `--enable-automation` signature (never
// present on a real Chrome) but its launching `node` is gone, so it's been
// reparented to init/systemd. A concurrent live run keeps `node` as the parent,
// so this is safe under the shared multi-agent worktree — we only kill browsers
// whose runner has died. Killing each main process is enough; its renderer
// children self-exit when the browser process's IPC pipe closes. Linux-only.
function killStaleTestBrowsers() {
  if (process.platform !== 'linux') {
    return
  }
  let psOut: string
  try {
    psOut = execSync('ps -eo pid=,ppid=,comm=,args=', {
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
    })
  } catch {
    return // ps unavailable — skip the sweep rather than guess
  }

  const procs = psOut
    .split('\n')
    .map(line => /^(\d+)\s+(\d+)\s+(\S+)\s+(.*)$/.exec(line.trim()))
    .filter(m => m !== null)
    .map(m => ({
      pid: +m[1]!,
      ppid: +m[2]!,
      comm: m[3]!,
      argv: m[4]!.split(/\s+/),
    }))
  const commByPid = new Map(procs.map(p => [p.pid, p.comm]))

  // A test browser is a chromium-family process carrying puppeteer's
  // `--enable-automation` token (the user's own Chrome never has it). It's an
  // orphan — its launching `node` died — when its parent is no longer `node`.
  const orphans = procs.filter(
    p =>
      /^(chrome|chromium|headless_shell)/.test(p.comm) &&
      p.argv.includes('--enable-automation') &&
      commByPid.get(p.ppid) !== 'node',
  )
  for (const orphan of orphans) {
    try {
      process.kill(orphan.pid, 'SIGKILL')
    } catch {
      // already gone between snapshot and kill — fine
    }
  }
  if (orphans.length > 0) {
    console.log(
      `Reaped ${orphans.length} orphaned test browser(s) leaked by prior crashed runs`,
    )
  }
}

async function main() {
  killStaleTestBrowsers()
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

    let backends: RenderingBackend[]
    if (backendValue === 'all') {
      backends = skipWebGPU
        ? ['canvas2d', 'webgl']
        : ['canvas2d', 'webgl', 'webgpu']
    } else {
      backends = [(backendValue ?? 'canvas2d') as RenderingBackend]
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
      if (filters.length > 0) {
        console.log(`(filtering by: ${filters.join(', ')})`)
      }
      if (testFilter) {
        console.log(`(test filter: ${testFilter})`)
      }
      if (smoke) {
        console.log('(smoke test: running all suites including remote)')
      }
      console.log(`(backend: ${backend})`)

      const { passed, failed, failures } = await runWithRenderingBackend(
        suites,
        backend,
      )
      totalPassed += passed
      totalFailed += failed
      for (const f of failures) {
        allFailures.push({ backend: backend, ...f })
      }
    }

    console.log(`\n${'─'.repeat(50)}`)
    console.log(`  Tests: ${totalPassed} passed, ${totalFailed} failed`)
    if (backends.length > 1) {
      console.log(`  RenderingBackends tested: ${backends.join(', ')}`)
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
