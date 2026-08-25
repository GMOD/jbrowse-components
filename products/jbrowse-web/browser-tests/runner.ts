/* eslint-disable no-console */
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'

import {
  BASE_CHROME_ARGS,
  isBrowserConsoleNoise,
} from '@jbrowse/browser-test-utils'
import { launch } from 'puppeteer'

import {
  CI_GATE_SUITES,
  enableCrossBackendCollection,
  formatThresholdPct,
  runCrossBackendGate,
} from './crossBackendGate.ts'
import { BASICAUTH_PORT, OAUTH_PORT, PORT, setPort } from './helpers.ts'
import { buildPath, startServerOnFreePort } from './server.ts'
import { startBasicAuthServer, startOAuthServer } from './servers.ts'
import { ensureGoldens } from './snapshot-store.ts'
import { snapshotConfig, snapshotUpdates } from './snapshot.ts'

import type { TestCase, TestSuite } from './types.ts'
import type { Server } from 'node:http'
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
    // rewrite every golden an --update-snapshots run captures, bypassing the
    // content-stable gate that otherwise keeps a golden whose capture barely moved
    'force-snapshots': { type: 'boolean', default: false },
    auth: { type: 'boolean', default: false },
    // comma-separated and/or repeated: --filter=grape,hs1 or --filter=a --filter=b
    filter: { type: 'string', multiple: true, default: [] },
    test: { type: 'string' },
    smoke: { type: 'boolean', default: false },
    'include-remote': { type: 'boolean', default: false },
    backend: { type: 'string' },
    'skip-webgpu': { type: 'boolean', default: false },
    // Software-render the webgl backend (no GPU needed) — required in CI, whose
    // runners have no GPU. Its opposite is `--real-gpu`, NOT the absence of this
    // flag; see chromeArgsForRenderingBackend.
    swiftshader: { type: 'boolean', default: false },
    // Capture + run the cross-backend gate but skip the golden comparison. The
    // CI-facing mode: goldens are environment-specific, the gate is not.
    'gate-only': { type: 'boolean', default: false },
    // Restrict to the suites the blocking CI job renders (CI_GATE_SUITES) and
    // force remote data off. Scoping, not configuration — it composes with
    // --backend/--swiftshader/--gate-only, so running it on a real GPU locally
    // shows exactly what CI compares.
    'ci-gate': { type: 'boolean', default: false },
    // Print EVERY compared pair's drift instead of the worst five, and change
    // nothing about the verdict. This is what a threshold audit needs
    // (crossBackendGate.ts THRESHOLD_OVERRIDES), and the method documented there
    // was to temporarily zero the thresholds so every pair printed as a failure
    // — which also writes a diff PNG per pair and exits non-zero, so the audit
    // could not be run against a tree you then wanted to test. Reading the
    // distribution and judging it are different jobs; only the second one is the
    // gate's.
    'drift-report': { type: 'boolean', default: false },
    // Force the webgl backend onto the machine's actual GPU. The opposite of
    // --swiftshader, and NOT the same as omitting it — see
    // chromeArgsForRenderingBackend. Pair the two to run the rasterizer test the
    // threshold audit is built on.
    'real-gpu': { type: 'boolean', default: false },
    // Extra attempts for a failing test, each in a fresh browser. Defaults to 1
    // under --ci-gate and 0 otherwise: a hand run wants the failure, a blocking
    // job wants the rare capture race not to block a merge — while still saying
    // out loud that it happened.
    retries: { type: 'string' },
    quiet: { type: 'boolean', default: false },
    debug: { type: 'boolean', default: false },
    firefox: { type: 'string' },
  },
})

const headed = values.headed
// Each unit is a whole Chrome, so this is the heaviest of the three things
// competing for the machine (browser tests, jest, tsgo). Agents get 1 because
// they run concurrently with each other and with their own jest and typecheck,
// and none of those can see the others' load; an interactive run keeps 4.
const CONCURRENCY = values.concurrency
  ? Number(values.concurrency)
  : headed || process.env.CLAUDECODE
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
const ciGate = values['ci-gate']
const driftReport = values['drift-report']
const retries = values.retries ? Number(values.retries) : ciGate ? 1 : 0
// Tests that failed and then passed on a later attempt, for the end-of-run
// report. Never folded into the pass count: the whole value of a retry is that
// it is visible.
const retriedTests: string[] = []
// Auto-enable remote when a filter is specified — no need to also pass
// --include-remote when targeting a specific suite by name. --ci-gate overrides
// that: no push should depend on S3/UCSC being up, and CI_GATE_SUITES listing
// only local suites is not enough on its own, since a *test* inside a listed
// suite can carry requiresRemote of its own.
const includeRemote =
  !ciGate && (values['include-remote'] || smoke || filters.length > 0)
const backendValue = values.backend
const skipWebGPU = values['skip-webgpu']
const swiftshader = values.swiftshader
const realGpu = values['real-gpu']
if (swiftshader && realGpu) {
  console.error('--swiftshader and --real-gpu are mutually exclusive')
  process.exit(1)
}
const gateOnly = values['gate-only']
const quiet = values.quiet
const debug = values.debug
// WebGPU always runs through Firefox Nightly; --firefox=<path> or
// FIREFOX_NIGHTLY_PATH override the default binary location.
const firefoxPath =
  values.firefox ??
  process.env.FIREFOX_NIGHTLY_PATH ??
  '/usr/bin/firefox-nightly'

snapshotConfig.updateSnapshots = updateSnapshots
snapshotConfig.forceSnapshots = values['force-snapshots']
snapshotConfig.gateOnly = gateOnly

type RenderingBackend = 'webgl' | 'webgpu' | 'canvas2d'

function chromeArgsForRenderingBackend(backend?: RenderingBackend) {
  const chromeArgs = [...BASE_CHROME_ARGS, '--disable-popup-blocking']
  // With neither flag the webgl backend takes whatever Chrome picks, which
  // headless is SwiftShader — see the --real-gpu branch below, and don't read
  // "no --swiftshader" as "real GPU". webgpu does not use Chrome at all
  // (it requires Firefox Nightly, see runWithRenderingBackend), so neither needs
  // extra chrome flags. --swiftshader forces the webgl backend to software-render
  // so it can run on a GPU-less CI runner; modern Chrome needs
  // --enable-unsafe-swiftshader to allow a WebGL context on SwiftShader.
  if (backend === 'canvas2d') {
    chromeArgs.push('--disable-gpu')
  } else if (swiftshader) {
    chromeArgs.push('--use-gl=swiftshader', '--enable-unsafe-swiftshader')
  } else if (realGpu) {
    // **Headless Chrome does NOT pick the machine's GPU on its own.** Measured
    // 2026-08-11 via WEBGL_debug_renderer_info, on a box with two real GPUs:
    //
    //   (no flags)              ANGLE (Google, Vulkan 1.3.0 (SwiftShader …))
    //   --use-gl=swiftshader    ANGLE (Google, Vulkan 1.3.0 (SwiftShader …))
    //   --use-gl=angle          ANGLE (Intel, Mesa Intel(R) UHD Graphics 630)
    //
    // So "run it again without --swiftshader" — which is how the threshold
    // audit in crossBackendGate.ts describes getting a second rasterizer —
    // silently compares SwiftShader against SwiftShader when run headless, and
    // the two figures then agree for a reason that has nothing to do with the
    // renderer. That is a check that passes by proving nothing, and the audit's
    // whole decision rule ("identical across rasterizers ⇒ not antialiasing")
    // rests on the comparison being real. `--real-gpu` makes it real without
    // needing --headed (which also forces concurrency 1 and a display).
    chromeArgs.push('--use-gl=angle')
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
  // Exact match, unlike --filter's substring: the CI list is a contract about
  // what CI compares, and a substring that stops matching after a rename would
  // shrink it silently. checkCiGateSuites turns that into a hard failure.
  const ciOk = !ciGate || CI_GATE_SUITES.includes(suite.name)
  return authOk && remoteOk && filterOk && ciOk
}

// A name in CI_GATE_SUITES that matches nothing is coverage that vanished — a
// renamed or deleted suite leaves the job green while rendering less. Fail the
// run instead, naming what went missing.
function checkCiGateSuites(suites: TestSuite[]) {
  const discovered = new Set(suites.map(s => s.name))
  const missing = CI_GATE_SUITES.filter(n => !discovered.has(n))
  if (missing.length > 0) {
    console.error(
      `\nCI_GATE_SUITES names ${missing.length} suite(s) that no longer exist:`,
    )
    for (const n of missing) {
      console.error(`    ✗ ${n}`)
    }
    console.error(
      'Renamed? Update crossBackendGate.ts CI_GATE_SUITES to match, so the ' +
        'blocking gate keeps rendering what it claims to.\n',
    )
    return false
  }
  return true
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
// never returns to the OS (see agent-docs/reference/TEST_INFRASTRUCTURE.md), and
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
        let error = await runOneTest(
          launchBrowser,
          item.suite.name,
          item.test,
          progress,
        )
        // A second attempt, in a FRESH browser and page. The capture race this
        // exists for is per-page and load-sensitive, so a whole-test re-run is
        // the retry that has no shared state to go wrong: the reverted capture
        // retry (cb2f8524fd) re-took the screenshot inside the same page and
        // turned diagnosable failures into "Node is detached from document".
        // Nothing is reused here — new browser, new page, the selector waited
        // for again from scratch.
        //
        // Loud on purpose, and counted separately from `passed`: a retry that
        // succeeds is still evidence of the defect, and a quiet one would let
        // the rate climb unnoticed. Only test failures are retried — a
        // cross-backend drift verdict is computed once, after every test, and
        // is never retried away.
        for (
          let attempt = 2;
          error !== undefined && attempt <= 1 + retries;
          attempt++
        ) {
          console.log(
            `    ↻ ${progress} retrying ${item.suite.name} > ${item.test.name} (attempt ${attempt}/${1 + retries})`,
          )
          error = await runOneTest(
            launchBrowser,
            item.suite.name,
            item.test,
            progress,
          )
          if (error === undefined) {
            retriedTests.push(`${item.suite.name} > ${item.test.name}`)
          }
        }
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
    const type = msg.type()
    if (quiet && type !== 'error') {
      return
    }
    // isBrowserConsoleNoise already covers favicon + GPU-stall chatter; a second
    // copy of those needles ahead of this check made `--debug` unable to
    // unsuppress them, which is the one thing the flag is for.
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
  //
  // MAIN PROCESSES ONLY. Chrome forwards `--enable-automation` to every
  // renderer, and a renderer's parent is the zygote (`chrome`), never `node` —
  // so without the `--type=` test this killed the live renderers of every
  // browser another agent's run had open, each time a runner started. That
  // surfaced there as `Target closed` and `Attempted to use detached Frame`
  // some seconds into a page, with no crash event and nothing naming the cause
  // (2026-08-25). A main process carries no `--type=`.
  const orphans = procs.filter(
    p =>
      /^(chrome|chromium|headless_shell)/.test(p.comm) &&
      p.argv.includes('--enable-automation') &&
      !p.argv.some(a => a.startsWith('--type=')) &&
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
  // index.html, not just the directory: `pnpm build` empties `build/` and
  // writes index.html near the end, so a run that starts while someone else in
  // this worktree is rebuilding finds the directory present and the entry point
  // gone. The static server then answers `/` with a directory listing, every
  // navigation "succeeds", and the tests photograph the file index — which
  // under `--update-snapshots` is written straight into the goldens, since an
  // update run never compares. Two goldens were corrupted that way on
  // 2026-08-04 before the capture guard in snapshot.ts existed.
  if (!fs.existsSync(path.join(buildPath, 'index.html'))) {
    console.error(
      fs.existsSync(buildPath)
        ? 'Error: build/index.html is missing. A build is probably in progress — wait for it to finish and re-run.'
        : 'Error: Build directory not found. Run `pnpm build` in products/jbrowse-web first.',
    )
    process.exit(1)
  }

  // Goldens are not in git — the bytes live in S3 and snapshots.lock is what is
  // tracked (snapshot-store.ts). Installing them here rather than asking the
  // reader to remember a command, the same way `pnpm dev` pulls figures.
  //
  // NOT under --gate-only, which is CI's mode: it never opens a golden, so a
  // pull there would download 31 MB for nothing on every run. Not under
  // --update-snapshots either — that run WRITES goldens, and the content-stable
  // gate compares against whatever is on disk, so a pull first is only useful
  // if the disk is missing them, which `ensureGoldens` decides for itself.
  if (!gateOnly) {
    await ensureGoldens()
  }

  console.log('Starting test server...')
  // published before anything builds a url, including the OAuth redirect below
  const { server, port } = await startServerOnFreePort(PORT)
  setPort(port)
  if (port !== 3333) {
    console.log(`(default port was taken; serving on ${port})`)
  }

  let oauthServer: Server | undefined
  let basicAuthServer: Server | undefined

  try {
    if (runAuthTests) {
      console.log('Starting auth servers...')
      oauthServer = await startOAuthServer({
        port: OAUTH_PORT,
        redirectPort: port,
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
    if (ciGate && !checkCiGateSuites(suites)) {
      process.exit(1)
    }

    let backends: RenderingBackend[]
    if (backendValue === 'all') {
      backends = skipWebGPU
        ? ['canvas2d', 'webgl']
        : ['canvas2d', 'webgl', 'webgpu']
    } else {
      backends = [(backendValue ?? 'canvas2d') as RenderingBackend]
    }

    // A multi-backend run doubles as a differential-correctness check: collect
    // each backend's captures in memory so they can be diffed against each other
    // once all backends have rendered (see the gate after the loop).
    if (backends.length > 1) {
      enableCrossBackendCollection()
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
    if (updateSnapshots) {
      // Say what moved. A sweep that reports nothing reads the same whether it
      // rewrote two goldens or two hundred.
      console.log(
        `  Snapshots: ${snapshotUpdates.length} written, the rest unchanged${
          values['force-snapshots'] ? ' (gate forced off)' : ''
        }`,
      )
      for (const u of [...snapshotUpdates]
        .sort((a, b) => (b.pct ?? 1) - (a.pct ?? 1))
        .slice(0, 20)) {
        const how =
          u.pct === null ? 'new/resized' : `${(u.pct * 100).toFixed(2)}%`
        console.log(`    • ${u.name} (${how})`)
      }
      if (snapshotUpdates.length > 20) {
        console.log(`    …and ${snapshotUpdates.length - 20} more`)
      }
    }
    console.log(`  Tests: ${totalPassed} passed, ${totalFailed} failed`)
    if (retriedTests.length > 0) {
      console.log(
        `  Passed only on a retry: ${retriedTests.length}` +
          ` (${[...new Set(retriedTests)].join(', ')})`,
      )
    }
    if (backends.length > 1) {
      console.log(`  RenderingBackends tested: ${backends.join(', ')}`)
    }
    if (allFailures.length > 0) {
      // These used to be informational under --gate-only, on the reasoning that
      // the gate was the pass/fail authority and interaction brittleness would
      // otherwise keep CI red. The parenthetical in that comment — "which
      // produce no snapshot for the gate to compare" — is why the conclusion is
      // backwards: a test that produces no snapshot doesn't leave the verdict
      // intact, it removes a pair from it, and the gate skips (never fails) a
      // snapshot only one backend captured. Brittleness that quietly shrinks
      // the comparison is worse for a blocking gate than brittleness that
      // fails it, because only one of the two is visible.
      console.log(`\n  Failed tests:`)
      for (const f of allFailures) {
        const prefix = backends.length > 1 ? `[${f.backend}] ` : ''
        console.log(`    ✗ ${prefix}${f.suite} > ${f.test}`)
        console.log(`      ${f.error}`)
      }
    }
    console.log(`${'─'.repeat(50)}\n`)

    // Differential-correctness gate: diff the in-memory captures across backends
    // and fail the run if any pair drifts past its threshold. Independent of the
    // committed goldens, so it can't be fooled by stale per-backend dirs (the
    // failure mode of the disk-based compare-backends.ts, still available via
    // `pnpm test:browser:compare` for local visual review).
    let crossBackendFailed = false
    if (backends.length > 1) {
      const {
        failures,
        drifts,
        compared,
        skipped,
        skippedNames,
        excluded,
        diffDir,
      } = runCrossBackendGate()
      console.log(
        `Cross-backend gate: ${compared} pair(s) compared, ${failures.length} over threshold${
          skipped > 0 ? `, ${skipped} single-backend (uncompared)` : ''
        }${excluded > 0 ? `, ${excluded} excluded (nondeterministic layout)` : ''}`,
      )
      // List every failure (over threshold or size-mismatch), then the worst few
      // *passing* drifts so each run also shows how much headroom the noise floor
      // has under the thresholds.
      for (const f of failures) {
        console.log(`    ✗ ${f.name} [${f.pair}]: ${f.detail}`)
      }
      // Name what went uncompared. This is the gate's coverage loss, and it is
      // the number to read alongside "0 over threshold" — a clean verdict over
      // a shrunken comparison is not the same result.
      for (const n of skippedNames) {
        console.log(`    ? uncompared: ${n}`)
      }
      const passing = drifts.filter(d => d.pct <= d.threshold * 100)
      // --drift-report wants the whole distribution, because the question it
      // answers is "where could the threshold go", and the answer is set by the
      // shape of the tail rather than by its worst member.
      for (const d of driftReport ? passing : passing.slice(0, 5)) {
        console.log(
          `    · ${d.name} [${d.pair}]: ${d.pct.toFixed(2)}% (threshold ${formatThresholdPct(d.threshold)}%)`,
        )
      }
      if (driftReport && passing.length > 0) {
        // The margin in one line, so two runs can be compared without diffing
        // sixty. Under swiftshader these figures have been byte-identical run to
        // run, so a moving max is itself the finding.
        const pcts = passing.map(d => d.pct)
        const over = (n: number) => pcts.filter(p => p > n).length
        console.log(
          `\n  drift-report: ${pcts.length} passing pair(s), max ${Math.max(...pcts).toFixed(2)}%, ` +
            `median ${pcts.toSorted((a, b) => a - b)[pcts.length >> 1]!.toFixed(2)}% — ` +
            `over 0.5%: ${over(0.5)}, over 1%: ${over(1)}, over 2%: ${over(2)}`,
        )
      }
      if (failures.length > 0) {
        crossBackendFailed = true
        console.log(`\n  Backend diff images: ${diffDir}`)
      }
      // Under --ci-gate an uncompared pair is a failure too, not a note. Every
      // structurally single-backend case (gpu-quirks' context-loss test) is
      // outside CI_GATE_SUITES, so within that list a snapshot only one backend
      // captured means one side didn't get there — the coverage loss the whole
      // "0 over threshold across 130 pairs, then 149" episode was about. Hand
      // runs keep the softer behaviour, where the printed list is enough.
      if (ciGate && skipped > 0) {
        crossBackendFailed = true
        console.log(
          `\n  ${skipped} snapshot(s) reached only one backend — under --ci-gate that fails the run.`,
        )
      }
      console.log(`${'─'.repeat(50)}\n`)
    }

    // `--gate-only` suppresses the GOLDEN comparison, not the test run. That
    // distinction decides this line: compareImages calls recordCapture before
    // its gate-only early return, so a stale golden costs the gate nothing,
    // and every failure still standing in gate-only mode is one that happened
    // BEFORE the screenshot — a selector timeout, a failed navigation, a blank
    // canvas. Each of those silently removes that snapshot from the pairing,
    // and a single-backend snapshot is skipped rather than failed.
    //
    // So a failing test degrades the gate's coverage instead of its verdict,
    // and ignoring totalFailed here let a run report "0 over threshold" having
    // compared fewer pairs than the run before it (measured 2026-08-04:
    // 148/130/149 pairs over three runs, the 130 reporting clean). A gate that
    // passes by checking less is the one failure mode a blocking gate cannot
    // have — see agent-docs/reference/CROSS_BACKEND_GATE.md.
    const failRun = totalFailed > 0 || crossBackendFailed
    process.exit(failRun ? 1 : 0)
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
