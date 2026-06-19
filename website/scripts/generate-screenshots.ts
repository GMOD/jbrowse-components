import { execFileSync } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { fileURLToPath } from 'url'
import { parseArgs } from 'util'

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
import { specs } from './screenshot-specs.ts'

import type {
  Annotation,
  ScreenshotAction,
  ScreenshotSpec,
} from './screenshot-specs.ts'
import type { Server } from 'http'
import type { Page } from 'puppeteer'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Strict parsing rejects unknown flags (a typo'd `--fliter` fails loudly
// instead of silently screenshotting every spec) and accepts `--x=y` or `--x y`.
const { values } = parseArgs({
  args: process.argv.slice(2),
  allowPositionals: false,
  options: {
    headed: { type: 'boolean', default: false },
    filter: { type: 'string' },
    exact: { type: 'boolean', default: false },
    // point the proxy at an already-running app server instead of build/
    port: { type: 'string' },
    localport: { type: 'string' },
    concurrency: { type: 'string' },
    // overwrite every PNG, bypassing the content-stable diff gate
    force: { type: 'boolean', default: false },
    // render each spec twice and fail if the two captures drift past threshold,
    // without touching committed PNGs — a CI guard against newly-flaky specs
    check: { type: 'boolean', default: false },
    // fraction-of-pixels diff below which a re-render keeps the committed PNG
    'diff-threshold': { type: 'string' },
  },
})

// Parse a numeric CLI option, falling back when absent or non-finite.
function numOpt(raw: string | undefined, fallback: number) {
  const n = raw ? Number(raw) : Number.NaN
  return Number.isFinite(n) ? n : fallback
}

const { headed, filter, exact, force, check } = values
// With dithering disabled (see optimizePng) flat-UI specs re-render byte-for-
// byte, but text-heavy specs still drift ~0.2% from headless-Chrome sub-pixel
// glyph-positioning jitter (ruler/track labels, SNP ticks render a hair
// differently run-to-run). 0.5% absorbs that with ~2.5x margin while still
// letting a genuine edit — a new legend, a moved element — through. Raise it
// further for timing/remote-data specs.
const DEFAULT_DIFF_THRESHOLD = 0.005
const diffThreshold = numOpt(values['diff-threshold'], DEFAULT_DIFF_THRESHOLD)
const externalPortVal = numOpt(values.port, Number.NaN)
const externalPort = Number.isFinite(externalPortVal)
  ? externalPortVal
  : undefined
const DEFAULT_PORT = numOpt(values.localport, 3334)
const CONCURRENCY = numOpt(values.concurrency, headed ? 1 : 4)

const repoRoot = path.resolve(__dirname, '..', '..')
const buildPath = path.resolve(repoRoot, 'products', 'jbrowse-web', 'build')
const testDataRoot = path.resolve(repoRoot, 'products', 'jbrowse-web')
const outDir = path.resolve(__dirname, '..', 'static', 'img')
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
  console.error(`    debug text: ${bodyText.replace(/\s+/g, ' ').trim()}`)
  const debugPath = path.join(outDir, `debug_${name.replace(/\//g, '_')}.png`)
  await page
    .screenshot()
    .then(png => {
      fs.writeFileSync(debugPath, png)
    })
    .catch(() => {})
  console.error(`    debug screenshot: ${debugPath}`)
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
  spec: ScreenshotSpec,
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
  // Wait for the browser to actually rasterize the current DOM before capturing.
  // A single rAF callback fires *before* paint, so a freshly-composited layer —
  // e.g. a just-opened menu Popper, on its own GPU layer that software-GL
  // (swiftshader) rasterizes a frame late at deviceScaleFactor 2 — can be fully
  // settled in the DOM (opacity:1, laid out) yet still absent from the capture,
  // the dominant cause of menu-spec flakiness. Two chained rAFs guarantee a full
  // frame committed; the trailing settle gives slow layer rasterization a beat.
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
  const clip = spec.crop
  await page.screenshot(clip ? { path: file, clip } : { path: file })
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
  spec: ScreenshotSpec,
  port: number,
  suffix = '',
) {
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

async function captureSpec(page: Page, spec: ScreenshotSpec, port: number) {
  console.log(`  → ${spec.name}`)
  const renderPath = await renderSpecToTemp(page, spec, port)
  const outputPath = path.join(outDir, `${spec.name}.png`)
  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  commitScreenshot(renderPath, outputPath, spec.name, {
    force,
    diffThreshold: spec.diffThreshold ?? diffThreshold,
  })
}

async function main() {
  // `--filter a,b,c` matches a spec when any comma-separated token matches, so
  // "re-render these few" is one invocation instead of a shell loop.
  const filterTokens = filter
    ? filter
        .split(',')
        .map(t => t.trim())
        .filter(Boolean)
    : []
  const filteredSpecs =
    filterTokens.length > 0
      ? specs.filter(s =>
          filterTokens.some(t => (exact ? s.name === t : s.name.includes(t))),
        )
      : specs

  if (filteredSpecs.length === 0) {
    console.error(`No specs match filter: ${filter}`)
    process.exit(1)
  }

  console.log(
    `Generating ${filteredSpecs.length} screenshot(s)${filter ? ` (filter: ${filter})` : ''}`,
  )

  const needsLocalServer = filteredSpecs.some(
    s => s.mode !== 'url' || !s.url.startsWith('http'),
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

  const launchOptions = {
    headless: !headed,
    executablePath,
    args: [...BASE_CHROME_ARGS, '--enable-unsafe-swiftshader'],
    // wider viewport for more genomic context; deviceScaleFactor 2 keeps the
    // capture hidpi/retina-crisp (2x backing store) at the larger size
    defaultViewport: { width: 1500, height: 800, deviceScaleFactor: 2 },
  }
  const { width: vpWidth, deviceScaleFactor } = launchOptions.defaultViewport

  let passed = 0
  let failed = 0
  const failures: { name: string; error: string }[] = []
  const flaky: { name: string; frac: number }[] = []

  // Fresh browser per call (avoids service-worker caching between navigations),
  // viewport set per spec, then run the body with the prepared page.
  async function withFreshPage<T>(
    spec: ScreenshotSpec,
    body: (page: Page) => Promise<T>,
  ) {
    const browser = await launch(launchOptions)
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
          console.error(`    browser[${t}]: ${msg.text().substring(0, 300)}`)
        }
      })
      return await body(page)
    } finally {
      await browser.close()
    }
  }

  // --check: render the spec twice (fresh browser each) and compare the two
  // captures to each other. A drift past threshold means the spec is
  // nondeterministic — it would churn its committed PNG on every regen. Doesn't
  // touch committed files.
  async function checkSpec(spec: ScreenshotSpec) {
    console.log(`  → ${spec.name}`)
    const a = await withFreshPage(spec, p =>
      renderSpecToTemp(p, spec, port, '-a'),
    )
    const b = await withFreshPage(spec, p =>
      renderSpecToTemp(p, spec, port, '-b'),
    )
    const frac = pngDiffFraction(a, b)
    fs.rmSync(a, { force: true })
    fs.rmSync(b, { force: true })
    const limit = spec.diffThreshold ?? diffThreshold
    if (frac === null || frac >= limit) {
      const pct =
        frac === null ? 'size-mismatch' : `${(frac * 100).toFixed(3)}%`
      console.log(`  ✗ ${spec.name} FLAKY (${pct} between two renders)`)
      flaky.push({ name: spec.name, frac: frac ?? 1 })
    } else {
      console.log(`  ✓ ${spec.name} stable (${(frac * 100).toFixed(3)}%)`)
    }
  }

  async function runSpec(spec: ScreenshotSpec) {
    if (spec.curated) {
      console.log(`  ⊘ ${spec.name} (curated, keeping committed image)`)
      return
    }
    try {
      if (check) {
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
    console.error(`\n${'='.repeat(60)}`)
    console.error(`FLAKY SPECS (${flaky.length}) — nondeterministic renders`)
    console.error('='.repeat(60))
    for (const { name, frac } of flaky) {
      console.error(
        `• ${name}: ${(frac * 100).toFixed(3)}% drift between renders`,
      )
    }
    console.error(`\n${'='.repeat(60)}`)
    process.exit(1)
  }
  if (failures.length > 0) {
    console.error(`\n${'='.repeat(60)}`)
    console.error(`FAILURE SUMMARY (${failures.length})`)
    console.error('='.repeat(60))
    for (const { name, error } of failures) {
      console.error(`\n• ${name}`)
      console.error(`  ${error.replace(/\n/g, '\n  ')}`)
    }
    console.error(`\n${'='.repeat(60)}`)
    process.exit(1)
  }
}

main().catch((err: unknown) => {
  console.error(err)
  process.exit(1)
})
