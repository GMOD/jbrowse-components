import { execFile, execFileSync } from 'child_process'
import fs from 'fs'
import http from 'http'
import os from 'os'
import path from 'path'
import { fileURLToPath } from 'url'
import { parseArgs, promisify } from 'util'

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

import {
  delay,
  openTrack,
  runAction,
  setLocation,
  textSelector,
  waitForVisible,
} from './actions.ts'
import {
  clearAnnotations,
  drawAnnotations,
  hideLingeringTooltip,
} from './annotations.ts'
import {
  commitScreenshot,
  optimizePng,
  pngDiffFraction,
} from './image-pipeline.ts'
import {
  matchesFilterTokens,
  parseFilterTokens,
  specs,
} from './screenshot-specs.ts'

import type {
  Annotation,
  BrowserScreenshotSpec,
  CliSpec,
  EmbeddedSpec,
  ScreenshotAction,
  ScreenshotSpec,
} from './screenshot-specs.ts'
import type { Server } from 'http'
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
const CONCURRENCY = optNum(values.concurrency) ?? (headed ? 1 : 4)

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
const VOLVOX_CONFIG = 'test_data/volvox/config.json'
// Maximum time to wait for canvas displays to signal paint-complete via their
// *-done testids. Acts as a timeout (proceed if it expires), not a fixed floor.
const DEFAULT_SETTLE_MS = 2500

// Guard against capturing a view that rendered no content. The ViewContainer
// always renders its header chrome, so a screenshot with header-but-empty-body
// (e.g. a render regression) still "succeeds" and slips through review. A
// healthy view — including an import form — fills its body, so an empty body
// uniquely signals a broken render.
async function assertViewsRendered(page: Page, name: string) {
  const emptyViews = await page.evaluate(() =>
    Array.from(document.querySelectorAll('[data-testid^="view-container-"]'))
      .filter(c => {
        const body = c.lastElementChild
        return !body || body.childElementCount === 0
      })
      .map(c => c.getAttribute('data-testid') ?? '?'),
  )
  if (emptyViews.length > 0) {
    await debugDump(page, name)
    throw new Error(`view(s) rendered blank: ${emptyViews.join(', ')}`)
  }
}

async function debugDump(page: Page, name: string) {
  const bodyText = await page
    .evaluate(() => document.body.innerText.substring(0, 800))
    .catch(() => '')
  console.error(`    [${name}] debug text: ${bodyText.replace(/\s+/g, ' ').trim()}`)
  const debugPath = path.join(outDir, `debug_${name.replace(/\//g, '_')}.png`)
  await page
    .screenshot()
    .then(png => {
      fs.writeFileSync(debugPath, png)
    })
    .catch(() => {})
  console.error(`    [${name}] debug screenshot: ${debugPath}`)
}

async function captureLGV(
  page: Page,
  spec: ScreenshotSpec & { mode?: 'lgv' },
  port: number,
) {
  const config = spec.config ?? VOLVOX_CONFIG
  await page.goto(
    `http://localhost:${port}/?config=${config}&sessionName=Screenshot`,
    { waitUntil: 'networkidle0', timeout: 60000 },
  )

  // Wait for the view to be fully initialized (ctgA appears in the default volvox session)
  await waitForVisible(page, textSelector('ctgA'))
  await waitForLoadingComplete(page, { waitForDownloads: true })
  await waitForQuiescent(page)

  if (spec.loc) {
    await setLocation(page, spec.loc)
    await delay(500)
  }

  for (const trackId of spec.openTracks ?? []) {
    await openTrack(page, trackId)
    await delay(300)
  }

  await waitForDisplaysDone(page, spec.settleMs ?? DEFAULT_SETTLE_MS)
}

async function captureUrl(
  page: Page,
  spec: ScreenshotSpec & { mode: 'url' },
  port: number,
) {
  const fullUrl = spec.url.startsWith('http')
    ? spec.url
    : `http://localhost:${port}/${spec.url}`
  await page.goto(fullUrl, {
    waitUntil:
      spec.waitUntil ??
      (spec.url.startsWith('http') ? 'domcontentloaded' : 'networkidle0'),
    timeout: 60000,
  })

  const readyTimeout = spec.readyTimeout ?? 30000
  const readySelectors = [
    spec.readyText ? textSelector(spec.readyText) : undefined,
    spec.readySelector,
  ].filter((s): s is string => s !== undefined)
  for (const selector of readySelectors) {
    await waitForVisible(page, selector, { timeout: readyTimeout }).catch(
      async (e: unknown) => {
        await debugDump(page, spec.name)
        throw e
      },
    )
  }

  // readyText is just the track label, which appears as soon as the track is
  // added — well before a slow remote BAM finishes downloading. Slow specs
  // bump readyTimeout, so reuse it here too, otherwise the loading-overlay wait
  // throws at its 30s default while the data is still in flight.
  await waitForLoadingComplete(page, {
    waitForDownloads: true,
    timeout: readyTimeout,
  })
  // Data is loaded by this point, so any residual status text (e.g. "computing
  // alignment") clears fast — use the helper's short default rather than the
  // long readyTimeout, which is sized for slow remote downloads.
  await waitForQuiescent(page)
  await waitForDisplaysDone(page, spec.settleMs ?? DEFAULT_SETTLE_MS)
}

// Apply the shared pre-shot steps (hide stray tooltip, draw/clear callouts,
// flush pending WebGL frames) then screenshot straight to `file`.
async function shoot(
  page: Page,
  spec: BrowserScreenshotSpec,
  annotations: Annotation[] | undefined,
  file: string,
) {
  // Freeze CSS transitions/animations so menus, ripples, and MUI Grow/Fade
  // fly-outs snap to their settled state instead of being caught mid-transition
  // — the dominant source of large run-to-run diffs on menu-capture specs.
  await page.evaluate(() => {
    const id = '__screenshot_freeze_anim'
    if (!document.getElementById(id)) {
      const style = document.createElement('style')
      style.id = id
      style.textContent =
        '*,*::before,*::after{transition:none !important;animation:none !important;}'
      document.head.appendChild(style)
    }
  })
  if (spec.hideTooltip) {
    await hideLingeringTooltip(page)
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
      if (url.startsWith('/jbrowse.umd.js')) {
        res.writeHead(200, { 'content-type': 'application/javascript' })
        fs.createReadStream(umdPath).pipe(res)
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
    const readyTimeout = spec.readyTimeout ?? 30000
    const readySelectors = [
      spec.readyText ? textSelector(spec.readyText) : undefined,
      spec.readySelector,
    ].filter((s): s is string => s !== undefined)
    for (const selector of readySelectors) {
      await waitForVisible(page, selector, { timeout: readyTimeout }).catch(
        async (e: unknown) => {
          await debugDump(page, spec.name)
          throw e
        },
      )
    }
    await waitForLoadingComplete(page, {
      waitForDownloads: true,
      timeout: readyTimeout,
    })
    await waitForQuiescent(page)
    await waitForDisplaysDone(page, spec.settleMs ?? DEFAULT_SETTLE_MS)
    await waitForRasterize(page)

    const safeSpecName = spec.name.replace(/\//g, '_')
    const renderPath = path.join(
      os.tmpdir(),
      `jb-final-${process.pid}-${safeSpecName}${suffix}.png`,
    )
    const el = await page.$('#root')
    if (!el) {
      throw new Error('embedded harness #root not found')
    }
    await el.screenshot({ path: renderPath })
    optimizePng(renderPath)
    return renderPath
  } finally {
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

  if (spec.mode === 'url') {
    await captureUrl(page, spec, port)
  } else {
    await captureLGV(page, spec, port)
  }

  await runActions(page, spec.name, spec.actions)
  await assertViewsRendered(page, spec.name)

  const safeSpecName = spec.name.replace(/\//g, '_')
  const renderPath = path.join(
    os.tmpdir(),
    `jb-final-${process.pid}-${safeSpecName}${suffix}.png`,
  )

  if (spec.stages && spec.stages.length > 0) {
    // capture each stage to a temp file, then stack them vertically with
    // ImageMagick (`convert f0 f1 -append`), the same composition the hand-made
    // two-stage teaching figures used
    const stageFiles = spec.stages.map((_, i) =>
      path.join(os.tmpdir(), `jb-shot-${process.pid}-${safeSpecName}-${i}.png`),
    )
    for (const [i, stage] of spec.stages.entries()) {
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
    }
    execFileSync('convert', [...stageFiles, '-append', renderPath])
    for (const f of stageFiles) {
      fs.rmSync(f, { force: true })
    }
  } else {
    await shoot(page, spec, spec.annotations, renderPath)
  }
  optimizePng(renderPath)
  return renderPath
}

async function captureSpec(
  page: Page,
  spec: BrowserScreenshotSpec,
  port: number,
) {
  const renderPath = await renderSpecToTemp(page, spec, port)
  const outputPath = path.join(outDir, `${spec.name}.png`)
  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  commitScreenshot(renderPath, outputPath, spec.name, {
    force,
    diffThreshold: spec.diffThreshold ?? diffThreshold,
  })
}

// jb2export renders the products/jbrowse-img/README example images straight
// to PNG via React SSR (see CliSpec in screenshot-specs.ts) — no browser
// involved, so this bypasses the puppeteer pipeline entirely. `suffix` keeps
// the two captures of a --check run from colliding on the same temp path.
async function renderCliSpecToTemp(spec: CliSpec, suffix = '') {
  const safeSpecName = spec.name.replace(/\//g, '_')
  const renderPath = path.join(
    os.tmpdir(),
    `jb-img-${process.pid}-${safeSpecName}${suffix}.png`,
  )
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
  commitScreenshot(renderPath, outputPath, spec.name, {
    force,
    diffThreshold: spec.diffThreshold ?? diffThreshold,
  })
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

  const needsLocalServer = filteredSpecs.some(
    s =>
      s.mode !== 'cli' &&
      s.mode !== 'embedded' &&
      (s.mode !== 'url' || !s.url.startsWith('http')),
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
  const { width: vpWidth, deviceScaleFactor } = defaultViewport

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

  let passed = 0
  let failed = 0
  let started = 0
  const total = filteredSpecs.length
  const failures: { name: string; error: string }[] = []
  const flaky: { name: string; frac: number }[] = []

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
      if (spec.viewportHeight || spec.viewportWidth) {
        await page.setViewport({
          width: spec.viewportWidth ?? vpWidth,
          height: spec.viewportHeight ?? 800,
          deviceScaleFactor,
        })
      }
      page.on('console', msg => {
        const t = msg.type()
        if (!isBrowserConsoleNoise(msg.text())) {
          console.error(
            `    [${spec.name}] browser[${t}]: ${msg.text().substring(0, 300)}`,
          )
        }
      })
      return await body(page)
    } finally {
      await browser.close()
    }
  }

  // Shared by checkSpec/checkCliSpec: diff two captures of the same spec and
  // either flag it flaky or report it stable. Doesn't touch committed files.
  function reportDiffOrFlaky(
    name: string,
    a: string,
    b: string,
    limit: number,
  ) {
    const frac = pngDiffFraction(a, b)
    fs.rmSync(a, { force: true })
    fs.rmSync(b, { force: true })
    if (frac === null || frac >= limit) {
      const pct =
        frac === null ? 'size-mismatch' : `${(frac * 100).toFixed(3)}%`
      console.log(`  ✗ ${name} FLAKY (${pct} between two renders)`)
      flaky.push({ name, frac: frac ?? 1 })
    } else {
      console.log(`  ✓ ${name} stable (${(frac * 100).toFixed(3)}%)`)
    }
  }

  // --check: render the spec twice (fresh browser each) and compare the two
  // captures to each other. A drift past threshold means the spec is
  // nondeterministic — it would churn its committed PNG on every regen. Doesn't
  // touch committed files.
  async function checkSpec(spec: BrowserScreenshotSpec) {
    const a = await withFreshPage(spec, p =>
      renderSpecToTemp(p, spec, port, '-a'),
    )
    const b = await withFreshPage(spec, p =>
      renderSpecToTemp(p, spec, port, '-b'),
    )
    reportDiffOrFlaky(spec.name, a, b, spec.diffThreshold ?? diffThreshold)
  }

  // --check for cli specs: render jb2export twice and diff, same contract as
  // checkSpec but without a browser.
  async function checkCliSpec(spec: CliSpec) {
    const a = await renderCliSpecToTemp(spec, '-a')
    const b = await renderCliSpecToTemp(spec, '-b')
    reportDiffOrFlaky(spec.name, a, b, spec.diffThreshold ?? diffThreshold)
  }

  async function runSpec(spec: ScreenshotSpec) {
    if (spec.curated) {
      console.log(`${progress()} ⊘ ${spec.name} (curated, keeping committed image)`)
      return
    }
    console.log(`${progress()} → ${spec.name}`)
    try {
      if (spec.mode === 'cli') {
        await (check ? checkCliSpec(spec) : captureCliSpec(spec))
      } else if (check) {
        await checkSpec(spec)
      } else {
        await withFreshPage(spec, page => captureSpec(page, spec, port))
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
    const queue = [...filteredSpecs]
    const workers = Array.from({ length: CONCURRENCY }, async () => {
      while (queue.length > 0) {
        const spec = queue.shift()!
        await runSpec(spec)
      }
    })
    await Promise.all(workers)
  } finally {
    server?.close()
  }

  console.log(
    `\n${passed} ${check ? 'checked' : 'succeeded'}, ${failed} failed${
      check ? `, ${flaky.length} flaky` : ''
    }`,
  )
  if (flaky.length > 0) {
    printReport(
      `FLAKY SPECS (${flaky.length}) — nondeterministic renders`,
      flaky.map(
        ({ name, frac }) =>
          `• ${name}: ${(frac * 100).toFixed(3)}% drift between renders`,
      ),
    )
    process.exit(1)
  }
  if (failures.length > 0) {
    printReport(
      `FAILURE SUMMARY (${failures.length})`,
      failures.map(
        ({ name, error }) => `\n• ${name}\n  ${error.replace(/\n/g, '\n  ')}`,
      ),
    )
    process.exit(1)
  }
}

main().catch((err: unknown) => {
  console.error(err)
  process.exit(1)
})
