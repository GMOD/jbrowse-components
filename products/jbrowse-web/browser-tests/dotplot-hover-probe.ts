/* eslint-disable no-console */
// One-off probe (not a suite): hover a real alignment on a real dotplot and look
// at what comes up. The pick, the tooltip text and the restroke each have unit
// coverage; what none of it can answer is whether the cue is legible on an
// actual plot, or whether a pointer landing on a drawn dot picks the feature
// that was drawn there.
//
// The target pixel is found by asking the model — a grid scan over
// `pickFeatureAt` — rather than hardcoded, so this survives the fixture's
// alignments moving. Then the real mouse goes there, which is what exercises the
// pointer wiring rather than the model alone. Twin of hover-probe.ts, which does
// the same thing for the synteny ribbon's shader hover branch.
//
//   node products/jbrowse-web/browser-tests/dotplot-hover-probe.ts [outdir]
import fs from 'node:fs'
import path from 'node:path'

import { BASE_CHROME_ARGS, displayPainted } from '@jbrowse/browser-test-utils'
import { launch } from 'puppeteer'

import {
  navigateWithSessionSpec,
  setPort,
  waitForDataLoaded,
  waitForDisplayPaint,
} from './helpers.ts'
import { startServerOnFreePort } from './server.ts'

const outDir = process.argv[2] ?? '/tmp/dotplot-hover-probe'

const { server, port } = await startServerOnFreePort(3000)
setPort(port)
fs.mkdirSync(outDir, { recursive: true })

const browser = await launch({
  headless: true,
  args: [...BASE_CHROME_ARGS, '--window-size=1280,900'],
  defaultViewport: { width: 1280, height: 900 },
})

try {
  const page = await browser.newPage()
  page.on('console', m => {
    if (m.type() === 'error') {
      console.log(`  page error: ${m.text()}`)
    }
  })
  await navigateWithSessionSpec(
    page,
    {
      views: [
        {
          type: 'DotplotView',
          views: [{ assembly: 'peach' }, { assembly: 'grape' }],
          tracks: ['grape_peach_paf'],
        },
      ],
    },
    'test_data/config_dotplot.json',
  )
  await waitForDisplayPaint(page, displayPainted('dotplot_webgl_canvas'), 90000)
  await waitForDataLoaded(page, 90000)

  const canvas = (await page.waitForSelector('canvas', { timeout: 30000 }))!
  const box = (await canvas.boundingBox())!

  // Coarse grid over the middle of the plot, asking the model what it would
  // pick. Every answer is a pixel where something was drawn, so the first hit is
  // a real target — and away from the edges the tooltip has somewhere to go that
  // isn't on top of the thing being looked at.
  const target = await page.evaluate(() => {
    const view = (window as any).JBrowseSession?.views[0]
    const { viewWidth, viewHeight } = view
    for (let y = viewHeight * 0.5; y < viewHeight * 0.8; y += 3) {
      for (let x = viewWidth * 0.4; x < viewWidth * 0.6; x += 3) {
        const hit = view.pickFeatureAt(x, y)
        if (hit) {
          return { x: Math.round(x), y: Math.round(y), hit }
        }
      }
    }
    return undefined
  })
  if (!target) {
    throw new Error('the model picks nothing anywhere on the plot')
  }
  console.log(`picked at plot px (${target.x}, ${target.y}):`)
  console.log(`  ${JSON.stringify(target.hit)}`)

  // The plot rect is inset from the canvas by the axis borders, so the model's
  // plot px are offset from the page's client px by exactly that.
  const origin = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="dotplot_webgl_canvas"]')
    const r = el!.getBoundingClientRect()
    return { left: r.left, top: r.top }
  })
  // A tight crop around the target, so the cue can be compared rather than
  // hunted for on a plot of a few thousand dots.
  const crop = {
    x: origin.left + target.x - 30,
    y: origin.top + target.y - 30,
    width: 60,
    height: 60,
  }
  const shoot = async (name: string, clip: typeof crop) => {
    const file = path.join(outDir, name)
    fs.writeFileSync(file, Buffer.from(await page.screenshot({ clip })))
    return file
  }

  // Un-hovered first, with the pointer parked outside the plot entirely.
  await page.mouse.move(2, 2)
  await page.waitForFunction(
    () => !(window as any).JBrowseSession?.views[0].hoveredHighlight,
  )
  await shoot('plain.png', crop)

  await page.mouse.move(origin.left + target.x, origin.top + target.y)

  const state = await page.waitForFunction(
    () => {
      const view = (window as any).JBrowseSession?.views[0]
      const lines = view.hoveredTooltipLines
      return lines
        ? { lines, highlight: view.hoveredHighlight, alpha: view.alpha }
        : undefined
    },
    { timeout: 10000 },
  )
  const { lines, highlight, alpha } = (await state.jsonValue()) as any
  console.log(`\ntooltip (plot alpha ${alpha}):`)
  for (const line of lines) {
    console.log(`  ${line}`)
  }
  console.log(`\nhighlight color ${highlight.color}`)
  console.log(`highlight path  ${highlight.path.slice(0, 120)}`)
  console.log(
    `segments        ${highlight.path.split('M').length - 1} (>1 = CIGAR detail)`,
  )

  // Both halves have to be on screen together: the tooltip is portaled to the
  // body, the restroke is an SVG over the canvas, and it is their sum a user
  // reads. Waited for rather than sampled — the tooltip is a lazy chunk, so the
  // model's state is live before the component that shows it exists.
  await page.waitForFunction(
    () => document.body.textContent.includes('Inverted:'),
    { timeout: 10000 },
  )
  console.log('tooltip rendered: true')
  // ...and the whole plot, for the tooltip in place over it.
  const wholePlot = {
    x: box.x,
    y: box.y,
    width: box.width,
    height: box.height + 40,
  }
  await shoot('plot.png', wholePlot)
  const strokes = await page.$$eval('svg path[stroke-linecap="round"]', els =>
    els.map(e => e.getAttribute('stroke-width')),
  )
  console.log(`restroke widths:  ${JSON.stringify(strokes)}`)

  // Phase two: zoom onto the alignment just hovered, so its CIGAR detail is wide
  // enough to draw, and hover a step of the staircase. This is the only way to
  // see `segmentOps` come through the real worker — the op is the one thing a
  // segment's geometry cannot answer, since a deletion and a skip both advance
  // the h axis alone and look identical on screen.
  //
  // Framed from the feature's own cumBp rather than a locstring: those are
  // already in the axis' coordinate space, so it needs no refName lookup and
  // cannot drift with the fixture.
  await shoot('hovered.png', crop)
  const zoomed = await page.evaluate((displayKey: number) => {
    const view = (window as any).JBrowseSession.views[0]
    const display = view.dotplotDisplays.find(
      (d: any) => d.displayKey === displayKey,
    )
    const { p11, p12, p21, p22 } = display.rpcData
    const i = display.hoveredFeatureIdx
    const frame = (axis: any, lo: number, hi: number) => {
      // 1.5x the feature's span across the axis, then centered on it
      axis.zoomTo(Math.abs(hi - lo) / axis.width / 1.5)
      axis.scrollTo((lo + hi) / 2 / axis.bpPerPx - axis.width / 2)
    }
    frame(view.hview, p11[i], p12[i])
    frame(view.vview, p21[i], p22[i])
    return { bpPerPxH: view.hview.bpPerPx, bpPerPxV: view.vview.bpPerPx }
  }, target.hit.displayKey)
  console.log(
    `\nzoomed to ${zoomed.bpPerPxH.toFixed(2)} / ${zoomed.bpPerPxV.toFixed(2)} bp/px`,
  )
  // `dataCurrent`, not the loading overlay: the fetch is debounced a second, so
  // for that second nothing is loading and the overlay-based wait returns
  // immediately — on geometry rebuilt at the new zoom from the OLD whole-genome
  // fetch, which carries no CIGAR by design. `dataCurrent` goes false the
  // instant the zoom changes the fetch key and true again only when the matching
  // fetch has landed, which is the question being asked here.
  await page.waitForFunction(
    () =>
      (window as any).JBrowseSession.views[0].dotplotDisplays.every(
        (d: any) => d.dataCurrent && !d.isLoading,
      ),
    { timeout: 90000, polling: 250 },
  )
  await waitForDataLoaded(page, 90000)

  // What the zoomed fetch actually produced, so "no indel found" below can be
  // told apart from "no CIGAR was shipped" and from "no segments at all".
  const geom = await page.evaluate(() => {
    const view = (window as any).JBrowseSession.views[0]
    return view.dotplotDisplays.map((d: any) => ({
      segments: d.instanceData?.instanceCount ?? 0,
      cigarWords: d.rpcData?.cigarData.length ?? 0,
      ops: [...new Set<number>(d.instanceData?.segmentOps ?? [])].sort(),
      drawCigar: view.drawCigar,
    }))
  })
  console.log(`geometry after zoom: ${JSON.stringify(geom)}`)

  // Walk the plot for a hovered segment that IS an indel. Most steps of a
  // staircase are matches, so this scans rather than assuming.
  const op = await page.evaluate(() => {
    const view = (window as any).JBrowseSession.views[0]
    const { viewWidth, viewHeight } = view
    for (let y = 2; y < viewHeight; y += 2) {
      for (let x = 2; x < viewWidth; x += 2) {
        const hit = view.pickFeatureAt(x, y)
        if (hit) {
          view.setHoveredFeature(hit)
          const line = view.hoveredTooltipLines?.find((l: string) =>
            l.startsWith('CIGAR operator:'),
          )
          if (line) {
            return { line, x, y, segmentIdx: hit.segmentIdx }
          }
        }
      }
    }
    return undefined
  })
  console.log(
    op
      ? `hovered segment ${op.segmentIdx} at (${op.x}, ${op.y}): ${op.line}`
      : 'no indel segment found on the zoomed plot (this fixture may have none)',
  )
  await shoot('zoomed.png', wholePlot)
  console.log(
    `\nwrote plain.png, hovered.png, plot.png, zoomed.png in ${outDir}`,
  )
} finally {
  await browser.close()
  server.close()
}
