/* eslint-disable no-console */
import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import { parseArgs } from 'util'

import {
  BASE_CHROME_ARGS,
  isBrowserConsoleNoise,
} from '@jbrowse/browser-test-utils'
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

// `--firefox` (bare) is a legacy no-op: WebGPU always uses Firefox Nightly and
// the binary path already defaults via FIREFOX_NIGHTLY_PATH. Strip it before
// parsing so strict parseArgs doesn't reject it; `--firefox=<path>` still works.
const rawArgs = process.argv.slice(2).filter(a => a !== '--firefox')
// Strict parsing rejects unknown flags (so a typo'd `--fliter` fails loudly
// instead of silently running every suite) and accepts both `--x=y` and `--x y`.
const { values } = parseArgs({
  args: rawArgs,
  allowPositionals: false,
  options: {
    headed: { type: 'boolean', default: false },
    concurrency: { type: 'string' },
    'slow-mo': { type: 'string' },
    'update-snapshots': { type: 'boolean', short: 'u', default: false },
    auth: { type: 'boolean', default: false },
    // comma-separated and/or repeated: --filter=grape,hs1 or --filter=a --filter=b
    filter: { type: 'string', multiple: true, default: [] },
    test: { type: 'string' },
    smoke: { type: 'boolean', default: false },
    'include-remote': { type: 'boolean', default: false },
    backend: { type: 'string' },
    'skip-webgpu': { type: 'boolean', default: false },
    quiet: { type: 'boolean', default: false },
    debug: { type: 'boolean', default: false },
    firefox: { type: 'string' },
  },
})

const headed = values.headed
const CONCURRENCY = values.concurrency
  ? Number(values.concurrency)
  : headed
    ? 1
    : 4
const slowMo = values['slow-mo'] ? parseInt(values['slow-mo'], 10) : 0
const updateSnapshots = values['update-snapshots']
const runAuthTests = values.auth
// Matching is case-insensitive substring against suite name.
const filters = values.filter
  .flatMap(f => f.toLowerCase().split(','))
  .filter(Boolean)
// --test filters individual test cases within matched suites (substring match).
const testFilter = values.test?.toLowerCase() ?? ''
// --smoke runs every suite including the requiresRemote ones (grape/peach +
// hs1/mm39 synteny), whose data is fetched straight from S3/UCSC at runtime.
const smoke = values.smoke
// Auto-enable remote when a filter is specified — no need to also pass
// --include-remote when targeting a specific suite by name.
const includeRemote = values['include-remote'] || smoke || filters.length > 0
const backendValue = values.backend
const skipWebGPU = values['skip-webgpu']
const quiet = values.quiet
const debug = values.debug
// WebGPU always runs through Firefox Nightly; --firefox=<path> or
// FIREFOX_NIGHTLY_PATH override the default binary location.
const firefoxPath =
  values.firefox ??
  process.env.FIREFOX_NIGHTLY_PATH ??
  '/usr/bin/firefox-nightly'

snapshotConfig.updateSnapshots = updateSnapshots

type RenderingBackend = 'webgl' | 'webgpu' | 'canvas2d'

function chromeArgsForRenderingBackend(backend?: RenderingBackend) {
  const chromeArgs = [...BASE_CHROME_ARGS, '--disable-popup-blocking']
  // webgl runs on the machine's real GPU (run headed) — no swiftshader, whose
  // per-context memory growth is why we moved off it (see
  // agent-docs/TEST_INFRASTRUCTURE.md). webgpu does not use Chrome at all
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
  const getElapsed = () =>
    `+${((performance.now() - start) / 1000).toFixed(1)}s`
  process.stdout.write(`    ⏳ ${progress} ${suiteName} > ${test.name}...`)

  let browser: Browser | undefined
  let error: string | undefined
  try {
    browser = await launchBrowser()
    const page = await setupPage(browser, getElapsed)
    await test.fn(page, browser)
    clearProgressLine()
    console.log(
      `    ✓ ${progress} ${suiteName} > ${test.name} (${Math.round(performance.now() - start)}ms)`,
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
// never returns to the OS (see agent-docs/TEST_INFRASTRUCTURE.md), and
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

  // Flatten all (suite, test) pairs into a single queue so the worker pool
  // can drain across suite boundaries, maximizing browser slot utilization.
  const queue: { suite: TestSuite; test: TestCase }[] = []
  for (const suite of suitesToRun) {
    for (const test of suite.tests) {
      const skip = testSkipReason(test, includeAuth)
      const filteredOut =
        testFilter && !test.name.toLowerCase().includes(testFilter)
      if (skip) {
        console.log(`    ⚡ ${suite.name} > ${test.name} (skipped — ${skip})`)
      } else if (!filteredOut) {
        queue.push({ suite, test })
      }
    }
  }

  const total = queue.length
  // Monotonic counter of tests started, for a meaningful [n/total] readout —
  // the worker pool drains across suites, so a per-suite index would jump
  // around non-monotonically.
  let started = 0
  const workers = Array.from(
    { length: Math.min(CONCURRENCY, total || 1) },
    async () => {
      while (queue.length > 0) {
        const item = queue.shift()!
        const progress = `[${++started}/${total}]`
        const error = await runOneTest(
          launchBrowser,
          item.suite.name,
          item.test,
          progress,
        )
        if (error === undefined) {
          passed++
        } else {
          failed++
          failures.push({
            suite: item.suite.name,
            test: item.test.name,
            error,
          })
        }
      }
    },
  )
  await Promise.all(workers)

  return { passed, failed, failures }
}

async function setupPage(browser: Browser, getElapsed: () => string) {
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
    if (!debug && isBrowserConsoleNoise(text)) {
      return
    }
    const prefix = `  [${getElapsed()}] Browser:`
    if (type === 'error') {
      console.error(prefix, text)
    } else if (type === 'warn') {
      console.warn(prefix, text)
    } else {
      console.log(prefix, text)
    }
  })
  page.on('pageerror', err => {
    if (err instanceof Error) {
      console.error(`  [${getElapsed()}] PageError:`, err.stack || err.message)
    } else {
      console.error(`  [${getElapsed()}] PageError:`, err)
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
  const useFirefox = backend === 'webgpu'
  const useHeadless = useFirefox ? false : !headed

  const launchBrowser = useFirefox
    ? () =>
        launch({
          browser: 'firefox',
          executablePath: firefoxPath,
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
    console.log(`  Using Firefox Nightly: ${firefoxPath}`)
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
      'Error: Build directory not found. Run `pnpm build` in products/jbrowse-web first.',
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
      console.log(`(backend: ${backend}, concurrency: ${CONCURRENCY})`)

      const { passed, failed, failures } = await runWithRenderingBackend(
        suites,
        backend,
      )
      totalPassed += passed
      totalFailed += failed
      for (const f of failures) {
        allFailures.push({ backend, ...f })
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
