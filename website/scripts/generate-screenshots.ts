import { execFile, execFileSync } from 'node:child_process'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs, promisify } from 'node:util'

import {
  BASE_CHROME_ARGS,
  createTestServer,
  findChromeExecutable,
  isBrowserConsoleNoise,
  waitForDisplayPhases,
  waitForDisplaysDone,
  waitForLoadingComplete,
  waitForQuiescent,
  waitForViewPhases,
} from '@jbrowse/browser-test-utils'
import { launch } from 'puppeteer'

import { delay, runAction, textSelector, waitForVisible } from './actions.ts'
import {
  clearAnnotations,
  drawAnnotations,
  hideLingeringTooltip,
} from './annotations.ts'
import {
  IM,
  commitScreenshot,
  optimizePng,
  pngDiffFraction,
  trailingBackgroundPx,
} from './image-pipeline.ts'
import {
  matchesFilterTokens,
  parseFilterTokens,
  specs,
} from './screenshot-specs.ts'

import type { CommitResult } from './image-pipeline.ts'
import type {
  Annotation,
  BrowserScreenshotSpec,
  CliSpec,
  ComposeSpec,
  EmbeddedSpec,
  ScreenshotAction,
  ScreenshotSpec,
  ScreenshotStage,
  SessionUrlSpec,
} from './screenshot-specs.ts'
import type { Server } from 'node:http'
import type { Page } from 'puppeteer'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const execFileAsync = promisify(execFile)

// Strict parsing rejects unknown flags (a typo'd `--fliter` fails loudly
// instead of silently screenshotting every spec) and accepts `--x=y` or `--x y`.
const { values } = parseArgs({
  args: process.argv.slice(2),
  allowPositionals: false,
  options: {
    help: { type: 'boolean', short: 'h', default: false },
    headed: { type: 'boolean', default: false },
    // multiple, so `--filter a --filter b` unions rather than keeping only b
    filter: { type: 'string', short: 'f', multiple: true },
    exact: { type: 'boolean', default: false },
    // point the proxy at an already-running app server instead of build/
    port: { type: 'string' },
    localport: { type: 'string' },
    concurrency: { type: 'string' },
    // render with the Firefox backend instead of Chrome (some WebGL/molstar
    // content rasterizes more cleanly under headless Firefox than headless
    // Chrome's swiftshader)
    firefox: { type: 'boolean', default: false },
    // overwrite every PNG, bypassing the content-stable diff gate
    force: { type: 'boolean', default: false },
    // render each spec twice and fail if the two captures drift past threshold,
    // without touching committed PNGs — a CI guard against newly-flaky specs
    check: { type: 'boolean', default: false },
    // fraction-of-pixels diff below which a re-render keeps the committed PNG
    'diff-threshold': { type: 'string' },
  },
})

// Parse a numeric CLI option, returning undefined when absent. A present but
// unparsable value exits rather than falling back to the default: the same
// reason parseArgs is strict about unknown flags — `--diff-threshold .5%` or
// `--concurrency 4x` otherwise runs the whole suite under the default and
// reports success, which is indistinguishable from the flag having worked.
function optNum(name: string, raw: string | undefined) {
  if (raw === undefined) {
    return undefined
  }
  const n = Number(raw)
  if (!Number.isFinite(n)) {
    console.error(`--${name} expects a number, got "${raw}"`)
    process.exit(1)
  }
  return n
}

const { headed, filter, exact, force, check, firefox } = values
// With dithering disabled (see optimizePng) flat-UI specs re-render byte-for-
// byte, but text-heavy specs still drift ~0.2% from headless-Chrome sub-pixel
// glyph-positioning jitter (ruler/track labels, SNP ticks render a hair
// differently run-to-run). 0.5% absorbs that with ~2.5x margin while still
// letting a genuine edit — a new legend, a moved element — through. Raise it
// further for timing/remote-data specs.
const DEFAULT_DIFF_THRESHOLD = 0.005
const DEFAULT_LOCAL_PORT = 3334
// Captures are hidpi, so an image pixel is half a CSS pixel.
const DEVICE_SCALE_FACTOR = 2
// Blank page background under a figure's content, in image pixels, past which
// the run reports the spec's viewportHeight as stale. ~50 CSS px is below what
// reads as a framing choice and above the few px of margin every capture has.
const SLACK_WARN_PX = 100
// CSS px of page below the viewport, past which the capture is cutting off
// content rather than framing it. A few px is normal rounding; a clipped track
// row is tens.
const CLIP_WARN_PX = 8
const diffThreshold =
  optNum('diff-threshold', values['diff-threshold']) ?? DEFAULT_DIFF_THRESHOLD
const externalPort = optNum('port', values.port)
const servePort = optNum('localport', values.localport) ?? DEFAULT_LOCAL_PORT
// Math.max(1, …) so `--concurrency 0` can't spin up zero workers and silently
// skip every render spec while still exiting 0.
//
// --check defaults to serial so a drift report has one fewer confound: with four
// browsers sharing CPU and network, "this spec is flaky" and "the machine was
// busy" are indistinguishable. It is explicitly NOT a fix for flakiness —
// alignments_sort_by_base still drifts 17% in roughly half of serial runs, and
// multiwig/addtrack has gone both 0.000% and 0.7% serially. Both are real,
// unexplained, and predate this default. Pass --concurrency for wall-clock.
const CONCURRENCY = Math.max(
  1,
  optNum('concurrency', values.concurrency) ?? (headed || check ? 1 : 4),
)

// Plugin urls a hosted demo config may declare, pre-approved for the capture so
// the cross-origin warning modal never covers the app. See trustCapturePlugins:
// this is scoped to the capture's own localhost origin and vouches for nothing
// beyond it. Keep it an explicit list rather than "trust everything", so a
// config that starts pulling an unexpected plugin still fails loudly.
const TRUSTED_PLUGIN_URLS = [
  'https://jbrowse.org/demos/graphgenomeviewer/jbrowse-plugin-graphgenomeviewer.esm.js',
]

const HELP = `Render website screenshots from scripts/screenshot-specs.ts.

Usage: pnpm generate-screenshots [options]

Options:
  -h, --help              Show this help and exit
  -f, --filter <a,b,c>    Only render specs whose name matches any token
                          (substring match; see --exact). Repeatable; every
                          occurrence's tokens are unioned
      --exact             Make --filter tokens match spec names exactly
      --force             Overwrite every PNG, bypassing the content-stable
                          diff gate
      --check             Render each spec twice and report specs that drift
                          past the threshold; commits nothing
      --firefox           Render with the Firefox backend instead of Chrome
      --headed            Run a visible browser (defaults --concurrency to 1)
      --concurrency <n>   Browsers to run at once (default: 4; 1 if --headed or
                          --check, where parallelism reads as spec flakiness)
      --diff-threshold <f>  Pixel-diff fraction below which a re-render keeps
                          the committed PNG (default: ${DEFAULT_DIFF_THRESHOLD})
      --port <n>          Proxy to an app server already running on this port
                          instead of serving products/jbrowse-web/build
      --localport <n>     Port to serve/proxy on (default: ${DEFAULT_LOCAL_PORT})

Examples:
  pnpm generate-screenshots
  pnpm generate-screenshots --filter lgv_pileup,dotplot
  pnpm generate-screenshots --check --filter dotplot
  pnpm generate-screenshots --force
`

if (values.help) {
  console.log(HELP)
  process.exit(0)
}

const repoRoot = path.resolve(__dirname, '..', '..')
const buildPath = path.resolve(repoRoot, 'products', 'jbrowse-web', 'build')
const testDataRoot = path.resolve(repoRoot, 'products', 'jbrowse-web')
const outDir = path.resolve(__dirname, '..', 'static', 'img')
// jb2export (the @jbrowse/img CLI) renders the products/jbrowse-img/README
// example images straight to PNG via React SSR — no browser involved, so
// CliSpecs bypass the puppeteer pipeline entirely and land here instead of
// outDir. Run from source via tsx (not the npm-installed `jb2export` binary)
// so a local edit to products/jbrowse-img/src is reflected immediately.
const jbrowseImgDir = path.resolve(repoRoot, 'products', 'jbrowse-img')
const jbrowseImgOutDir = path.join(jbrowseImgDir, 'img')
const jb2exportBin = path.join(jbrowseImgDir, 'src', 'bin.ts')
const repoTsconfig = path.join(repoRoot, 'tsconfig.json')
// Prebuilt UMD of the embedded LGV component, used by `mode:'embedded'` specs.
// Built by `pnpm --filter @jbrowse/react-linear-genome-view2 build:webpack`.
const EMBED_UMD_PATH = path.resolve(
  repoRoot,
  'products',
  'jbrowse-react-linear-genome-view',
  'dist',
  'react-linear-genome-view.umd.production.min.js',
)
// Maximum time to wait for canvas displays to signal paint-complete via their
// *-done testids. Acts as a timeout (proceed if it expires), not a fixed floor.
const DEFAULT_SETTLE_MS = 2500
// Default ceiling for the ready-selector / loading-overlay / quiescent waits.
// Slow remote-data specs raise it via spec.readyTimeout.
const DEFAULT_READY_TIMEOUT_MS = 30000

// Build a per-process temp PNG path for a spec, sanitizing '/' in the name and
// tagging with the pid (and an optional suffix) so concurrent workers and the
// two captures of a --check run never collide on one path.
function tempPath(prefix: string, name: string, suffix = '') {
  return path.join(
    os.tmpdir(),
    `${prefix}-${process.pid}-${name.replaceAll('/', '_')}${suffix}.png`,
  )
}

// The ceiling for every wait a spec is subject to. readyText is only the track
// label (present well before a slow remote BAM finishes), so a spec that says it
// needs longer gets that everywhere — the fixed default otherwise cut off slow
// whole-genome-alignment blocks mid-load and captured a "Loading" panel.
function readyTimeoutOf(spec: BrowserScreenshotSpec) {
  return spec.readyTimeout ?? DEFAULT_READY_TIMEOUT_MS
}

// One round of the post-first-paint settle: nothing is drawing, every canvas
// display has painted, and no display is still in its `loading` phase. Each keys
// off a different signal, and none is sufficient alone — see the waits' own docs
// in @jbrowse/browser-test-utils.
async function settlePass(page: Page, spec: BrowserScreenshotSpec) {
  await waitForQuiescent(page, { timeout: readyTimeoutOf(spec) })
  await waitForDisplaysDone(page, spec.settleMs ?? DEFAULT_SETTLE_MS)
  await waitForDisplayPhases(page, readyTimeoutOf(spec))
}

// Wait out a spec's readiness signals before capture: its readyText/readySelector
// become visible, the loading overlay clears, any in-track "Loading…"/"Rendering…"
// indicator quiesces, and canvas displays signal paint-complete.
async function waitForReady(page: Page, spec: SessionUrlSpec | EmbeddedSpec) {
  const readyTimeout = readyTimeoutOf(spec)
  const readySelectors = [
    spec.readyText ? textSelector(spec.readyText) : undefined,
    spec.readySelector,
  ].filter((s): s is string => s !== undefined)
  try {
    // first: while a view reads data-view-phase=loading it has mounted no
    // displays, so the spec's own ready selector and every display-level signal
    // below are all silent, and a capture would land on a bare spinner
    if (!spec.allowUnsettled) {
      await waitForViewPhases(page, readyTimeout)
    }
    for (const selector of readySelectors) {
      await waitForVisible(page, selector, { timeout: readyTimeout })
    }
    // the loading-overlay wait is the one that hard-fails on a view that never
    // finishes; quiescent/displays-done are best-effort by design
    await waitForLoadingComplete(page, {
      waitForDownloads: true,
      timeout: readyTimeout,
    })
  } catch (e) {
    await debugDump(page, spec.name)
    throw e
  }
  await settlePass(page, spec)
  // Belt and braces for the displays that publish no phase (non-LGV views, and
  // anything not routed through DisplayChrome): re-run while an overlay is still
  // up. Bounded, so a view that never finishes fails through assertRenderSettled
  // with a frame to look at instead of hanging here.
  for (let pass = 0; pass < 2; pass++) {
    const stillLoading = await page.evaluate(
      () =>
        document.querySelectorAll('[data-testid="loading-overlay"]').length > 0,
    )
    if (!stillLoading) {
      break
    }
    await waitForLoadingComplete(page, {
      waitForDownloads: true,
      timeout: readyTimeout,
    })
    await settlePass(page, spec)
  }
}

// Guard against capturing a view that rendered no content. The ViewContainer
// always renders its header chrome, so a screenshot with header-but-empty-body
// (e.g. a render regression) still "succeeds" and slips through review. A
// healthy view — including an import form — fills its body, so an empty body
// uniquely signals a broken render.
async function assertViewsRendered(page: Page, name: string) {
  const emptyViews = await page.evaluate(() =>
    Array.from(
      document.querySelectorAll<HTMLElement>(
        '[data-testid^="view-container-"]',
      ),
    )
      .filter(c => {
        const body = c.lastElementChild
        return !body || body.childElementCount === 0
      })
      .map(c => c.dataset.testid ?? '?'),
  )
  if (emptyViews.length > 0) {
    await debugDump(page, name)
    throw new Error(`view(s) rendered blank: ${emptyViews.join(', ')}`)
  }
}

// Guard against silently saving a half-rendered capture: at shoot time no
// display should still show a *visible* loading overlay, an error banner, or a
// region-too-large message. These slip past the readiness waits when a fetch
// starts after them (the FetchVisibleRegions autorun debounces ~600ms, so
// waitForLoadingComplete can pass before the overlay even appears) or when a
// worker RPC errors/hangs — exactly the states that otherwise render as an
// unnoticed "Loading" PNG. Detection mirrors waitForQuiescent's visibility rules
// (an element counts only if it and its ancestors aren't display:none /
// visibility:hidden / opacity:0 / zero-size) so the opacity-hidden idle overlay
// doesn't false-positive. Opt out per spec with `allowUnsettled` when the state
// IS the subject.
//
// Deliberately keyed off test-ids and TooLargeMessage's own literal rather than
// waitForQuiescent's /^(loading|rendering|…)/ pattern: that pattern is safe for a
// *wait* (a false match only costs a swallowed timeout) but not for an assertion
// — the open track menu's "Rendering mode" item matches it, which failed the
// trio-matrix specs while catching nothing real across the suite.
async function assertRenderSettled(page: Page, spec: BrowserScreenshotSpec) {
  const problems = await page.evaluate(() => {
    const isVisible = (el: Element) => {
      let cur: Element | null = el
      while (cur) {
        const s = getComputedStyle(cur)
        if (
          s.display === 'none' ||
          s.visibility === 'hidden' ||
          Number(s.opacity) === 0
        ) {
          return false
        }
        cur = cur.parentElement
      }
      const r = el.getBoundingClientRect()
      return r.width > 0 && r.height > 0
    }
    const found: { kind: string; text: string }[] = []

    // a view still waiting on its assembly / init navigation paints a spinner in
    // place of its whole body (ViewContainer: data-view-phase)
    for (const el of document.querySelectorAll('[data-view-phase="loading"]')) {
      if (isVisible(el)) {
        found.push({
          kind: 'view-loading',
          text: (el as HTMLElement).innerText.slice(0, 200),
        })
      }
    }
    // loading overlay (LoadingOverlay: data-testid="loading-overlay")
    for (const el of document.querySelectorAll(
      '[data-testid="loading-overlay"]',
    )) {
      if (isVisible(el)) {
        found.push({
          kind: 'loading-overlay',
          text: (el as HTMLElement).innerText.slice(0, 200),
        })
      }
    }
    // error banner (ErrorBar renders a data-testid="reload_button")
    for (const el of document.querySelectorAll(
      '[data-testid="reload_button"]',
    )) {
      if (isVisible(el)) {
        // the retry button sits in the Alert's action slot, whose own div holds
        // only buttons — climb to the Alert itself or the message is empty
        const bar = el.closest('[role="alert"]') ?? el.closest('div') ?? el
        found.push({
          kind: 'error-banner',
          text: (bar as HTMLElement).innerText.slice(0, 300),
        })
      }
    }
    // error snackbar (session.notifyError -> SnackbarContents, which tags its
    // Alert data-testid="snackbar-<level>"). A different surface from the
    // ErrorBar above, and it carries no reload_button, so a view that failed to
    // *launch* used to capture a blank page and report success: two
    // BreakpointSplitView figures that passed their panels under `init` instead
    // of `views` shipped as empty sessions before this check existed. Warnings
    // are not failures; only the error level is.
    for (const el of document.querySelectorAll(
      '[data-testid="snackbar-error"]',
    )) {
      if (isVisible(el)) {
        found.push({
          kind: 'error-snackbar',
          text: (el as HTMLElement).innerText.slice(0, 300),
        })
      }
    }

    // region-too-large message (TooLargeMessage's BlockMsg carries no test-id, so
    // key off its own literal); own text nodes only, so the wrapping Alert and
    // every ancestor up to body don't each report the same message
    for (const el of document.querySelectorAll('body *')) {
      const own = Array.from(el.childNodes)
        .filter(n => n.nodeType === Node.TEXT_NODE)
        .map(n => n.textContent ?? '')
        .join('')
        .trim()
      if (
        own.toLowerCase().includes('force load (may be slow)') &&
        isVisible(el)
      ) {
        found.push({ kind: 'region-too-large', text: own.slice(0, 200) })
      }
      // a view stuck before its tracks mount paints a bare "Loading" with no
      // overlay test-id at all — that shipped a blank capture once. Anchor the
      // whole text so a menu item ("Rendering mode") can't match the way
      // waitForQuiescent's prefix pattern did.
      if (
        /^(loading|rendering|computing|aligning)([.…]{1,3}|\s+\d{1,3}%)?$/i.test(
          own,
        ) &&
        isVisible(el)
      ) {
        found.push({ kind: 'status-text', text: own.slice(0, 200) })
      }
    }
    // dedupe by kind+text
    const seen = new Set<string>()
    return found.filter(f => {
      const k = `${f.kind}:${f.text}`
      return seen.has(k) ? false : (seen.add(k), true)
    })
  })
  if (problems.length > 0) {
    await debugDump(page, spec.name)
    const detail = problems
      .map(p => `${p.kind}: ${p.text.replaceAll(/\s+/g, ' ').trim()}`)
      .join(' | ')
    throw new Error(
      `capture not settled (still shows loading/error/too-large): ${detail}. ` +
        `If this state is the intended subject, set allowUnsettled: true on the spec.`,
    )
  }
}

async function debugDump(page: Page, name: string) {
  const bodyText = await page
    .evaluate(() => document.body.innerText.substring(0, 800))
    .catch(() => '')
  console.error(
    `    [${name}] debug text: ${bodyText.replaceAll(/\s+/g, ' ').trim()}`,
  )
  const debugPath = path.join(outDir, `debug_${name.replaceAll('/', '_')}.png`)
  await page
    .screenshot()
    .then(png => {
      fs.writeFileSync(debugPath, png)
    })
    .catch(() => {})
  console.error(`    [${name}] debug screenshot: ${debugPath}`)
}

async function captureUrl(page: Page, spec: SessionUrlSpec, port: number) {
  const fullUrl = spec.url.startsWith('http')
    ? spec.url
    : `http://localhost:${port}/${spec.url}`
  await page.goto(fullUrl, {
    waitUntil:
      spec.waitUntil ??
      (spec.url.startsWith('http') ? 'domcontentloaded' : 'networkidle0'),
    // networkidle0 can't be reached while a spec's data is still streaming, so a
    // fixed 60s here failed the heavy tcga specs as a *navigation* timeout —
    // nothing to do with the page being broken. A spec that already declares it
    // needs longer to be ready gets the same room for its navigation.
    timeout: Math.max(60000, spec.readyTimeout ?? 0),
  })

  await waitForReady(page, spec)
  await markPageAlive(page)
}

// Liveness token for assertSamePageAsReady below. Set once the page is ready,
// checked immediately before every screenshot.
const ALIVE_TOKEN = '__jbShotAlive'

function markPageAlive(page: Page) {
  return page.evaluate(token => {
    Object.assign(window, { [token]: true })
  }, ALIVE_TOKEN)
}

// Fail if the document we readied is not the document we are about to shoot.
// A renderer crash or an app reload gives Chrome a brand-new frame, and the
// readiness waits happily pass on it a second time, so the capture lands on a
// bare "Loading" panel — that is how a blank whole-genome TCGA cohort frame
// got committed over a good one. `assertRenderSettled` can't be relied on to
// catch it: it runs before the reload can happen, and the post-reload page is
// briefly indistinguishable from a slow first paint.
//
// A `window` token rather than the `framenavigated` event on purpose: JBrowse
// rewrites its own URL through history.replaceState as the session changes,
// which fires that event on every spec and would fail all of them. A
// same-document rewrite leaves the token in place; only a real document swap
// clears it.
async function assertSamePageAsReady(page: Page, spec: BrowserScreenshotSpec) {
  const alive = await page.evaluate(token => token in window, ALIVE_TOKEN)
  if (!alive) {
    throw new Error(
      `page reloaded between readiness and capture (${spec.name}) — the renderer ` +
        `most likely crashed, so the frame being captured is a fresh, still-loading ` +
        `document rather than the view that was waited on. Nothing was written.`,
    )
  }
}

// Kill CSS transitions and animations for the whole capture session, installed
// before any app script runs so it covers the action chain too, not just the
// final frame. Menus, ripples and MUI Grow/Fade fly-outs then jump straight to
// their settled geometry: they can't be caught mid-transition (the dominant
// source of run-to-run diffs on menu specs) and a click that follows a
// `waitForText` can't land on a popper that is still sliding into place — which
// is what the fixed `delay`s after those waits were really paying for.
function freezeAnimations(page: Page) {
  return page.evaluateOnNewDocument(() => {
    const install = () => {
      const style = document.createElement('style')
      style.textContent =
        '*,*::before,*::after{transition:none !important;animation:none !important;}'
      document.head.append(style)
    }
    // lib.dom types document.head as non-null, but this runs via
    // evaluateOnNewDocument — before the parser has built <head> — so the
    // runtime check is real
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (document.head) {
      install()
    } else {
      document.addEventListener('DOMContentLoaded', install)
    }
  })
}

// Pre-approve the cross-origin plugin warning, which otherwise covers the whole
// app with a modal and fails every spec whose `?config=` points at a hosted
// config declaring an `esmUrl` plugin. jbrowse.org/demos/ecoli_pangenome is one:
// it declares GraphGenomeView so a reader who opens the demo gets the graph
// tracks, and that is worth keeping rather than stripping the plugin to suit the
// generator.
//
// This grants nothing a person could not: the store is localStorage under the
// capture's own localhost origin, which the browser partitions, so it cannot
// vouch for a plugin on jbrowse.org or anywhere else. Written before any app
// script runs, since SessionLoader reads it during startup.
function trustCapturePlugins(page: Page) {
  return page.evaluateOnNewDocument((urls: string[]) => {
    try {
      const KEY = 'jbrowse-trusted-plugins'
      const raw = localStorage.getItem(KEY)
      const trusted = new Set<string>(raw ? (JSON.parse(raw) as string[]) : [])
      for (const url of urls) {
        trusted.add(url)
      }
      localStorage.setItem(KEY, JSON.stringify([...trusted]))
    } catch (e) {
      console.error(e)
    }
  }, TRUSTED_PLUGIN_URLS)
}

// Apply the shared pre-shot steps (hide stray tooltip, draw/clear callouts,
// flush pending WebGL frames) then screenshot straight to `file`.
async function shoot(
  page: Page,
  spec: BrowserScreenshotSpec,
  annotations: Annotation[] | undefined,
  file: string,
) {
  if (spec.hideTooltip) {
    await hideLingeringTooltip(page)
  }
  if (spec.hideSelectors && spec.hideSelectors.length > 0) {
    await page.evaluate(selectors => {
      for (const sel of selectors) {
        for (const el of document.querySelectorAll<HTMLElement>(sel)) {
          el.style.display = 'none'
        }
      }
    }, spec.hideSelectors)
  }
  if (annotations && annotations.length > 0) {
    await drawAnnotations(page, annotations)
  } else {
    await clearAnnotations(page)
  }
  await waitForRasterize(page)
  // last gate before anything is written: same document we readied?
  await assertSamePageAsReady(page, spec)
  await page.screenshot({ path: file, clip: spec.crop })
}

// Note how much of the page this capture cut off, for the end-of-run report.
// Skipped for a `crop` spec, which frames deliberately.
async function recordOverflow(page: Page, name: string) {
  clippedPx.set(
    name,
    Math.max(clippedPx.get(name) ?? 0, await overflowPx(page)),
  )
}

// CSS px of page laid out below the bottom of the viewport, i.e. content the
// capture cut off. The inverse of trailingBackgroundPx: too little viewport
// rather than too much. It cannot be recovered from the PNG — a clipped figure
// and one that happens to end flush with its last track look identical — so it
// has to be read from the live page, and a `crop` spec frames deliberately.
//
// Measured off the view containers, not `documentElement.scrollHeight`: the app
// fills the window and its overflow is absorbed by inner scroll containers, so
// the document itself never reports being taller than the viewport even when a
// track's rows are visibly cut in half.
async function overflowPx(page: Page) {
  return page.evaluate(() =>
    Math.max(
      0,
      ...Array.from(
        document.querySelectorAll('[data-testid^="view-container-"]'),
        el => el.getBoundingClientRect().bottom - window.innerHeight,
      ),
    ),
  )
}

const clippedPx = new Map<string, number>()

// Wait for the browser to actually rasterize the current DOM before capturing.
// A single rAF callback fires *before* paint, so a freshly-composited layer —
// e.g. a just-opened menu Popper, on its own GPU layer that software-GL
// (swiftshader) rasterizes a frame late at deviceScaleFactor 2 — can be fully
// settled in the DOM (opacity:1, laid out) yet still absent from the capture,
// the dominant cause of menu-spec flakiness. Two chained rAFs guarantee a full
// frame committed; the trailing settle gives slow layer rasterization a beat.
async function waitForRasterize(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>(resolve => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setTimeout(resolve, 50)
          })
        })
      }),
  )
}

// Self-contained harness page for an embedded-component capture: load the UMD
// bundle and mount the LGV with the spec's createViewState arg, exactly the
// script-tag setup the embed tutorial documents.
function embeddedHarnessHtml(viewState: object) {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      html, body, #root { margin: 0; padding: 0; }
    </style>
  </head>
  <body>
    <div id="root"></div>
    <script src="/jbrowse.umd.js"></script>
    <script>
      const { createViewState, JBrowseLinearGenomeView, React, createRoot } =
        window.JBrowseReactLinearGenomeView
      const viewState = createViewState(${JSON.stringify(viewState)})
      createRoot(document.getElementById('root')).render(
        React.createElement(JBrowseLinearGenomeView, { viewState }),
      )
    </script>
  </body>
</html>`
}

// Minimal static server for one embedded harness: '/' serves the harness HTML,
// '/jbrowse.umd.js' streams the prebuilt UMD bundle. Listens on an ephemeral
// port so concurrent embedded captures never collide.
function serveEmbeddedHarness(html: string, umdPath: string) {
  return new Promise<{ server: Server; port: number }>((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = req.url ?? '/'
      if (url.startsWith('/jbrowse.umd.js.map')) {
        // Bundle carries a sourceMappingURL; serve the sibling map (devtools
        // only) so it doesn't 404.
        if (fs.existsSync(`${umdPath}.map`)) {
          res.writeHead(200, { 'content-type': 'application/json' })
          fs.createReadStream(`${umdPath}.map`).pipe(res)
        } else {
          res.writeHead(404)
          res.end()
        }
      } else if (url.startsWith('/jbrowse.umd.js')) {
        res.writeHead(200, { 'content-type': 'application/javascript' })
        fs.createReadStream(umdPath).pipe(res)
      } else if (url.startsWith('/favicon.ico')) {
        // The browser auto-requests a favicon for the bare harness page; answer
        // empty so it doesn't log a spurious 404.
        res.writeHead(204)
        res.end()
      } else if (url === '/' || url.startsWith('/index')) {
        res.writeHead(200, { 'content-type': 'text/html' })
        res.end(html)
      } else {
        res.writeHead(404)
        res.end()
      }
    })
    server.on('error', reject)
    server.listen(0, () => {
      const addr = server.address()
      if (addr && typeof addr === 'object') {
        resolve({ server, port: addr.port })
      } else {
        reject(new Error('embedded server failed to bind a port'))
      }
    })
  })
}

// Render an embedded-component spec to a finished temp PNG: serve the harness,
// drive the component to ready, then screenshot the component element (its full
// height, even past the viewport) rather than the page.
async function captureEmbeddedToTemp(
  page: Page,
  spec: EmbeddedSpec,
  suffix = '',
) {
  if (!fs.existsSync(EMBED_UMD_PATH)) {
    throw new Error(
      `Embedded UMD not found at ${EMBED_UMD_PATH}. Build it with "pnpm --filter @jbrowse/react-linear-genome-view2 build:webpack".`,
    )
  }
  const { server, port } = await serveEmbeddedHarness(
    embeddedHarnessHtml(spec.viewState),
    EMBED_UMD_PATH,
  )
  try {
    await page.goto(`http://localhost:${port}/`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    })
    await waitForReady(page, spec)
    await waitForRasterize(page)

    const renderPath = tempPath('jb-final', spec.name, suffix)
    const el = await page.$('#root')
    if (!el) {
      throw new Error('embedded harness #root not found')
    }
    await el.screenshot({ path: renderPath })
    optimizePng(renderPath)
    return renderPath
  } finally {
    // the page holds keep-alive sockets open; close() alone would leave the
    // handle (and the ephemeral port) alive until the browser exits
    server.closeAllConnections()
    server.close()
  }
}

async function runActions(
  page: Page,
  name: string,
  actions: ScreenshotAction[] | undefined,
) {
  for (const action of actions ?? []) {
    await runAction(page, action).catch(async (e: unknown) => {
      await debugDump(page, name)
      throw e
    })
  }
}

// Drive the page through the spec and produce one finished, optimized PNG in a
// temp file (caller decides whether to commit it or diff it). `suffix` keeps the
// two captures of a --check run from colliding on the same temp path.
async function renderSpecToTemp(
  page: Page,
  spec: BrowserScreenshotSpec,
  port: number,
  suffix = '',
) {
  // Embedded captures run their own harness server + element screenshot, so
  // they bypass the jbrowse-web goto and the shared shoot/stages path entirely.
  if (spec.mode === 'embedded') {
    return captureEmbeddedToTemp(page, spec, suffix)
  }

  await captureUrl(page, spec, port)

  await runActions(page, spec.name, spec.actions)
  // same as in captureStages: actions can kick off a re-render, so wait it out
  // before asserting/capturing rather than racing it
  await waitForDisplayPhases(page, readyTimeoutOf(spec))
  await assertViewsRendered(page, spec.name)
  if (!spec.allowUnsettled) {
    await assertRenderSettled(page, spec)
  }

  const renderPath = tempPath('jb-final', spec.name, suffix)
  if (spec.stages && spec.stages.length > 0) {
    await captureStages(page, spec, spec.stages, renderPath)
  } else {
    await shoot(page, spec, spec.annotations, renderPath)
    if (!spec.crop) {
      await recordOverflow(page, spec.name)
    }
  }
  optimizePng(renderPath)
  return renderPath
}

// Gutter between the panels of a `stageColumns` grid, in captured (2x) pixels.
const GRID_GUTTER_PX = 24

// Capture each stage of a multi-stage figure to its own temp file, then stack
// them top-to-bottom with ImageMagick (`convert f0 f1 -append`) into
// `renderPath` — the same composition the hand-made two-stage teaching figures
// used — or into rows of `stageColumns` when the spec asks for a grid.
async function captureStages(
  page: Page,
  spec: BrowserScreenshotSpec,
  stages: ScreenshotStage[],
  renderPath: string,
) {
  const stageFiles = stages.map((_, i) =>
    tempPath('jb-shot', spec.name, `-${i}`),
  )
  const rowFiles = stageFiles.map((_, i) =>
    tempPath('jb-row', spec.name, `-${i}`),
  )
  try {
    await captureEachStage(page, spec, stages, stageFiles)
    const cols = spec.stageColumns ?? 0
    if (cols > 1) {
      // rows of `cols` frames, then the rows stacked. A trailing partial row is
      // padded on the right to the full row width rather than centered, so the
      // frames stay on a grid a reader can scan down a column of.
      //
      // Each frame takes a white border first, so the panels are separated by a
      // gutter instead of abutting: two app windows sharing an edge read as one
      // window with a seam down it.
      const rows: string[] = []
      for (const f of stageFiles) {
        execFileSync(IM, [
          f,
          '-bordercolor',
          'white',
          '-border',
          `${GRID_GUTTER_PX / 2}`,
          f,
        ])
      }
      for (let i = 0; i < stageFiles.length; i += cols) {
        const row = rowFiles[rows.length]!
        execFileSync(IM, [...stageFiles.slice(i, i + cols), '+append', row])
        rows.push(row)
      }
      execFileSync(IM, [
        ...rows,
        '-background',
        'white',
        '-gravity',
        'west',
        '-append',
        renderPath,
      ])
    } else {
      execFileSync(IM, [...stageFiles, '-append', renderPath])
    }
  } finally {
    for (const f of rowFiles) {
      fs.rmSync(f, { force: true })
    }
    // also on the way out of a failed stage, so a spec that throws mid-figure
    // doesn't leave half its frames behind in tmp
    for (const f of stageFiles) {
      fs.rmSync(f, { force: true })
    }
  }
}

// Dismiss every open menu, and prove it happened.
//
// This used to be `Escape` plus a 300ms delay, which is a **no-op** on a JBrowse
// cascade: measured against `pangenome/rgfa_launch_out_menu`, three presses with
// focus verifiably inside the list (`LI[menuitem]`, then `UL[menu]`) leave both
// levels and both modals standing, while a single backdrop click takes the whole
// cascade down at once. So a stage asking for a clean slate got the previous
// stage's menu instead, and its first click landed on the backdrop covering the
// control it named — where `clickElement`'s covered-element fallback dispatches
// on the node anyway, so nothing errored. What followed was two overlapping
// copies of the same menu and a `::-p-text()` match that resolved to whichever
// one it liked. That is the coin flip behind `rgfa_launch_out_menu` and
// `rgfa_strain_launch` failing about one regen round in six on the readiness
// wait *below* their click path, with nothing launched and no click error to say
// why — and those two are the only specs in the suite that set this flag.
//
// Only backdrops belonging to a modal that actually contains a menu are clicked,
// so a dialog a spec deliberately opened is left alone. Looped because a cascade
// can be more than two deep, and asserted at the end because a silent no-op here
// is exactly the failure that cost the round: a stage that cannot reach a clean
// slate should say so, not act on the old one.
async function closeOpenMenus(page: Page, name: string) {
  const clickMenuBackdrops = () =>
    page.evaluate(() => {
      let clicked = 0
      for (const modal of document.querySelectorAll('.MuiModal-root')) {
        const backdrop = modal.querySelector<HTMLElement>('.MuiBackdrop-root')
        if (modal.querySelector('[role="menu"]') && backdrop) {
          backdrop.click()
          clicked++
        }
      }
      return clicked
    })
  const openMenus = () =>
    page.evaluate(
      () =>
        [...document.querySelectorAll('[role="menu"]')].filter(el => {
          const r = el.getBoundingClientRect()
          return r.width > 0 && r.height > 0
        }).length,
    )

  for (let attempt = 0; attempt < 5 && (await openMenus()) > 0; attempt++) {
    await clickMenuBackdrops()
    await delay(200)
  }
  const left = await openMenus()
  if (left > 0) {
    throw new Error(`closeMenusFirst: ${left} menu(s) still open in ${name}`)
  }
}

// Drive each stage and leave its frame in the matching stageFiles entry.
async function captureEachStage(
  page: Page,
  spec: BrowserScreenshotSpec,
  stages: ScreenshotStage[],
  stageFiles: string[],
) {
  for (const [i, stage] of stages.entries()) {
    // Resized before the stage acts, not just before its shot, so the actions
    // hit the layout they are captured against. Width is left alone — the
    // frames stack with `-append`.
    if (stage.closeMenusFirst) {
      await closeOpenMenus(page, spec.name)
    }
    // drop the previous stage's annotation overlay before this stage acts on
    // the page, so its SVG callout text can't be matched by a ::-p-text() click
    // target in this stage's actions
    await clearAnnotations(page)
    await runActions(page, spec.name, stage.actions)
    if (stage.closeMenusAfter) {
      await closeOpenMenus(page, spec.name)
    }
    // Resized after the actions, not before: a stage typically acts on chrome
    // the previous stage opened (a context menu, a popover), which the resize
    // would move or dismiss. Width is left alone — the frames stack with
    // `-append`. The phase wait below covers the re-layout the resize starts.
    const viewport = page.viewport()
    if (
      stage.viewportHeight &&
      viewport &&
      viewport.height !== stage.viewportHeight
    ) {
      await page.setViewport({ ...viewport, height: stage.viewportHeight })
      await delay(500)
    }
    // A stage's actions can start work of their own — alignments_sort_by_base's
    // second stage clicks "Sort by base at position", an async re-sort — and the
    // shot used to race it, landing on the pre-sort order often enough to drift
    // 17% between runs. Wait for the phases the actions disturbed; a no-op when
    // the stage only opened a menu.
    await waitForDisplayPhases(page, readyTimeoutOf(spec))
    await shoot(page, spec, stage.annotations, stageFiles[i]!)
    if (!spec.crop) {
      await recordOverflow(page, spec.name)
    }
    // re-check after each stage capture: assertViewsRendered only runs once
    // before the loop, so a stage that captures a blank view body (a rare
    // paint race after the stage's interaction) would otherwise be committed
    // silently — the staged frames ARE the published image.
    await assertViewsRendered(page, spec.name)
  }
}

// Per-spec pixel-diff gate: a spec can raise the global threshold when its
// render carries irreducible jitter (remote-data timing, heavy text).
function specThreshold(spec: ScreenshotSpec) {
  return spec.diffThreshold ?? diffThreshold
}

// Commit a freshly rendered temp PNG to its output path under the shared
// force / diff-gate options, reporting what happened.
function commit(renderPath: string, outputPath: string, spec: ScreenshotSpec) {
  return commitScreenshot(renderPath, outputPath, spec.name, {
    force,
    diffThreshold: specThreshold(spec),
    baseThreshold: diffThreshold,
  })
}

async function captureSpec(
  page: Page,
  spec: BrowserScreenshotSpec,
  port: number,
) {
  const renderPath = await renderSpecToTemp(page, spec, port)
  const outputPath = path.join(outDir, `${spec.name}.png`)
  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  return commit(renderPath, outputPath, spec)
}

// jb2export renders the products/jbrowse-img/README example images straight
// to PNG via React SSR (see CliSpec in screenshot-specs.ts) — no browser
// involved, so this bypasses the puppeteer pipeline entirely. `suffix` keeps
// the two captures of a --check run from colliding on the same temp path.
async function renderCliSpecToTemp(spec: CliSpec, suffix = '') {
  const renderPath = tempPath('jb-img', spec.name, suffix)
  await execFileAsync(
    'npx',
    [
      'tsx',
      '--tsconfig',
      repoTsconfig,
      jb2exportBin,
      ...spec.args,
      '--out',
      renderPath,
    ],
    { cwd: jbrowseImgDir, maxBuffer: 1024 * 1024 * 64 },
  )
  optimizePng(renderPath)
  return renderPath
}

async function captureCliSpec(spec: CliSpec) {
  const renderPath = await renderCliSpecToTemp(spec)
  const baseName = spec.name.replace(/^jbrowse-img\//, '')
  const outputPath = path.join(jbrowseImgOutDir, `${baseName}.png`)
  const result = commit(renderPath, outputPath, spec)
  // jb2export writes into products/jbrowse-img/img — the README/npm copy served
  // via raw.github. The docs site and the screenshot-review UI instead read the
  // website's own mirror at static/img/jbrowse-img (spec name `jbrowse-img/x`
  // resolves to outDir/jbrowse-img/x.png), which generate-img-doc.ts otherwise
  // only refreshes on `pnpm autogen`, and only for README-referenced names. Sync
  // the fresh capture here too so a plain `pnpm screenshots` doesn't leave the
  // review UI showing a stale (or, for a non-README spec like `sequence`,
  // missing) jbrowse-img image.
  mirrorFile(outputPath, path.join(outDir, `${spec.name}.png`))
  return result
}

// Copy a committed jb2export image into the website static mirror, only when the
// bytes differ, so an unchanged spec doesn't churn the tracked website copy.
function mirrorFile(src: string, dest: string) {
  if (fs.existsSync(src)) {
    const upToDate =
      fs.existsSync(dest) && fs.readFileSync(dest).equals(fs.readFileSync(src))
    if (!upToDate) {
      fs.mkdirSync(path.dirname(dest), { recursive: true })
      fs.copyFileSync(src, dest)
    }
  }
}

// Stack the committed PNGs of `spec.parts` into one figure (top to bottom) with
// the same `convert -append` a `stages` capture uses, or side by side with
// `+append` when the spec asks for it. Runs after the render pool so the parts
// are already fresh on disk; a filter that targets only the compose spec
// recomposes from the committed parts.
async function captureComposeSpec(spec: ComposeSpec) {
  const partPath = (part: string) => path.join(outDir, `${part}.png`)
  const missing = spec.parts.filter(part => !fs.existsSync(partPath(part)))
  if (missing.length > 0) {
    throw new Error(`missing part image(s): ${missing.join(', ')}`)
  }
  const partPaths = spec.parts.map(partPath)
  const renderPath = tempPath('jb-compose', spec.name)
  const append = spec.direction === 'horizontal' ? '+append' : '-append'
  execFileSync(IM, [...partPaths, append, renderPath])
  optimizePng(renderPath)
  const outputPath = path.join(outDir, `${spec.name}.png`)
  return commit(renderPath, outputPath, spec)
}

// Print a titled, ===-barred block of lines to stderr (failure/flaky summaries).
function printReport(title: string, lines: string[]) {
  const bar = '='.repeat(60)
  console.error(`\n${bar}`)
  console.error(title)
  console.error(bar)
  for (const line of lines) {
    console.error(line)
  }
  console.error(`\n${bar}`)
}

interface RunTotals {
  passed: number
  failed: number
  kept: number
  skipped: number
  failures: { name: string; error: string }[]
  flaky: { name: string; frac: number }[]
  changed: { name: string; result: CommitResult }[]
  // kept only because the spec raised its own diffThreshold above the run
  // default — the case where a real change hides behind a jitter allowance
  suppressed: { name: string; frac: number }[]
  slacked: { name: string; px: number }[]
}

const pct = (n: number) => `${(n * 100).toFixed(3)}%`

function printSummary(totals: RunTotals) {
  const { passed, failed, kept, skipped } = totals
  const { failures, flaky, changed, suppressed, slacked } = totals
  console.log(
    `\n${passed} ${check ? 'checked' : 'succeeded'}, ${failed} failed${
      check ? `, ${flaky.length} flaky` : `, ${kept} unchanged`
    }${skipped > 0 ? `, ${skipped} skipped (curated / heavy remote data)` : ''}`,
  )
  if (changed.length > 0) {
    printReport(
      `UPDATED SCREENSHOTS (${changed.length})`,
      changed.map(({ name, result }) =>
        result.status === 'updated'
          ? `• ${name}.png (${result.detail})`
          : `• ${name}.png (new)`,
      ),
    )
  }
  if (suppressed.length > 0) {
    printReport(
      `KEPT BEHIND A RAISED diffThreshold (${suppressed.length}) — re-run these with --force if you changed them on purpose`,
      suppressed.map(
        ({ name, frac }) =>
          `• ${name}.png: ${pct(frac)} differs, over the ${pct(diffThreshold)} default`,
      ),
    )
  }
  const clipped = [...clippedPx]
    .filter(([, px]) => px > CLIP_WARN_PX)
    .sort((a, b) => b[1] - a[1])
  if (clipped.length > 0) {
    printReport(
      `CONTENT CLIPPED BELOW THE FOLD (${clipped.length}) — the capture cut these off; raise the spec's viewportHeight by about this much`,
      clipped.map(
        ([name, px]) =>
          `• ${name}.png: ${px} css px of page below the viewport`,
      ),
    )
  }
  if (slacked.length > 0) {
    printReport(
      `BLANK BELOW THE CONTENT, IN A FIGURE THAT JUST CHANGED (${slacked.length}) — if the app got shorter here, lower the spec's viewportHeight by about this much`,
      [...slacked]
        .sort((a, b) => b.px - a.px)
        .map(
          ({ name, px }) =>
            `• ${name}.png: ${Math.round(px / DEVICE_SCALE_FACTOR)} css px of blank below the last content`,
        ),
    )
  }
  if (flaky.length > 0) {
    printReport(
      `FLAKY SPECS (${flaky.length}) — nondeterministic renders`,
      flaky.map(
        ({ name, frac }) => `• ${name}: ${pct(frac)} drift between renders`,
      ),
    )
  }
  if (failures.length > 0) {
    printReport(
      `FAILURE SUMMARY (${failures.length})`,
      failures.map(
        ({ name, error }) => `\n• ${name}\n  ${error.replaceAll('\n', '\n  ')}`,
      ),
    )
  }
}

async function main() {
  // `--filter a,b,c` matches a spec when any comma-separated token matches, so
  // "re-render these few" is one invocation instead of a shell loop. The flag is
  // repeatable and the tokens union.
  const filterTokens = parseFilterTokens(filter)
  const selected = specs.filter(s =>
    matchesFilterTokens(s.name, filterTokens, exact),
  )

  if (selected.length === 0) {
    console.error(`No specs match filter: ${filterTokens.join(',')}`)
    process.exit(1)
  }

  // The figure a doc publishes for a compose spec is the STACK, not the parts.
  // Re-rendering a part on its own (`--filter variants/potato_missingness_before`)
  // would leave that stack showing the old part, with nothing to say so — so pull
  // in every compose spec whose parts this run touches.
  const selectedNames = new Set(selected.map(s => s.name))
  const impliedCompose = specs.filter(
    s =>
      s.mode === 'compose' &&
      !selectedNames.has(s.name) &&
      s.parts.some(p => selectedNames.has(p)),
  )
  const filteredSpecs = [...selected, ...impliedCompose]

  console.log(
    `Generating ${filteredSpecs.length} screenshot(s)${filterTokens.length ? ` (filter: ${filterTokens.join(',')})` : ''}`,
  )
  if (impliedCompose.length > 0) {
    console.log(
      `  + recomposing ${impliedCompose.map(s => s.name).join(', ')} (their parts are in this run)`,
    )
  }

  // Only url-mode specs pointing at a relative path need the jbrowse-web server.
  // embedded specs serve their own harness; cli specs bypass the browser; compose
  // specs (and http-url specs) only read already-committed PNGs off disk.
  const needsLocalServer = filteredSpecs.some(
    s => s.mode === 'url' && !s.url.startsWith('http'),
  )

  let server: Server | undefined

  if (needsLocalServer) {
    if (!externalPort && !fs.existsSync(buildPath)) {
      console.error(
        `Build not found at ${buildPath}. Run "pnpm build" in products/jbrowse-web first, or pass --port=N to use an existing server.`,
      )
      process.exit(1)
    }
    server = await createTestServer(servePort, {
      jbrowseWebRoot: testDataRoot,
      repoRoot,
      proxyPort: externalPort,
    })
    console.log(
      externalPort
        ? `Proxy on port ${servePort}, app on port ${externalPort}`
        : `Server on port ${servePort}`,
    )
  }

  const executablePath = findChromeExecutable()

  // wider viewport for more genomic context; deviceScaleFactor 2 keeps the
  // capture hidpi/retina-crisp (2x backing store) at the larger size
  const defaultViewport = {
    width: 1500,
    height: 800,
    deviceScaleFactor: DEVICE_SCALE_FACTOR,
  }
  const {
    width: vpWidth,
    height: vpHeight,
    deviceScaleFactor,
  } = defaultViewport

  // Chrome leans on swiftshader for headless WebGL; Firefox needs WebGL forced
  // on past the headless GL caveat so molstar's canvas renders at all.
  const buildLaunchOptions = (useFirefox: boolean) => ({
    headless: !headed,
    defaultViewport,
    // Puppeteer's default 180s protocolTimeout applies to every CDP call, and a
    // renderer busy rasterizing a 1104-row whole-genome canvas can starve the
    // main thread past it. The tcga cohort spec then failed with "Waiting for
    // selector … failed" and an EMPTY debug dump over a fully painted page —
    // the app was fine, the protocol call gave up. Deliberately above the
    // longest spec readyTimeout so a real hang still fails as a ready timeout,
    // with a debug frame, rather than as an opaque protocol error.
    protocolTimeout: 1200000,
    ...(useFirefox
      ? {
          browser: 'firefox' as const,
          extraPrefsFirefox: {
            'webgl.force-enabled': true,
            'webgl.disabled': false,
            'webgl.disable-fail-if-major-performance-caveat': true,
          },
        }
      : {
          executablePath,
          args: [...BASE_CHROME_ARGS, '--enable-unsafe-swiftshader'],
        }),
  })

  // Compose specs stack other specs' committed PNGs, so they run in a second,
  // sequential pass after the render pool refreshes those parts. --check writes
  // nothing, so a deterministic append has nothing to verify — skip them there
  // (and drop them from the [n/total] denominator, which is why total sums the
  // two lists rather than counting filteredSpecs).
  const renderSpecs = filteredSpecs.filter(s => s.mode !== 'compose')
  const composeSpecs = check
    ? []
    : filteredSpecs.filter(s => s.mode === 'compose')

  let passed = 0
  let failed = 0
  let kept = 0
  let skipped = 0
  let started = 0
  const total = renderSpecs.length + composeSpecs.length
  const failures: RunTotals['failures'] = []
  const flaky: RunTotals['flaky'] = []
  const changed: RunTotals['changed'] = []
  const suppressed: RunTotals['suppressed'] = []
  const slacked: RunTotals['slacked'] = []

  // Zero-padded `[ 7/40]` so the counter column stays aligned as it grows,
  // keeping the interleaved per-worker lines readable.
  function progress() {
    started += 1
    return `[${String(started).padStart(String(total).length)}/${total}]`
  }

  // Fresh browser per call (avoids service-worker caching between navigations),
  // viewport set per spec, then run the body with the prepared page.
  async function withFreshPage<T>(
    spec: BrowserScreenshotSpec,
    body: (page: Page) => Promise<T>,
  ) {
    const browser = await launch(buildLaunchOptions(firefox || !!spec.firefox))
    try {
      const page = await browser.newPage()
      await freezeAnimations(page)
      await trustCapturePlugins(page)
      if (spec.viewportHeight || spec.viewportWidth) {
        await page.setViewport({
          width: spec.viewportWidth ?? vpWidth,
          height: spec.viewportHeight ?? vpHeight,
          deviceScaleFactor,
        })
      }
      const report = (kind: string, text: string) => {
        const expected = spec.expectedConsole?.some(s => text.includes(s))
        if (!isBrowserConsoleNoise(text) && !expected) {
          console.error(
            `    [${spec.name}] browser[${kind}]: ${text.substring(0, 300)}`,
          )
        }
      }
      page.on('console', msg => {
        report(msg.type(), msg.text())
      })
      // an uncaught exception in the app never reaches the console listener, so
      // a render that dies mid-mount used to produce a silently blank figure
      page.on('pageerror', (err: unknown) => {
        report('pageerror', err instanceof Error ? err.message : String(err))
      })
      return await body(page)
    } finally {
      await browser.close()
    }
  }

  // --check: render the spec twice (via the caller's `render`, which decides
  // browser-vs-cli) and compare the two captures to each other. A drift past
  // threshold means the spec is nondeterministic — it would churn its committed
  // PNG on every regen. Doesn't touch committed files.
  async function checkTwice(
    spec: BrowserScreenshotSpec | CliSpec,
    render: (suffix: string) => Promise<string>,
  ) {
    const a = await render('-a')
    const b = await render('-b')
    const frac = pngDiffFraction(a, b)
    fs.rmSync(a, { force: true })
    fs.rmSync(b, { force: true })
    if (frac === null || frac >= specThreshold(spec)) {
      const drift = frac === null ? 'size-mismatch' : pct(frac)
      console.log(`  ✗ ${spec.name} FLAKY (${drift} between two renders)`)
      flaky.push({ name: spec.name, frac: frac ?? 1 })
    } else {
      console.log(`  ✓ ${spec.name} stable (${pct(frac)})`)
    }
  }

  async function runSpec(spec: ScreenshotSpec) {
    if (spec.curated) {
      console.log(
        `${progress()} ⊘ ${spec.name} (curated, keeping committed image)`,
      )
      skipped++
      return
    }
    if (spec.heavyNetwork && !filterTokens.length) {
      console.log(
        `${progress()} ⊘ ${spec.name} (heavy remote data; name it in --filter to re-render)`,
      )
      skipped++
      return
    }
    // Stacking a part that just failed to render would publish a figure half
    // made of a stale image, and the run would still report success.
    const brokenParts =
      spec.mode === 'compose'
        ? spec.parts.filter(p => failures.some(f => f.name === p))
        : []
    if (brokenParts.length > 0) {
      const error = `part(s) failed to render this run: ${brokenParts.join(', ')} — not restacking a figure from stale parts`
      console.error(`${progress()} ✗ ${spec.name}: ${error}`)
      failed++
      failures.push({ name: spec.name, error })
      return
    }
    console.log(`${progress()} → ${spec.name}`)
    try {
      let result: CommitResult | undefined
      if (spec.mode === 'compose') {
        result = await captureComposeSpec(spec)
      } else if (spec.mode === 'cli') {
        if (check) {
          await checkTwice(spec, suffix => renderCliSpecToTemp(spec, suffix))
        } else {
          result = await captureCliSpec(spec)
        }
      } else if (check) {
        await checkTwice(spec, suffix =>
          withFreshPage(spec, p =>
            renderSpecToTemp(p, spec, servePort, suffix),
          ),
        )
      } else {
        result = await withFreshPage(spec, page =>
          captureSpec(page, spec, servePort),
        )
      }
      if (result) {
        if (result.status === 'kept') {
          kept++
          if (result.raisedGate) {
            suppressed.push({ name: spec.name, frac: result.frac })
          }
        } else {
          changed.push({ name: spec.name, result })
          // Only for an image this run actually wrote. Slack is news when it
          // appears — the app or a plugin started laying something out shorter
          // — and 28% of the committed corpus has some, most of it a deliberate
          // framing choice around a dialog or an empty state. Reporting all of
          // it every run would be noise nobody reads; reporting the ones that
          // just moved is the signal.
          const slack = trailingBackgroundPx(
            path.join(outDir, `${spec.name}.png`),
          )
          if (slack !== null && slack > SLACK_WARN_PX) {
            slacked.push({ name: spec.name, px: slack })
          }
        }
      }
      passed++
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err)
      console.error(`  ✗ ${spec.name}: ${error}`)
      failed++
      failures.push({ name: spec.name, error })
    }
  }

  console.log(`Running with concurrency ${CONCURRENCY}`)

  try {
    // Pool: keep CONCURRENCY browsers running at once
    const queue = [...renderSpecs]
    const workers = Array.from({ length: CONCURRENCY }, async () => {
      while (queue.length > 0) {
        const spec = queue.shift()!
        await runSpec(spec)
      }
    })
    await Promise.all(workers)

    for (const spec of composeSpecs) {
      await runSpec(spec)
    }
  } finally {
    server?.close()
  }

  printSummary({
    passed,
    failed,
    kept,
    skipped,
    failures,
    flaky,
    changed,
    suppressed,
    slacked,
  })
  // exit non-zero once, after every report prints — a --check run can be both
  // flaky and have hard failures, and swallowing either report hides real work
  if (flaky.length > 0 || failures.length > 0) {
    process.exit(1)
  }
}

main().catch((err: unknown) => {
  console.error(err)
  process.exit(1)
})
