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
  createTestServer,
  findChromeExecutable,
  isBrowserConsoleNoise,
  waitForDisplayPhases,
  waitForViewPhases,
} from '@jbrowse/browser-test-utils'
import { launch } from 'puppeteer'

import { delay, runAction } from './actions.ts'
import {
  clearAnnotations,
  drawAnnotations,
  hideLingeringTooltip,
} from './annotations.ts'
import {
  IM,
  IM_REPRODUCIBLE,
  commitScreenshot,
  imageSize,
  optimizePng,
  pngDiffFraction,
  trailingBackgroundPx,
} from './image-pipeline.ts'
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
  filterTokens,
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
  trackNetwork,
  trustCapturePlugins,
  waitForRasterize,
} from './screenshot-page.ts'
import { captureUrl, readyTimeoutOf } from './screenshot-ready.ts'
import {
  pct,
  printSummary,
  recordOverflow,
  recordReadyPath,
  recordTooltip,
  recordUnpainted,
} from './screenshot-report.ts'
import { selectSpecsToRender } from './screenshot-select.ts'

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

  recordReadyPath(spec.name, await captureUrl(page, spec, port))

  await runActions(page, spec.name, spec.actions)
  // same as in captureStages: actions can kick off a re-render, so wait it out
  // before asserting/capturing rather than racing it
  await waitForDisplayPhases(page, readyTimeoutOf(spec))
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

// Gutter between side-by-side panels — a `stageColumns` grid or a horizontal
// `compose` — in captured (2x) pixels. Two app windows sharing an edge read as
// one window with a seam down it, which is what the border is for; a vertical
// stack doesn't have the problem (the app's own title bar separates the frames)
// and is left abutting, as every stacked figure in the set already is.
const GRID_GUTTER_PX = 24

// One reading of a compose spec's gutter, because two places need it to agree:
// the ImageMagick pass that inserts it and the overlay pass that computes each
// part's box in the finished image. They disagreeing is a callout anchored a
// gutter's worth away from the part it names, which nothing would report.
function composeGutter(spec: ComposeSpec) {
  return spec.gutter ?? (spec.direction === 'horizontal' ? GRID_GUTTER_PX : 0)
}

// White border on each panel, so the pair is separated by a full gutter.
function padPanels(files: string[], gutter = GRID_GUTTER_PX) {
  for (const f of files) {
    execFileSync(IM, [
      f,
      '-bordercolor',
      'white',
      '-border',
      `${gutter / 2}`,
      ...IM_REPRODUCIBLE,
      f,
    ])
  }
}

// One reading of a stacked composition's side margin, for the same reason
// `composeGutter` has one: the ImageMagick pass that inserts it and the overlay
// pass that computes each part's box both need it.
function composeSideMargin(spec: ComposeSpec) {
  return spec.direction === 'horizontal' ? 0 : (spec.sideMargin ?? 0)
}

// White columns down BOTH sides of each part, and no rows. Symmetric, so
// `-border WxH` with H=0 is exactly it, and unlike the gutter this one is a
// margin at the figure's own edges — which is the point of it.
function padSides(files: string[], margin: number) {
  for (const f of files) {
    execFileSync(IM, [
      f,
      '-bordercolor',
      'white',
      '-border',
      `${margin}x0`,
      ...IM_REPRODUCIBLE,
      f,
    ])
  }
}

// A gutter ABOVE each of these files, and nothing below: `-splice` inserts rows
// rather than framing the image, so a stack gains space between its parts
// without gaining a margin at its own top and bottom. `-border` cannot express
// that — it is symmetric by construction — which is why the two directions do
// not share one call.
function spliceGutterAbove(files: string[], gutter: number) {
  for (const f of files) {
    execFileSync(IM, [
      f,
      '-background',
      'white',
      '-splice',
      `0x${gutter}+0+0`,
      ...IM_REPRODUCIBLE,
      f,
    ])
  }
}

// Capture each stage of a multi-stage figure to its own temp file, then stack
// them top-to-bottom with ImageMagick (`convert f0 f1 -append`) into
// `renderPath` — the same composition the hand-made two-stage teaching figures
// used — or into rows of `stageColumns` when the spec asks for a grid.
async function captureStages(
  page: Page,
  spec: BrowserScreenshotSpec,
  stages: ScreenshotStage[],
  renderPath: string,
  port: number,
) {
  const cols = spec.stageColumns ?? 0
  const gutter = spec.stageGutter ?? GRID_GUTTER_PX
  const stageFiles = stages.map((_, i) =>
    tempPath('jb-shot', spec.name, `-${i}`),
  )
  const rowFiles = Array.from(
    { length: cols > 1 ? Math.ceil(stages.length / cols) : 0 },
    (_, i) => tempPath('jb-row', spec.name, `-${i}`),
  )
  try {
    await captureEachStage(page, spec, stages, stageFiles, port)
    // before padPanels, the only moment the frames are their own size
    const sizes = spec.gridAnnotations?.length
      ? await Promise.all(
          stageFiles.map(async f => ({
            ...(await imageSize(f)),
            left: 0,
            top: 0,
          })),
        )
      : undefined
    if (cols > 1) {
      // rows of `cols` frames, then the rows stacked. A trailing partial row is
      // padded on the right to the full row width rather than centered, so the
      // frames stay on a grid a reader can scan down a column of.
      //
      padPanels(stageFiles, gutter)
      for (const [r, row] of rowFiles.entries()) {
        const frames = stageFiles.slice(r * cols, r * cols + cols)
        execFileSync(IM, [...frames, ...IM_REPRODUCIBLE, '+append', row])
      }
      execFileSync(IM, [
        ...rowFiles,
        '-background',
        'white',
        '-gravity',
        'west',
        ...IM_REPRODUCIBLE,
        '-append',
        renderPath,
      ])
    } else {
      execFileSync(IM, [
        ...stageFiles,
        ...IM_REPRODUCIBLE,
        '-append',
        renderPath,
      ])
    }
    if (sizes && spec.gridAnnotations) {
      await overlayOnComposition(
        renderPath,
        spec.gridAnnotations,
        stageBoxes(sizes, cols, gutter),
      )
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
      recordReadyPath(spec.name, await captureUrl(page, stageSpec, port))
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
    // `-append`. The phase wait below covers the re-layout the resize starts.
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
      // page to agree about its own height rather than sleeping on it; the
      // display-phase wait below then covers the re-render the resize starts.
      await page.waitForFunction(h => window.innerHeight === h, {}, height)
    }
    // A stage's actions can start work of their own — alignments_sort_by_base's
    // second stage clicks "Sort by base at position", an async re-sort — and the
    // shot used to race it, landing on the pre-sort order often enough to drift
    // 17% between runs. Wait for the phases the actions disturbed; a no-op when
    // the stage only opened a menu.
    //
    // Views before displays: an action that launches a view (every launch-dialog
    // figure's second stage) leaves a view whose lazily-imported component is
    // still in flight, and a display-level wait is vacuous while no display has
    // mounted — so the shot landed on ViewWrapper's Suspense spinner and the
    // frame published a bare "Loading" panel under a correct view header.
    await waitForViewPhases(page, readyTimeoutOf(spec))
    await waitForDisplayPhases(page, readyTimeoutOf(spec))
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
  return commitTemp(renderPath, path.join(outDir, `${spec.name}.png`), spec)
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

// One part's rect in a finished composition, in the composition's own pixels.
interface PartBox {
  left: number
  top: number
  width: number
  height: number
}

// Draw a compose spec's callouts over the finished composition.
//
// Each part's box is computed from that part's own dimensions and the gutter,
// never measured off the composed image: `+append` top-aligns and `-append`
// left-aligns, and `padPanels` puts half a gutter on every side of a
// side-by-side panel.
async function annotateComposition(spec: ComposeSpec, renderPath: string) {
  const annotations = spec.annotations
  if (!annotations?.length) {
    return
  }
  const gutter = composeGutter(spec)
  const sideMargin = composeSideMargin(spec)
  const sizes = await Promise.all(
    spec.parts.map(part => imageSize(path.join(outDir, `${part}.png`))),
  )
  let offset = 0
  // The two directions pad differently, so the box math differs with them:
  // side by side each part is BORDERED (half a gutter on all four sides, which
  // is what padPanels does), stacked each part after the first is SPLICED (a
  // whole gutter above it, and nothing at the figure's own top or bottom).
  const boxes = sizes.map((size, i) => {
    const box =
      spec.direction === 'horizontal'
        ? { left: offset + gutter / 2, top: gutter / 2, ...size }
        : { left: sideMargin, top: offset + i * gutter, ...size }
    offset +=
      spec.direction === 'horizontal' ? size.width + gutter : size.height
    return box
  })
  await overlayOnComposition(renderPath, annotations, boxes)
}

// Where each stage frame lands in the composition `captureStages` built, so a
// `stages` spec can carry the same overlay a `compose` one does. Derived from
// the append rather than measured off the result: a single column is a bare
// `-append` of unpadded frames; a grid is `padPanels` (half a gutter every
// side) then `+append` per row then `-append` of the rows.
function stageBoxes(sizes: PartBox[], cols: number, gutter: number): PartBox[] {
  if (cols <= 1) {
    let top = 0
    return sizes.map(size => {
      const box = { ...size, left: 0, top }
      top += size.height
      return box
    })
  }
  const boxes: PartBox[] = []
  let top = 0
  for (let start = 0; start < sizes.length; start += cols) {
    const row = sizes.slice(start, start + cols)
    let left = 0
    for (const size of row) {
      boxes.push({
        ...size,
        left: left + gutter / 2,
        top: top + gutter / 2,
      })
      left += size.width + gutter
    }
    top += Math.max(...row.map(s => s.height)) + gutter
  }
  return boxes
}

// Draw callouts over a finished composition, with one anchorable element per
// part.
//
// The composition is a flat PNG with no app in it, so this opens a page that is
// nothing but that image and one absolutely-positioned element per part, and
// runs the SAME overlay every other figure's callouts go through — the parts
// are then anchorable by `[data-part="N"]` and the pill/arrow/badge vocabulary
// is one implementation rather than an ImageMagick lookalike beside it. It is
// also the only way a jb2export part can carry a callout at all: those render
// through React SSR with no browser involved.
//
// deviceScaleFactor 1 with the viewport and the img sized to the PNG's own
// pixels, so the capture is the composition unresampled with the overlay on
// top. A CLI part is 1x and an app part is 2x; this pass does not know which,
// and does not have to.
async function overlayOnComposition(
  renderPath: string,
  annotations: Annotation[],
  boxes: PartBox[],
) {
  const { width, height } = await imageSize(renderPath)
  // The page is written beside the image and opened as a file:// URL rather
  // than pushed in with setContent: an about:blank page cannot load a file://
  // subresource, so the img would come back empty and the capture would be the
  // callouts on white.
  const pagePath = `${renderPath}.html`
  fs.writeFileSync(
    pagePath,
    `<!doctype html><html><body style="margin:0;background:#fff">
<img src="${path.basename(renderPath)}" style="display:block;width:${width}px;height:${height}px">
${boxes
  .map(
    (b, i) =>
      `<div data-part="${i}" style="position:absolute;left:${b.left}px;top:${b.top}px;width:${b.width}px;height:${b.height}px"></div>`,
  )
  .join('\n')}
</body></html>`,
  )
  // `--window-size` IS LOAD-BEARING, and its absence fails in a way that looks
  // like a corrupt figure rather than a capture bug: a viewport wider than the
  // window screenshots as the leftmost window-width of the page TILED across
  // the frame. `page.evaluate` reading the same image into a canvas returns the
  // right pixels throughout, so nothing about the page or the PNG is wrong --
  // only the compositor surface the screenshot is taken off. A composition is
  // routinely 3000+ px wide (three 1000 px panels), which is where this bites;
  // the app captures never do, because their viewport is CSS px at
  // deviceScaleFactor 2. Not fixable with captureBeyondViewport or fullPage,
  // both tried.
  //
  // The window is asked for LARGER than the frame in both directions, because
  // `--window-size` is the outer window and the surface inside it is smaller by
  // whatever chrome the headless build draws -- at an exact fit the bottom
  // ~60 px tiled while the rest was correct, which is the same bug in its
  // easiest-to-miss form. The viewport override still fixes the page's layout
  // size, so the slack costs nothing.
  const browser = await launch({
    headless: true,
    executablePath: findChromeExecutable(),
    args: [...BASE_CHROME_ARGS, `--window-size=${width + 100},${height + 300}`],
  })
  try {
    const page = await browser.newPage()
    await page.setViewport({ width, height, deviceScaleFactor: 1 })
    await page.goto(`file://${pagePath}`, { waitUntil: 'load' })
    await drawAnnotations(page, annotations)
    await page.screenshot({ path: renderPath })
  } finally {
    await browser.close()
    fs.rmSync(pagePath, { force: true })
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
  const renderPath = tempPath('jb-compose', spec.name)
  const horizontal = spec.direction === 'horizontal'
  const gutter = composeGutter(spec)
  const sideMargin = composeSideMargin(spec)
  // Any padding at all goes on a COPY of the part. They are the committed part
  // PNGs, so padding them in place makes every part figure grow a white frame
  // of its own each time the compose runs.
  const padded = horizontal || gutter > 0 || sideMargin > 0
  const partPaths = spec.parts.map((part, i) =>
    padded ? tempPath('jb-part', spec.name, `-${i}`) : partPath(part),
  )
  try {
    if (padded) {
      for (const [i, part] of spec.parts.entries()) {
        fs.copyFileSync(partPath(part), partPaths[i]!)
      }
      if (horizontal) {
        padPanels(partPaths, gutter)
      } else {
        if (gutter > 0) {
          // every part but the first, so the gutters land between them
          spliceGutterAbove(partPaths.slice(1), gutter)
        }
        if (sideMargin > 0) {
          // every part, so `-append` still left-aligns them onto one width
          padSides(partPaths, sideMargin)
        }
      }
    }
    execFileSync(IM, [
      ...partPaths,
      ...IM_REPRODUCIBLE,
      horizontal ? '+append' : '-append',
      renderPath,
    ])
    await annotateComposition(spec, renderPath)
    optimizePng(renderPath)
    return commitTemp(renderPath, path.join(outDir, `${spec.name}.png`), spec)
  } finally {
    if (padded) {
      for (const f of partPaths) {
        fs.rmSync(f, { force: true })
      }
    }
  }
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
    skipped: [],
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
  // The liveness probe is the test, not the message text: the misleading shape
  // carries no signature to match on. One retry, in a new browser, and a second
  // death is reported as the failure it then is.
  async function withFreshPage<T>(
    spec: BrowserScreenshotSpec,
    body: (page: Page) => Promise<T>,
  ): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      const browser = await launch(
        buildLaunchOptions(firefox || !!spec.firefox),
      )
      try {
        const page = await browser.newPage()
        await freezeAnimations(page)
        await trustCapturePlugins(page)
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
        try {
          return await body(page)
        } catch (err) {
          const alive = await Promise.race([
            page.evaluate(() => true).catch(() => false),
            // unref'd, or the loser of this race holds the event loop open for
            // its full delay after the last spec has been written
            new Promise<boolean>(resolve => {
              setTimeout(() => {
                resolve(false)
              }, LIVENESS_PROBE_MS).unref()
            }),
          ])
          if (!alive && attempt === 0) {
            console.error(
              `    [${spec.name}] page died mid-capture, retrying once in a fresh browser`,
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

  // Selected and then not rendered. Recorded with its reason, not just counted:
  // the committed PNG stays, so the figure looks current, and only this list
  // says the run declined to check it.
  function skip(spec: ScreenshotSpec, reason: string) {
    console.log(`${progress()} ⊘ ${spec.name} (${reason})`)
    totals.skipped.push({ name: spec.name, reason })
  }

  async function runSpec(spec: ScreenshotSpec) {
    if (spec.curated) {
      skip(spec, 'curated, keeping committed image')
      return
    }
    // Not gated on --filter, unlike heavyNetwork: naming this one in a
    // headless run does not make it renderable, it just fails more explicitly.
    if (spec.headedOnly && !headed) {
      skip(spec, 'needs a real GPU; re-run with --headed')
      return
    }
    if (spec.heavyNetwork && !filterTokens.length) {
      skip(spec, 'heavy remote data; name it in --filter to re-render')
      return
    }
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
