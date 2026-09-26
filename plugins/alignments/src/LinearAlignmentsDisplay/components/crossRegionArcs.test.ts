import { recordPath } from '@jbrowse/render-core/marks'
import { canvasWideBlock } from '@jbrowse/render-core/renderBlock'

import { drawAlignmentsToCtx } from '../renderers/Canvas2DAlignmentsRenderer.ts'
import { ARC_LINK_MARKS } from '../renderers/arcMarks.ts'
import {
  applyView,
  createTestAlignmentsDisplay,
  makeEmptyPileupData as emptyPileupData,
  oneReadWithMate,
} from '../testUtils.ts'

import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

// An arc whose two feet are in DIFFERENT displayed regions, through the model's
// own chain rather than through a hand-built argument.
//
// The whole point of routing it this way is the band: `computeStackedSections`
// reserves the arc strip from `hasArcs`, and a lane whose every arc crosses a
// seam once reserved NO band, because the reservation read only the
// per-region half of compute's output.
//
// Two regions either side of a breakpoint is not a corner case; it is the view
// read connections exist for.
function twoRegionDisplay() {
  const { view, display } = createTestAlignmentsDisplay()
  // The one 10kb region, cut into two that each hold one foot of the pair
  // below. `oneReadWithMate(2000)` reads 1000..1100 with its mate at 2000, so
  // the arc runs 1000 -> 2000 across the seam at 1500.
  view.setDisplayedRegions([
    { assemblyName: 'volvox', start: 0, end: 1500, refName: 'ctgA' },
    { assemblyName: 'volvox', start: 1500, end: 10_000, refName: 'ctgA' },
  ])
  applyView(view, 10, 0)
  display.setReadConnections('arc')
  display.setRpcData(
    0,
    {
      groups: [{ key: '', label: '', data: oneReadWithMate(2000) }],
    },
    {
      refName: 'ctgA',
      start: 0,
      end: 1500,
      assemblyName: 'volvox',
    },
  )
  // The second region's fetch, empty of reads. The read scan walks the LOADED
  // list, so without it the mate is never seen at all; the partition itself is
  // keyed on the displayed list, which already holds both.
  display.setRpcData(
    1,
    {
      groups: [{ key: '', label: '', data: emptyPileupData() }],
    },
    {
      refName: 'ctgA',
      start: 1500,
      end: 10_000,
      assemblyName: 'volvox',
    },
  )
  return display
}

test('a cross-region arc is one connection, filed under its first foot and placed through its second', () => {
  const display = twoRegionDisplay()
  for (const regionMap of display.arcsByGroup.values()) {
    for (const data of regionMap.values()) {
      expect(data.numArcs).toBe(0)
    }
  }
  expect(display.crossRegionArcsByGroup.get('')).toHaveLength(1)
  const feeds = display.sourceSections[0]!.arcFeeds
  expect(feeds.get(0)!.links.count).toBe(1)
  expect(feeds.get(0)!.links.x2Region[0]).toBe(1)
  expect(feeds.get(1)?.links.count ?? 0).toBe(0)
})

test('and the band is still reserved for it', () => {
  // The regression this file exists for: the strip is reserved from the ink a
  // lane has, and after the split that lane's ink is entirely in the overlay.
  const display = twoRegionDisplay()
  expect(display.renderSections[0]!.arcBandHeight).toBeGreaterThan(0)
})

test('and its colour still keys a legend swatch', () => {
  // The same failure one level over, and the second of the two the split broke
  // at once: `arcLegendCategories` walked `arcsByGroup`, so a lane whose every
  // arc crossed a seam painted colours the key did not name.
  const display = twoRegionDisplay()
  display.setShowLegend(true)
  expect(display.arcLegendCategories.size).toBeGreaterThan(0)
})

test('and it draws, with both feet on their own region', () => {
  const display = twoRegionDisplay()
  const { renderState } = display
  const recorder = recordPath()
  ARC_LINK_MARKS[1]!.paintBlock(
    recorder.ctx,
    display.sourceSections[0]!.arcFeeds.get(0)!,
    canvasWideBlock(0, renderState.canvasWidth),
    { ...renderState, arcBand: renderState.sections[0]!.arcBand! },
  )
  // The two feet straddle the seam, which is the claim the picture makes and
  // the one a per-block pass could not: at bpPerPx 10 with the first region
  // 0..1500, the seam sits at 150px, and the arc reaches from 100 to 200.
  const xs = [...recorder.d.matchAll(/[ML](-?[\d.e]+) /g)].map(m =>
    Number(m[1]),
  )
  expect(Math.min(...xs)).toBeCloseTo(100, 0)
  expect(Math.max(...xs)).toBeCloseTo(200, 0)
})

test('a single-region view has none of this', () => {
  // The control the cases above need. Without it they are also satisfied by a
  // partition that files every arc as cross-region.
  const { view, display } = createTestAlignmentsDisplay()
  applyView(view, 10, 0)
  display.setReadConnections('arc')
  display.setRpcData(
    0,
    {
      groups: [{ key: '', label: '', data: oneReadWithMate(2000) }],
    },
    {
      refName: 'ctgA',
      start: 0,
      end: 10_000,
      assemblyName: 'volvox',
    },
  )
  expect(display.crossRegionArcsByGroup.get('')).toHaveLength(0)
  expect(display.arcsByGroup.get('')!.get(0)!.numArcs).toBe(1)
  expect(display.sourceSections[0]!.arcFeeds.get(0)!.links.x2Region[0]).toBe(0)
  expect(display.renderSections[0]!.arcBandHeight).toBeGreaterThan(0)
})

// Two windows with the mate between them, on no displayed region: the view a
// multi-locus SV session is, where a pair straddles every window edge.
function straddlingDisplay() {
  const { view, display } = createTestAlignmentsDisplay()
  view.setDisplayedRegions([
    { assemblyName: 'volvox', start: 0, end: 1500, refName: 'ctgA' },
    { assemblyName: 'volvox', start: 5000, end: 10_000, refName: 'ctgA' },
  ])
  applyView(view, 10, 0)
  display.setReadConnections('arc')
  display.setRpcData(
    0,
    { groups: [{ key: '', label: '', data: oneReadWithMate(2000) }] },
    { refName: 'ctgA', start: 0, end: 1500, assemblyName: 'volvox' },
  )
  display.setRpcData(
    1,
    { groups: [{ key: '', label: '', data: emptyPileupData() }] },
    { refName: 'ctgA', start: 5000, end: 10_000, assemblyName: 'volvox' },
  )
  return display
}

// Each stroke's x extent and the x range the clip allowed while it was made.
function clipRecordingCtx() {
  let clip: [number, number] = [-Infinity, Infinity]
  const saved: [number, number][] = []
  let rect = clip
  let xs: number[] = []
  const strokes: { xs: number[]; clip: [number, number] }[] = []
  const recorded: Record<string, unknown> = {
    save: () => saved.push(clip),
    restore: () => {
      clip = saved.pop()!
    },
    rect: (x: number, _y: number, w: number) => {
      rect = [x, x + w]
    },
    clip: () => {
      clip = [Math.max(clip[0], rect[0]), Math.min(clip[1], rect[1])]
    },
    beginPath: () => {
      xs = []
    },
    moveTo: (x: number) => xs.push(x),
    lineTo: (x: number) => xs.push(x),
    ellipse: (x: number, _y: number, rx: number) => xs.push(x - rx, x + rx),
    stroke: () => strokes.push({ xs, clip }),
    measureText: () => ({ width: 0 }),
  }
  const ctx = new Proxy(recorded, {
    get: (t, k) => (typeof k === 'string' && k in t ? t[k] : () => {}),
    set: () => true,
  })
  return { ctx: ctx as unknown as Ctx2D, strokes }
}

test('an arc whose mate no window shows runs off its own block, clipped, not as a stem', () => {
  const display = straddlingDisplay()
  const feed = display.sourceSections[0]!.arcFeeds.get(0)!
  expect(feed.ticks.count).toBe(0)
  expect(feed.links.count).toBe(0)
  expect(feed.clippedLinks.count).toBe(1)
  expect(feed.clippedLinks.x2Region[0]).toBe(0)

  const { ctx, strokes } = clipRecordingCtx()
  drawAlignmentsToCtx(
    ctx,
    {
      sections: display.sourceSections,
      densityRegions: display.densityCoverageRegions,
    },
    display.renderBlocks,
    display.renderState,
  )
  // The mate at 2000 bp lies along region 0's axis past that block's right
  // edge, where the second window begins.
  const own = display.renderState.linkRegions[0]!
  const blockEnd = display.renderBlocks.find(
    b => b.displayedRegionIndex === 0,
  )!.screenEndPx
  const mateX = own.anchorPx + (2000 - own.anchorBp) * own.signedPxPerBp
  expect(mateX).toBeGreaterThan(blockEnd)
  const arcStroke = strokes.find(s => Math.max(...s.xs) > blockEnd)
  expect(Math.max(...arcStroke!.xs)).toBeCloseTo(mateX, 0)
  expect(arcStroke!.clip[1]).toBeLessThanOrEqual(Math.ceil(blockEnd))
})
