// Renders every figure the website publishes, from the specs in
// screenshot-specs.ts. Run it with `node`, not `npx tsx` — tsx's `keepNames`
// breaks the functions that get serialized into page context.
//
// This file is the pipeline itself: drive a spec to a finished frame, decide
// whether that frame replaces the committed PNG, and run the pool that does it
// for 328 of them. The parts that are about one concern each live beside it —
// screenshot-options (the CLI and what it derives), -select (which specs this
// run will render, and the diff gate's precondition), -ready (getting a page to
// the state a figure shows), -asserts (the gates a frame passes before it is
// allowed to exist), -page (per-page setup and network diagnosis), -report
// (what the run noticed and how it says so), -embedded (the component-only
// capture mode).
import { execFile, execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { promisify } from 'node:util'

import {
  BASE_CHROME_ARGS,
  clearAnnotations,
  createTestServer,
  drawAnnotations,
  findChromeExecutable,
  isBrowserConsoleNoise,
} from '@jbrowse/browser-test-utils'
import { launch } from 'puppeteer'

import { delay, runAction } from './actions.ts'
import {
  commitScreenshot,
  optimizePng,
  pngDiffFraction,
  trailingBackgroundPx,
} from './image-pipeline.ts'
import { arrangeFrames } from './screenshot-arrange.ts'
import {
  assertRenderSettled,
  assertSamePageAsReady,
  assertViewsPresent,
  assertViewsRendered,
  debugDump,
} from './screenshot-asserts.ts'
import { captureEmbeddedToTemp } from './screenshot-embedded.ts'
import {
  CONCURRENCY,
  DEVICE_SCALE_FACTOR,
  SLACK_WARN_PX,
  buildPath,
  check,
  diffThreshold,
  externalPort,
  firefox,
  forceCommit,
  headed,
  jb2exportBin,
  jbrowseImgDir,
  jbrowseImgOutDir,
  outDir,
  repoRoot,
  servePort,
  tempPath,
  testDataRoot,
} from './screenshot-options.ts'
import {
  describeNetwork,
  freezeAnimations,
  isFatalConsole,
  serveUrlOverrides,
  trackNetwork,
  trustCapturePlugins,
  waitForRasterize,
} from './screenshot-page.ts'
import { captureUrl, waitForSpecFrame } from './screenshot-ready.ts'
import {
  pct,
  printSummary,
  recordOverflow,
  recordTooltip,
  recordUnpainted,
} from './screenshot-report.ts'
import { selectSpecsToRender } from './screenshot-select.ts'
import { DEFAULT_VIEWPORT } from './screenshot-spec-types.ts'
import { hideLingeringTooltip } from './tooltips.ts'

import type { CommitResult } from './image-pipeline.ts'
import type { RunTotals } from './screenshot-report.ts'
import type {
  Annotation,
  BrowserScreenshotSpec,
  CliSpec,
  ComposeSpec,
  ScreenshotAction,
  ScreenshotSpec,
  ScreenshotStage,
} from './screenshot-specs.ts'
import type { Server } from 'node:http'
import type { Page } from 'puppeteer'

const execFileAsync = promisify(execFile)

class FatalConsoleError extends Error {}

// What `withFreshPage` heard the page say that fails its spec, read before the
// frame is committed so a failing figure never reaches the disk.
const pageFatal = new WeakMap<Page, string>()

// Apply the shared pre-shot steps (hide stray tooltip, draw/clear callouts,
// flush pending WebGL frames) then screenshot straight to `file`.
async function shoot(
  page: Page,
  spec: BrowserScreenshotSpec,
  annotations: Annotation[] | undefined,
  file: string,
) {
  if (spec.tooltip === 'hide') {
    await hideLingeringTooltip(page)
  } else {
    // Not hidden — a tooltip is often what a figure is demonstrating. Recorded
    // instead, so the run can say when one showed up that the spec never asked
    // for (the kind a click sequence leaves behind on whatever control it ended
    // on) or when a figure that IS about a tooltip lost it.
    await recordTooltip(page, spec.name)
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
  await recordUnpainted(page, spec.name)
  // last gate before anything is written: same document we readied?
  await assertSamePageAsReady(page, spec)
  await page.screenshot({ path: file, clip: spec.crop })
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
  // The gates they must not bypass with it are applied inside that function,
  // where they can still run before the frame is written.
  if (spec.mode === 'embedded') {
    return captureEmbeddedToTemp(page, spec, suffix)
  }

  await captureUrl(page, spec, port)

  if (spec.actions?.length) {
    await runActions(page, spec.name, spec.actions)
    await waitForSpecFrame(page, spec)
  }
  await assertViewsPresent(page, spec)
  await assertViewsRendered(page, spec.name)
  if (!spec.allowUnsettled) {
    await assertRenderSettled(page, spec)
  }

  const renderPath = tempPath('jb-final', spec.name, suffix)
  if (spec.stages && spec.stages.length > 0) {
    await captureStages(page, spec, spec.stages, renderPath, port)
  } else {
    await shoot(page, spec, spec.annotations, renderPath)
    if (!spec.crop) {
      await recordOverflow(page, spec.name)
    }
  }
  optimizePng(renderPath)
  return renderPath
}

// Capture each stage of a multi-stage figure to its own temp file, then
// arrange the frames into `renderPath`.
async function captureStages(
  page: Page,
  spec: BrowserScreenshotSpec,
  stages: ScreenshotStage[],
  renderPath: string,
  port: number,
) {
  const stageFiles = stages.map((_, i) =>
    tempPath('jb-shot', spec.name, `-${i}`),
  )
  try {
    await captureEachStage(page, spec, stages, stageFiles, port)
    await arrangeFrames(stageFiles, renderPath, {
      columns: spec.stageColumns,
      gutter: spec.stageGutter,
      annotations: spec.gridAnnotations,
    })
  } finally {
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

// The spec a stage is judged against: its own if it loaded a session of its
// own, else the figure's. `url` carries the declared view tree that
// assertViewsPresent checks and the ready gate that captureUrl waits on, so a
// stage that navigates has to bring both, or it would be readied and asserted
// against the page it replaced.
function specForStage(
  spec: BrowserScreenshotSpec,
  stage: ScreenshotStage,
): BrowserScreenshotSpec {
  if (!stage.url) {
    return spec
  }
  if (spec.mode !== 'url') {
    throw new Error(
      `${spec.name}: a stage "url" needs a url-mode spec (this one is ${spec.mode})`,
    )
  }
  return {
    ...spec,
    url: stage.url,
    readySelector: stage.readySelector ?? spec.readySelector,
    readyText: undefined,
  }
}

// Drive each stage and leave its frame in the matching stageFiles entry.
async function captureEachStage(
  page: Page,
  spec: BrowserScreenshotSpec,
  stages: ScreenshotStage[],
  stageFiles: string[],
  port: number,
) {
  for (const [i, stage] of stages.entries()) {
    const stageSpec = specForStage(spec, stage)
    // A stage that declares its own session loads it instead of inheriting the
    // page the previous stage left. For a frame that is a RESULT rather than a
    // step: the end state is written as a session spec, not clicked together.
    // Resize first, so the load lays out at the height the frame is captured at.
    if (stage.url && stageSpec.mode === 'url') {
      const viewport = page.viewport()
      if (stage.viewportHeight && viewport) {
        await page.setViewport({ ...viewport, height: stage.viewportHeight })
      }
      await captureUrl(page, stageSpec, port)
    }
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
    // `-append`. The frame wait below covers the re-layout the resize starts.
    const viewport = page.viewport()
    if (
      stage.viewportHeight &&
      viewport &&
      viewport.height !== stage.viewportHeight
    ) {
      const height = stage.viewportHeight
      await page.setViewport({ ...viewport, height })
      // setViewport resolves on the CDP call, not on the page having laid out
      // at the new size, so the frame could be taken mid-reflow. Wait for the
      // page to agree about its own height rather than sleeping on it.
      await page.waitForFunction(h => window.innerHeight === h, {}, height)
    }
    await waitForSpecFrame(page, spec)
    await shoot(page, spec, stage.annotations, stageFiles[i]!)
    if (!spec.crop) {
      await recordOverflow(page, spec.name)
    }
    // re-check after each stage capture: these only run once before the loop,
    // so a stage that dismisses a view or captures a blank view body (a rare
    // paint race after the stage's interaction) would otherwise be committed
    // silently — the staged frames ARE the published image.
    await assertViewsPresent(page, stageSpec)
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
    force: forceCommit,
    diffThreshold: specThreshold(spec),
    baseThreshold: diffThreshold,
  })
}

// Commit a finished temp capture, and make sure it does not outlive this call
// whatever happens. `commit` removes the temp file on both of its paths, so the
// rm is a no-op in the normal case — it is there for the ones between the render
// and the commit (a mkdir that fails, a diff that throws), which otherwise leave
// a multi-megabyte PNG in tmpdir per failed spec.
function commitTemp(
  renderPath: string,
  outputPath: string,
  spec: ScreenshotSpec,
) {
  try {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true })
    return commit(renderPath, outputPath, spec)
  } finally {
    fs.rmSync(renderPath, { force: true })
  }
}

async function captureSpec(
  page: Page,
  spec: BrowserScreenshotSpec,
  port: number,
) {
  const renderPath = await renderSpecToTemp(page, spec, port)
  const fatal = pageFatal.get(page)
  if (fatal !== undefined) {
    throw new FatalConsoleError(fatal)
  }
  return commitTemp(renderPath, path.join(outDir, `${spec.name}.png`), spec)
}

// jb2export runs from source but resolves every @jbrowse/* import to that
// package's built `esm/` (products/jbrowse-img/src/resolve.ts), and nothing
// else in this pipeline reads that output — so a sweep following a source
// change renders whatever commit esm/ was last built from. Stale it draws old
// code and looks right; inconsistent it dies on ERR_MODULE_NOT_FOUND naming a
// module the current source deleted, which is what took out the three
// sv_review specs. The browser path already refuses to start without its build;
// this is the same precondition for the CLI path, and `tsc --build` is
// incremental — ~1.5s when there is nothing to do.
function buildWorkspaceEsm() {
  console.log('Building workspace esm/ that jb2export specs render from')
  try {
    execFileSync('pnpm', ['build:esm'], { cwd: repoRoot, stdio: 'inherit' })
  } catch {
    console.error(
      'pnpm build:esm failed — jb2export specs would render from a stale esm/',
    )
    process.exit(1)
  }
}

function buildJbrowseWeb() {
  console.log('Building jbrowse-web')
  try {
    // `@jbrowse/web`, not `jbrowse-web`: the DIRECTORY is products/jbrowse-web
    // but pnpm --filter matches the package name, and the wrong one exits 0 having
    // built nothing ("No projects matched the filters"). So this helper silently
    // did not build, and the stale bundle then failed every graph figure on a
    // plugin load error five minutes deep — see test_data/graphgenomeview/README.md.
    // The `screenshots:build` npm script had it right all along, which is why
    // this went unnoticed.
    execFileSync('pnpm', ['--filter', '@jbrowse/web', 'build'], {
      cwd: repoRoot,
      stdio: 'inherit',
    })
  } catch {
    console.error('pnpm build failed — could not build jbrowse-web')
    process.exit(1)
  }
}

// jb2export renders the products/jbrowse-img/README example images straight
// to PNG via React SSR (see CliSpec in screenshot-specs.ts) — no browser
// involved, so this bypasses the puppeteer pipeline entirely. `suffix` keeps
// the two captures of a --check run from colliding on the same temp path.
async function renderCliSpecToTemp(spec: CliSpec, suffix = '') {
  const renderPath = tempPath('jb-img', spec.name, suffix)
  await execFileAsync(
    'node',
    [
      '--experimental-strip-types',
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
  const result = commitTemp(renderPath, outputPath, spec)
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

// Arrange the committed PNGs of `spec.parts`. Runs after the render pool, so
// the parts are already fresh on disk.
async function captureComposeSpec(spec: ComposeSpec) {
  const partPaths = spec.parts.map(part => path.join(outDir, `${part}.png`))
  const missing = spec.parts.filter((_, i) => !fs.existsSync(partPaths[i]!))
  if (missing.length > 0) {
    throw new Error(`missing part image(s): ${missing.join(', ')}`)
  }
  const renderPath = tempPath('jb-compose', spec.name)
  const horizontal = spec.direction === 'horizontal'
  await arrangeFrames(partPaths, renderPath, {
    columns: horizontal ? spec.parts.length : 1,
    gutter: spec.gutter,
    sideMargin: horizontal ? undefined : spec.sideMargin,
    annotations: spec.annotations,
  })
  optimizePng(renderPath)
  return commitTemp(renderPath, path.join(outDir, `${spec.name}.png`), spec)
}

async function main() {
  // What this run will render, and why — every flag composes by intersection,
  // and the diff gate's own precondition is checked there too. `undefined` is
  // "nothing to do", which a --affected run on a docs-only change has to be able
  // to answer with exit 0.
  const filteredSpecs = await selectSpecsToRender()
  if (!filteredSpecs) {
    return
  }

  if (filteredSpecs.some(s => s.mode === 'cli')) {
    buildWorkspaceEsm()
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
      buildJbrowseWeb()
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
    ...DEFAULT_VIEWPORT,
    deviceScaleFactor: DEVICE_SCALE_FACTOR,
  }
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

  let started = 0
  const total = renderSpecs.length + composeSpecs.length
  // One object rather than ten bindings, because printSummary takes exactly
  // this and the ten used to be re-assembled into it by hand at the bottom of
  // the function — a literal that could drift from the declarations without
  // anything noticing.
  //
  // `selected` is what this run set out to render, recorded rather than
  // inferred. Every other list here is an exception, so a spec that renders fine
  // and unchanged leaves no trace — and the review UI cannot tell that from a
  // spec the run never reached unless the selection itself is written down.
  const totals: RunTotals = {
    passed: 0,
    failed: 0,
    kept: 0,
    selected: [...renderSpecs, ...composeSpecs].map(s => s.name),
    failures: [],
    flaky: [],
    changed: [],
    suppressed: [],
    slacked: [],
  }

  // Zero-padded `[ 7/40]` so the counter column stays aligned as it grows,
  // keeping the interleaved per-worker lines readable.
  function progress() {
    started += 1
    return `[${String(started).padStart(String(total).length)}/${total}]`
  }

  // How long a page gets to answer "are you still there" after its capture has
  // already failed. A renderer under memory pressure can be slow rather than
  // gone, and the difference stops mattering once it has missed its ready wait:
  // both answers cost one re-render, and only one of them can produce a figure.
  const LIVENESS_PROBE_MS = 5000

  // Fresh browser per call (avoids service-worker caching between navigations),
  // viewport set per spec, then run the body with the prepared page.
  //
  // Retried once when the PAGE died rather than the capture failing, which on a
  // loaded machine is most of what a long run reports. Chrome's renderer going
  // away surfaces as `frame got detached` if a wait was mid-flight and as an
  // ordinary selector timeout if it wasn't — that second shape is
  // indistinguishable from a display that never painted, and it is what sent a
  // 2026-08-15 sweep's Hi-C block to be investigated as a rendering regression
  // when the specs passed on an idle box. Whichever specs are in flight when the
  // machine tips over are the ones named, so the summary was about load.
  //
  // Puppeteer's `error` event is the renderer crashing, and it ends the attempt
  // at once: otherwise every wait in flight runs out its full readyTimeout
  // first, and Chrome can hand the tab a fresh renderer that answers the
  // liveness probe. The probe covers the deaths that event misses. One retry,
  // in a new browser, and a second death is reported as the failure it then is.
  // A frame can look plausible while the page says it is broken: a hosted
  // plugin's config naming a display type main no longer registers drew the
  // track without it, and a menu whose builder threw drew no menu. Both
  // surfaced only when an unrelated wait later timed out, so either fails the
  // spec here, by name. `expectedConsole` still exempts a spec about an error.
  async function withFreshPage<T>(
    spec: BrowserScreenshotSpec,
    body: (page: Page) => Promise<T>,
  ): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      const browser = await launch(buildLaunchOptions(firefox))
      try {
        const page = await browser.newPage()
        await freezeAnimations(page)
        await trustCapturePlugins(page)
        await serveUrlOverrides(page)
        if (spec.viewportHeight || spec.viewportWidth) {
          await page.setViewport({
            ...defaultViewport,
            ...(spec.viewportWidth ? { width: spec.viewportWidth } : {}),
            ...(spec.viewportHeight ? { height: spec.viewportHeight } : {}),
          })
        }
        const report = (kind: string, text: string) => {
          const expected = spec.expectedConsole?.some(s => text.includes(s))
          if (!isBrowserConsoleNoise(text) && !expected) {
            console.error(
              `    [${spec.name}] browser[${kind}]: ${text.substring(0, 300)}`,
            )
            if (
              (kind === 'pageerror' || isFatalConsole(text)) &&
              !pageFatal.has(page)
            ) {
              pageFatal.set(page, `browser[${kind}]: ${text.substring(0, 300)}`)
            }
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
        const net = trackNetwork(page)
        let crashError: Error | undefined
        const crash = new Promise<never>((_, reject) => {
          page.once('error', err => {
            crashError = err
            reject(err)
          })
        })
        const run = body(page)
        crash.catch(() => {})
        run.catch(() => {})
        try {
          const result = await Promise.race([run, crash])
          const fatal = pageFatal.get(page)
          if (fatal !== undefined) {
            throw new FatalConsoleError(fatal)
          }
          return result
        } catch (err) {
          if (err instanceof FatalConsoleError) {
            throw err
          }
          const alive =
            !crashError &&
            (await Promise.race([
              page.evaluate(() => true).catch(() => false),
              // unref'd, or the loser of this race holds the event loop open for
              // its full delay after the last spec has been written
              new Promise<boolean>(resolve => {
                setTimeout(() => {
                  resolve(false)
                }, LIVENESS_PROBE_MS).unref()
              }),
            ]))
          if (!alive && attempt === 0) {
            console.error(
              `    [${spec.name}] ${crashError ? 'renderer crashed' : 'page died'} mid-capture, retrying once in a fresh browser`,
            )
            continue
          }
          // Attach the diagnosis to the error itself rather than logging it here,
          // so it travels into `failures` and gets reprinted in the FAILURE
          // SUMMARY. That summary is the only part of a long concurrent run
          // anyone reads.
          const detail = describeNetwork(net)
          const died = alive
            ? ''
            : '\n  the page was gone when this was reported'
          throw err instanceof Error
            ? new Error(`${err.message}${detail}${died}`, { cause: err })
            : err
        }
      } finally {
        await browser.close()
      }
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
    // The cleanup is a finally, not two rmSyncs after the diff: the second
    // render is the one that fails (a flaky spec is why anyone runs --check),
    // and that left the first capture behind in tmpdir on every such failure.
    const captures: string[] = []
    let frac: number | null
    try {
      for (const suffix of ['-a', '-b']) {
        captures.push(await render(suffix))
      }
      frac = pngDiffFraction(captures[0]!, captures[1]!)
    } finally {
      for (const f of captures) {
        fs.rmSync(f, { force: true })
      }
    }
    if (frac === null || frac >= specThreshold(spec)) {
      const drift = frac === null ? 'size-mismatch' : pct(frac)
      console.log(`  ✗ ${spec.name} FLAKY (${drift} between two renders)`)
      totals.flaky.push({ name: spec.name, frac: frac ?? 1 })
    } else {
      console.log(`  ✓ ${spec.name} stable (${pct(frac)})`)
    }
  }

  async function runSpec(spec: ScreenshotSpec) {
    // Stacking a part that just failed to render would publish a figure half
    // made of a stale image, and the run would still report success.
    const brokenParts =
      spec.mode === 'compose'
        ? spec.parts.filter(p => totals.failures.some(f => f.name === p))
        : []
    if (brokenParts.length > 0) {
      const error = `part(s) failed to render this run: ${brokenParts.join(', ')} — not restacking a figure from stale parts`
      console.error(`${progress()} ✗ ${spec.name}: ${error}`)
      totals.failed++
      totals.failures.push({ name: spec.name, error })
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
          totals.kept++
          if (result.raisedGate) {
            totals.suppressed.push({ name: spec.name, frac: result.frac })
          }
        } else {
          totals.changed.push({ name: spec.name, result })
          // Only for an image this run actually wrote. Slack is news when it
          // appears — the app or a plugin started laying something out shorter
          // — and 28% of the committed corpus has some, most of it a deliberate
          // framing choice around a dialog or an empty state. Reporting all of
          // it every run would be noise nobody reads; reporting the ones that
          // just moved is the signal.
          const slack = await trailingBackgroundPx(
            path.join(outDir, `${spec.name}.png`),
          )
          if (slack !== null && slack > SLACK_WARN_PX) {
            totals.slacked.push({ name: spec.name, px: slack })
          }
        }
      }
      totals.passed++
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err)
      console.error(`  ✗ ${spec.name}: ${error}`)
      totals.failed++
      totals.failures.push({ name: spec.name, error })
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

  printSummary(totals)
  // exit non-zero once, after every report prints — a --check run can be both
  // flaky and have hard failures, and swallowing either report hides real work
  if (totals.flaky.length > 0 || totals.failures.length > 0) {
    process.exit(1)
  }
}

main().catch((err: unknown) => {
  console.error(err)
  process.exit(1)
})
