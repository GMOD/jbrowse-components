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
  waitForDisplaysDone,
  waitForLoadingComplete,
  waitForQuiescent,
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
    filter: { type: 'string', short: 'f' },
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

// Parse a numeric CLI option, returning undefined when absent or non-finite.
function optNum(raw: string | undefined) {
  const n = raw ? Number(raw) : Number.NaN
  return Number.isFinite(n) ? n : undefined
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
const diffThreshold = optNum(values['diff-threshold']) ?? DEFAULT_DIFF_THRESHOLD
const externalPort = optNum(values.port)
const DEFAULT_PORT = optNum(values.localport) ?? DEFAULT_LOCAL_PORT
// Math.max(1, …) so `--concurrency 0` can't spin up zero workers and silently
// skip every render spec while still exiting 0.
const CONCURRENCY = Math.max(1, optNum(values.concurrency) ?? (headed ? 1 : 4))

const HELP = `Render website screenshots from scripts/screenshot-specs.ts.

Usage: pnpm generate-screenshots [options]

Options:
  -h, --help              Show this help and exit
  -f, --filter <a,b,c>    Only render specs whose name matches any token
                          (substring match; see --exact)
      --exact             Make --filter tokens match spec names exactly
      --force             Overwrite every PNG, bypassing the content-stable
                          diff gate
      --check             Render each spec twice and report specs that drift
                          past the threshold; commits nothing
      --firefox           Render with the Firefox backend instead of Chrome
      --headed            Run a visible browser (defaults --concurrency to 1)
      --concurrency <n>   Browsers to run at once (default: 4, or 1 if headed)
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

// Wait out a spec's readiness signals before capture: its readyText/readySelector
// become visible, the loading overlay clears, any in-track "Loading…"/"Rendering…"
// indicator quiesces, and canvas displays signal paint-complete. readyText is
// only the track label (present well before a slow remote BAM finishes), so the
// spec's readyTimeout gates every wait here — the fixed default otherwise cut off
// slow whole-genome-alignment blocks mid-load and captured a "Loading" panel.
async function waitForReady(page: Page, spec: SessionUrlSpec | EmbeddedSpec) {
  const readyTimeout = spec.readyTimeout ?? DEFAULT_READY_TIMEOUT_MS
  const readySelectors = [
    spec.readyText ? textSelector(spec.readyText) : undefined,
    spec.readySelector,
  ].filter((s): s is string => s !== undefined)
  try {
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
  await waitForQuiescent(page, { timeout: readyTimeout })
  await waitForDisplaysDone(page, spec.settleMs ?? DEFAULT_SETTLE_MS)
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
    timeout: 60000,
  })

  await waitForReady(page, spec)
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
    if (document.head) {
      install()
    } else {
      document.addEventListener('DOMContentLoaded', install)
    }
  })
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
  const clip = spec.crop
  await page.screenshot(clip ? { path: file, clip } : { path: file })
}

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
  await assertViewsRendered(page, spec.name)
  if (!spec.allowUnsettled) {
    await assertRenderSettled(page, spec)
  }

  const renderPath = tempPath('jb-final', spec.name, suffix)
  if (spec.stages && spec.stages.length > 0) {
    await captureStages(page, spec, spec.stages, renderPath)
  } else {
    await shoot(page, spec, spec.annotations, renderPath)
  }
  optimizePng(renderPath)
  return renderPath
}

// Capture each stage of a multi-stage figure to its own temp file, then stack
// them top-to-bottom with ImageMagick (`convert f0 f1 -append`) into
// `renderPath` — the same composition the hand-made two-stage teaching figures
// used.
async function captureStages(
  page: Page,
  spec: BrowserScreenshotSpec,
  stages: ScreenshotStage[],
  renderPath: string,
) {
  const stageFiles = stages.map((_, i) =>
    tempPath('jb-shot', spec.name, `-${i}`),
  )
  for (const [i, stage] of stages.entries()) {
    if (stage.closeMenusFirst) {
      await page.keyboard.press('Escape')
      await delay(300)
    }
    // drop the previous stage's annotation overlay before this stage acts on
    // the page, so its SVG callout text can't be matched by a ::-p-text() click
    // target in this stage's actions
    await clearAnnotations(page)
    await runActions(page, spec.name, stage.actions)
    await shoot(page, spec, stage.annotations, stageFiles[i]!)
    // re-check after each stage capture: assertViewsRendered only runs once
    // before the loop, so a stage that captures a blank view body (a rare
    // paint race after the stage's interaction) would otherwise be committed
    // silently — the staged frames ARE the published image.
    await assertViewsRendered(page, spec.name)
  }
  execFileSync(IM, [...stageFiles, '-append', renderPath])
  for (const f of stageFiles) {
    fs.rmSync(f, { force: true })
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
// the same `convert -append` a `stages` capture uses. Runs after the render
// pool so the parts are already fresh on disk; a filter that targets only the
// compose spec recomposes from the committed parts.
async function captureComposeSpec(spec: ComposeSpec) {
  const partPaths = spec.parts.map(p => path.join(outDir, `${p}.png`))
  const missing = spec.parts.filter((_, i) => !fs.existsSync(partPaths[i]!))
  if (missing.length > 0) {
    throw new Error(`missing part image(s): ${missing.join(', ')}`)
  }
  const renderPath = tempPath('jb-compose', spec.name)
  execFileSync(IM, [...partPaths, '-append', renderPath])
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

async function main() {
  // `--filter a,b,c` matches a spec when any comma-separated token matches, so
  // "re-render these few" is one invocation instead of a shell loop.
  const filterTokens = parseFilterTokens(filter)
  const filteredSpecs = specs.filter(s =>
    matchesFilterTokens(s.name, filterTokens, exact),
  )

  if (filteredSpecs.length === 0) {
    console.error(`No specs match filter: ${filter}`)
    process.exit(1)
  }

  console.log(
    `Generating ${filteredSpecs.length} screenshot(s)${filter ? ` (filter: ${filter})` : ''}`,
  )

  // Only url-mode specs pointing at a relative path need the jbrowse-web server.
  // embedded specs serve their own harness; cli specs bypass the browser; compose
  // specs (and http-url specs) only read already-committed PNGs off disk.
  const needsLocalServer = filteredSpecs.some(
    s => s.mode === 'url' && !s.url.startsWith('http'),
  )

  let server: Server | undefined
  const port = DEFAULT_PORT

  if (needsLocalServer) {
    if (!externalPort && !fs.existsSync(buildPath)) {
      console.error(
        `Build not found at ${buildPath}. Run "pnpm build" in products/jbrowse-web first, or pass --port=N to use an existing server.`,
      )
      process.exit(1)
    }
    server = await createTestServer(port, {
      jbrowseWebRoot: testDataRoot,
      repoRoot,
      proxyPort: externalPort,
    })
    console.log(
      externalPort
        ? `Proxy on port ${port}, app on port ${externalPort}`
        : `Server on port ${port}`,
    )
  }

  const executablePath = findChromeExecutable()

  // wider viewport for more genomic context; deviceScaleFactor 2 keeps the
  // capture hidpi/retina-crisp (2x backing store) at the larger size
  const defaultViewport = { width: 1500, height: 800, deviceScaleFactor: 2 }
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
  const failures: { name: string; error: string }[] = []
  const flaky: { name: string; frac: number }[] = []
  const changed: { name: string; result: CommitResult }[] = []

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
      const pct =
        frac === null ? 'size-mismatch' : `${(frac * 100).toFixed(3)}%`
      console.log(`  ✗ ${spec.name} FLAKY (${pct} between two renders)`)
      flaky.push({ name: spec.name, frac: frac ?? 1 })
    } else {
      console.log(`  ✓ ${spec.name} stable (${(frac * 100).toFixed(3)}%)`)
    }
  }

  async function runSpec(spec: ScreenshotSpec) {
    if (spec.mode !== 'compose' && spec.curated) {
      console.log(
        `${progress()} ⊘ ${spec.name} (curated, keeping committed image)`,
      )
      skipped++
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
          withFreshPage(spec, p => renderSpecToTemp(p, spec, port, suffix)),
        )
      } else {
        result = await withFreshPage(spec, page =>
          captureSpec(page, spec, port),
        )
      }
      if (result) {
        if (result.status === 'kept') {
          kept++
        } else {
          changed.push({ name: spec.name, result })
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

  console.log(
    `\n${passed} ${check ? 'checked' : 'succeeded'}, ${failed} failed${
      check ? `, ${flaky.length} flaky` : `, ${kept} unchanged`
    }${skipped > 0 ? `, ${skipped} curated (skipped)` : ''}`,
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
  if (flaky.length > 0) {
    printReport(
      `FLAKY SPECS (${flaky.length}) — nondeterministic renders`,
      flaky.map(
        ({ name, frac }) =>
          `• ${name}: ${(frac * 100).toFixed(3)}% drift between renders`,
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
  // exit non-zero once, after both reports print — a --check run can be both
  // flaky and have hard failures, and swallowing either report hides real work
  if (flaky.length > 0 || failures.length > 0) {
    process.exit(1)
  }
}

main().catch((err: unknown) => {
  console.error(err)
  process.exit(1)
})
