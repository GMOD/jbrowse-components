// What does the off-screen mate figure's own view actually hold?
//
//   node website/scripts/probe-offscreen-mates.ts
//
// A figure of a strip of marks cannot be read against the data behind it by eye:
// every mark is a few pixels wide, the names are drawn per STRETCH rather than
// per mark, and a stretch too narrow for its own name is dropped on purpose. So
// "the picture names one contig where the measurements say three" has several
// possible causes and the picture distinguishes none of them.
//
// This reads the tally and the stretch layout off the running app instead, in
// the terms `drawOffscreenMates` lays them out in, and says which stretches are
// wide enough to be named. It is what caught the overlay canvas laying out at
// twice the band: the names in the figure sat at positions the data has no
// stretches at.
//
// It then POINTS AT one, which is the other half nothing else covers: the
// tooltip's own test hands `OffscreenMateTooltip` a hover, and turning a pointer
// into one lives in `LevelSyntenyCanvas`, whose rendering backend no jsdom test
// stands up. The hover is measured against the LEVEL canvas rather than the
// overlay, so the two disagreeing shows up here as a miss.
import {
  BASE_CHROME_ARGS,
  createTestServer,
  findChromeExecutable,
  waitForAppSettled,
} from '@jbrowse/browser-test-utils'
import { launch } from 'puppeteer'

import { repoRoot, testDataRoot } from './screenshot-options.ts'
import { captureUrl } from './screenshot-ready.ts'
import { specs } from './screenshot-specs.ts'

const PORT = 3413
const spec = specs.find(s => s.name === 'synteny_offscreen_mates_on')
if (!spec || spec.mode !== 'url') {
  throw new Error('synteny_offscreen_mates_on is not a url spec')
}

const server = await createTestServer(PORT, {
  jbrowseWebRoot: testDataRoot,
  repoRoot,
})
const browser = await launch({
  headless: true,
  executablePath: findChromeExecutable(),
  args: [...BASE_CHROME_ARGS, '--enable-unsafe-swiftshader'],
  defaultViewport: {
    width: spec.viewportWidth ?? 1500,
    height: spec.viewportHeight ?? 800,
    deviceScaleFactor: 2,
  },
})
try {
  const page = await browser.newPage()
  await captureUrl(page, spec, PORT)
  await waitForAppSettled(page)

  const out = await page.evaluate(() => {
    const view = (window as any).JBrowseSession.views[0]
    const display = view.levels[0].linearSyntenyDisplays[0]
    const data = display.featureData?.offscreenMates
    const { bpPerPx, offsetPx } = view.views[0]
    const ctx = document.createElement('canvas').getContext('2d')!
    ctx.font = '10px sans-serif'

    // one stretch per run of marks to one contig closer together than a couple
    // of its own names — the merge drawOffscreenMates does before it decides
    // what to name, in labels rather than pixels so it holds at every zoom
    const MERGE_GAP_LABELS = 2
    const per = new Map<string, { x: number; end: number }[]>()
    for (let i = 0; i < (data?.starts.length ?? 0); i++) {
      const name = data.mateRefNameDict[data.mateRefNameIds[i]] as string
      const x1 = data.starts[i] / bpPerPx - offsetPx
      const x2 = data.ends[i] / bpPerPx - offsetPx
      if (x2 < 0 || x1 > view.width) {
        continue
      }
      let list = per.get(name)
      if (!list) {
        list = []
        per.set(name, list)
      }
      list.push({ x: x1, end: x1 + Math.max(1.5, x2 - x1) })
    }
    const stretches: { refName: string; x: number; span: number }[] = []
    for (const [name, list] of per) {
      list.sort((a, b) => a.x - b.x)
      const mergeGap = ctx.measureText(name).width * MERGE_GAP_LABELS
      const runs: { x: number; end: number }[] = []
      for (const r of list) {
        const last = runs.at(-1)
        if (last && r.x - last.end <= mergeGap) {
          last.end = Math.max(last.end, r.end)
        } else {
          runs.push({ ...r })
        }
      }
      for (const r of runs) {
        // clipped to the window, as placeLabels is: a stretch wider than the
        // view is named over the part in view, so predicting from its full span
        // would call a label placed and put it somewhere the figure has none
        const x = Math.max(r.x, 0)
        stretches.push({
          refName: name,
          x,
          span: Math.min(r.end, view.width) - x,
        })
      }
    }
    stretches.sort((a, b) => a.x - b.x)

    const canvas = document.querySelector<HTMLCanvasElement>(
      '[data-testid="offscreen_mate_overlay"]',
    )
    const box = canvas?.getBoundingClientRect()
    return {
      width: view.width as number,
      placed: data?.starts.length ?? 0,
      tally: view.offscreenMateTally as { refName: string; count: number }[],
      overlay:
        canvas && box
          ? {
              css: `${Math.round(box.width)}x${Math.round(box.height)}`,
              backing: `${canvas.width}x${canvas.height}`,
            }
          : undefined,
      stretches: stretches.map(s => ({
        refName: s.refName,
        x: Math.round(s.x),
        span: Math.round(s.span),
        named: ctx.measureText(s.refName).width + 6 <= s.span,
      })),
    }
  })

  console.log(`view ${out.width}px wide, ${out.placed} marks placed`)
  // the CSS box is what has to match the band; the backing store is DPR-scaled
  // and is always the larger of the two
  console.log(`overlay canvas: ${JSON.stringify(out.overlay)}`)
  console.log('drops per contig:')
  for (const e of out.tally) {
    console.log(`  ${e.refName.padEnd(14)} ${String(e.count).padStart(6)}`)
  }
  console.log('stretches, left to right:')
  for (const s of out.stretches) {
    console.log(
      `  ${s.refName.padEnd(14)} x=${String(s.x).padStart(5)} ` +
        `span=${String(s.span).padStart(5)}px ${s.named ? 'NAMED' : ''}`,
    )
  }

  // The widest single mark on screen, which on this view is under 2px — so this
  // is also the answer to "can a reader point at one at all".
  const target = await page.evaluate(() => {
    const view = (window as any).JBrowseSession.views[0]
    const display = view.levels[0].linearSyntenyDisplays[0]
    const data = display.featureData?.offscreenMates
    const { bpPerPx, offsetPx } = view.views[0]
    let best = { x: 0, span: 0, refName: '' }
    for (let i = 0; i < (data?.starts.length ?? 0); i++) {
      const x1 = data.starts[i] / bpPerPx - offsetPx
      const span = Math.max(1.5, data.ends[i] / bpPerPx - offsetPx - x1)
      if (x1 >= 0 && x1 + span <= view.width && span > best.span) {
        best = {
          x: x1 + span / 2,
          span,
          refName: data.mateRefNameDict[data.mateRefNameIds[i]],
        }
      }
    }
    const box = document
      .querySelector('[data-testid="synteny_canvas"]')
      ?.getBoundingClientRect()
    return box
      ? {
          ...best,
          clientX: box.left + best.x,
          // inside the 6px strip, above every ribbon
          clientY: box.top + 3,
          belowStripY: box.top + 40,
        }
      : undefined
  })
  if (!target) {
    throw new Error('no synteny canvas to point at')
  }
  const tooltip = () =>
    page.evaluate(
      () => document.querySelector('[role="tooltip"]')?.textContent ?? '(none)',
    )
  const settle = () => new Promise(resolve => setTimeout(resolve, 400))

  console.log(
    `widest mark: ${target.refName}, ${target.span.toFixed(1)}px wide`,
  )
  await page.mouse.move(target.clientX, target.clientY)
  await settle()
  console.log(`  on the mark:  ${JSON.stringify(await tooltip())}`)
  // below the strip is the pick engine's, so a mark's hover must not answer there
  await page.mouse.move(target.clientX, target.belowStripY)
  await settle()
  console.log(`  below it:     ${JSON.stringify(await tooltip())}`)
  // the invalidation axis no pointer event covers: the band moving under a
  // stationary cursor
  await page.mouse.move(target.clientX, target.clientY)
  await settle()
  await page.evaluate(() => {
    ;(window as any).JBrowseSession.views[0].views[0].horizontalScroll(300)
  })
  await settle()
  console.log(`  after a pan:  ${JSON.stringify(await tooltip())}`)
} finally {
  await browser.close()
  server.close()
}
