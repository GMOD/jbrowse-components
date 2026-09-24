import { MORPH_DURATION_MS, SimpleFeature } from '@jbrowse/core/util'
import { paintMarkBlocks } from '@jbrowse/render-core/marks'

import { LaneGene } from './geneGlyph.ts'
import { buildLanes } from './laneStack.ts'
import { groupFeatures } from './layoutMultiWay.ts'
import { buildRibbonGeometry, glyphsKey } from './multiwayGeometry.ts'
import { MULTIWAY_MARKS } from './multiwayMarks.ts'
import { drawnPx, laneMapOf } from './multiwayRenderTypes.ts'
import { createDisplayWithSession } from './testEnv.ts'

import type { LaneDecision } from './laneDecision.ts'
import type { RowFrame } from './layoutMultiWay.ts'
import type { MultiWaySyntenyDisplayModel } from './model.ts'
import type { AnimationMode } from '@jbrowse/core/util'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

const A = 'volvox'
const B = 'volvox_random'
const C = 'volvox_ins'
const STARTS = Array.from({ length: 10 }, (_, i) => 50 + 90 * i)

function record(id: string, name: string, anchor: string, mateStart: number) {
  const start = STARTS[Number(name.slice(1))]!
  return new SimpleFeature({
    uniqueId: id,
    name,
    refName: 'ctgA',
    start,
    end: start + 60,
    strand: 1,
    assemblyName: anchor,
    mate: {
      assemblyName: C,
      refName: 'ctgB',
      start: mateStart,
      end: mateStart + 60,
    },
  })
}

const groupsOn = (anchor: string) =>
  STARTS.map((s, i) => record(`${anchor}${i}`, `g${i}`, anchor, 20_000 + s))

// gene models across a long stretch of the lane's contig either side of the
// placements, so a frame showing more of it than the next one does has genes
// on screen that the next frame's own cull would drop
const genes = Array.from({ length: 70 }, (_, i) => 16_000 + 150 * i)
  .filter(start => start + 50 < 20_000 || start > 21_100)
  .map(
    start =>
      new LaneGene(
        new SimpleFeature({
          uniqueId: `gene${start}`,
          name: `gene${start}`,
          refName: 'ctgB',
          start,
          end: start + 50,
          strand: 1,
          type: 'gene',
        }),
      ),
  )

async function settledDisplay(animationMode: AnimationMode = 'enabled') {
  const { display, session } = createDisplayWithSession({
    trackAssemblyNames: [A, B, C],
    geneTracks: [],
    rpc: () => new Promise(() => {}),
    animationMode,
  })
  display.setFeatures(groupsOn(A))
  for (let i = 0; i < 200 && !display.laneDecisions.get(C); i++) {
    await new Promise(r => setTimeout(r, 5))
  }
  expect(display.laneDecisions.get(C)).toBeDefined()
  display.setLaneGenes(new Map([[C, { key: 'held', genes }]]), undefined)
  return { display, session }
}

function redecide(
  display: MultiWaySyntenyDisplayModel,
  change: (d: LaneDecision) => Partial<LaneDecision>,
) {
  const decisions = new Map(display.laneDecisions)
  const prior = decisions.get(C)!
  decisions.set(C, { ...prior, ...change(prior) })
  display.setLaneFrames(display.renderOriginPx, decisions)
}

interface Call {
  method: string
  args: number[]
}

function picture(display: MultiWaySyntenyDisplayModel) {
  const calls: Call[] = []
  const ctx = new Proxy(
    {},
    {
      get:
        (_target, method: string) =>
        (...args: number[]) => {
          calls.push({ method, args })
        },
      set: () => true,
    },
  ) as Ctx2D
  paintMarkBlocks(
    ctx,
    MULTIWAY_MARKS,
    display.renderCells,
    display.renderBlocks,
    display.renderState,
  )
  const width = display.canvasWidth
  const rects = calls
    .filter(c => c.method === 'fillRect')
    .flatMap(({ args }) => {
      const [x, y, w, h] = args as [number, number, number, number]
      const x1 = Math.max(0, x)
      const x2 = Math.min(width, x + w)
      return x2 > x1 ? [[x1, x2, y, h]] : []
    })
  // a ribbon is a closed four-corner path and a strand arrow's head a
  // three-corner one, corners in draw order
  const ribbons: number[][] = []
  const heads: number[][] = []
  let path: number[] = []
  for (const { method, args } of calls) {
    if (method === 'beginPath') {
      path = []
    } else if (method === 'moveTo' || method === 'lineTo') {
      path.push(args[0]!, args[1]!)
    } else if (method === 'fill' && path.length === 8) {
      ribbons.push(path)
    } else if (
      method === 'fill' &&
      path.length === 6 &&
      Math.max(path[0]!, path[4]!) > 0 &&
      Math.min(path[0]!, path[4]!) < width
    ) {
      heads.push(path)
    }
  }
  return { rects, ribbons, heads }
}

// what one list draws that the other does not, to a pixel: the cells are
// packed at whole px in each frame, so the same bp can round a px apart
function unmatched(a: number[][], b: number[][]) {
  const pool = [...b]
  return a.filter(item => {
    const i = pool.findIndex(other =>
      item.every((v, k) => Math.abs(v - other[k]!) <= 1),
    )
    if (i >= 0) {
      pool.splice(i, 1)
    }
    return i < 0
  })
}

function expectSamePicture(
  a: ReturnType<typeof picture>,
  b: ReturnType<typeof picture>,
) {
  expect(unmatched(a.rects, b.rects)).toEqual([])
  expect(unmatched(b.rects, a.rects)).toEqual([])
  expect(unmatched(a.ribbons, b.ribbons)).toEqual([])
  expect(unmatched(b.ribbons, a.ribbons)).toEqual([])
  expect(unmatched(a.heads, b.heads)).toEqual([])
  expect(unmatched(b.heads, a.heads)).toEqual([])
}

// the cells are packed in the NEW frame and culled to both, so frame 0 of the
// move is the old picture — not the new frame's content with its edges
// missing, which is what a slide or a rung drop showed before the union cull
describe.each([
  [
    'a broken hold re-aligning',
    {},
    (d: LaneDecision) => ({ pivotLaneBp: d.pivotLaneBp + 300 }),
  ],
  [
    'a slide most of a screen',
    {},
    (d: LaneDecision) => ({ pivotLaneBp: d.pivotLaneBp + 700 }),
  ],
  ['a rung drop', { rung: 3 }, () => ({ rung: 1 })],
  ['a rung rise', {}, () => ({ rung: 3 })],
  ['a flip', {}, (d: LaneDecision) => ({ flipped: !d.flipped })],
])('%s', (_name, before, after) => {
  test('draws the old picture at its start and the new one at its end', async () => {
    const { display } = await settledDisplay()
    if (Object.keys(before).length) {
      redecide(display, () => before)
      display.endAnimation()
    }
    const old = picture(display)
    expect(old.rects.length).toBeGreaterThanOrEqual(20)
    expect(old.ribbons.length).toBeGreaterThan(3)

    redecide(display, after)
    expect(display.animating).toBe(true)
    expectSamePicture(picture(display), old)

    const { startMs } = display.laneTransitions.get(C)!
    display.advanceAnimation(startMs + MORPH_DURATION_MS)
    expect(display.animating).toBe(false)
    const landed = picture(display)
    // the settled frame with nothing moving is the same decision drawn fresh
    const decisions = new Map(display.laneDecisions)
    display.setLaneFrames(display.renderOriginPx, new Map())
    display.setLaneFrames(display.renderOriginPx, decisions)
    expect(display.animating).toBe(false)
    expectSamePicture(landed, picture(display))
  })

  test("the lane's baseline still spans the canvas at the start", async () => {
    const { display } = await settledDisplay()
    if (Object.keys(before).length) {
      redecide(display, () => before)
      display.endAnimation()
    }
    redecide(display, after)
    const cell = display.laneGlyphCells.get(glyphsKey(1))!
    const map = laneMapOf(display, 1)
    const data = cell.kind === 'glyphs' ? cell.data : undefined
    const [a, b] = [data!.linePositions[0]!, data!.linePositions[1]!].map(
      p => drawnPx(map, p - (1 << 20)) + display.dragOffsetPx,
    )
    expect(Math.min(a!, b!)).toBeLessThanOrEqual(0)
    expect(Math.max(a!, b!)).toBeGreaterThanOrEqual(display.canvasWidth)
  })
})

// an arrow is a fixed px long, so it has to hang off a point the lane map
// carries: anchored a stem's length inside the end, a 3x rescale drew its
// first frame 4.7 px off the gene it marks
test("a strand arrow rides its gene's end through a rescale", async () => {
  const { display } = await settledDisplay()
  redecide(display, () => ({ rung: 3 }))
  display.endAnimation()
  const old = picture(display).heads
  expect(old.length).toBeGreaterThan(3)
  redecide(display, () => ({ rung: 1 }))
  expect(display.animating).toBe(true)
  const moving = picture(display).heads
  expect(unmatched(moving, old)).toEqual([])
  expect(unmatched(old, moving)).toEqual([])
})

test('mid-flight the hit test, the hover ink and the selection ink sit on the drawn glyph', async () => {
  const { display, session } = await settledDisplay()
  redecide(display, d => ({
    flipped: !d.flipped,
    pivotLaneBp: d.pivotLaneBp + 200,
  }))
  const { startMs } = display.laneTransitions.get(C)!
  display.advanceAnimation(startMs + MORPH_DURATION_MS / 3)
  const map = laneMapOf(display, 1)
  expect(Math.abs(map.scale)).toBeLessThan(1)

  const drawn = picture(display).rects
  const cell = display.laneGlyphCells.get(glyphsKey(1))!
  const hits = cell.kind === 'glyphs' ? cell.data.hits : []
  const hit = hits.find(h => {
    const x = drawnPx(map, (h.x1 + h.x2) / 2) + display.dragOffsetPx
    return x > 50 && x < display.canvasWidth - 50
  })!
  const x = drawnPx(map, (hit.x1 + hit.x2) / 2) + display.dragOffsetPx
  const y = hit.y1 + 2 - display.scrollTop
  // the narrowest rect the frame drew there, over the lane's band
  const rect = drawn
    .filter(
      ([x1, x2, top, h]) => x >= x1! && x <= x2! && y >= top! && y <= top! + h!,
    )
    .sort((a, b) => a[1]! - a[0]! - (b[1]! - b[0]!))[0]!
  expect(rect).toBeDefined()
  expect(display.hitTest(x, y)?.feature.id()).toBe(hit.feature.id())
  // where the settled frame would put the gene is no longer what answers
  expect(
    display.hitTest((hit.x1 + hit.x2) / 2 + display.dragOffsetPx, y)?.feature,
  ).not.toBe(hit.feature)

  session.setSelection(hit.feature)
  const [selected] = display.selectionInk
  expect(selected!.left).toBeCloseTo(rect[0]!, 0)
  expect(selected!.left + selected!.width).toBeCloseTo(rect[1]!, 0)

  display.setHoverTarget({
    label: 'g4',
    feature: hit.feature,
    groupKey: 'g4',
  })
  const box = display.laneStack.lanes[1]!.placements.get('g4')!.spans[0]!
  const [ink] = display.hoverInk.filter(
    r => r.top === display.laneStack.lanes[1]!.glyphTop - display.scrollTop,
  )
  const ends = box.map(p => drawnPx(map, p) + display.dragOffsetPx)
  expect(ink!.left).toBeCloseTo(Math.min(...ends), 6)
  expect(ink!.width).toBeCloseTo(Math.abs(ends[1]! - ends[0]!), 6)
})

describe('nothing animates', () => {
  test("under animationMode 'disabled'", async () => {
    const { display } = await settledDisplay('disabled')
    display.flipLane(C)
    expect(display.laneDecisions.get(C)?.orientationPinned).toBe(true)
    expect(display.animating).toBe(false)
    expect(display.laneMaps.size).toBe(0)
  })

  test('on a contig change', async () => {
    const { display } = await settledDisplay()
    const d = display.laneDecisions.get(C)!
    const decisions = new Map(display.laneDecisions).set(C, {
      ...d,
      refName: 'ctgC',
    })
    display.setLaneFrames(display.renderOriginPx, decisions)
    expect(display.animating).toBe(false)
  })

  test('on an anchor change', async () => {
    const { display } = await settledDisplay()
    display.lgv.setDisplayedRegions([
      { refName: 'ctgA', start: 0, end: 1000, assemblyName: B },
    ])
    display.setFeatures(groupsOn(B))
    expect(display.laneDecisions.get(C)).toBeDefined()
    expect(display.animating).toBe(false)
  })
})

test('split strands, a flip keeps its rows until halfway and turns them over there', async () => {
  const { display } = await settledDisplay()
  display.setSplitStrands(true)
  redecide(display, () => ({ rung: 3 }))
  display.endAnimation()
  const old = picture(display)
  const geneTops = () => {
    const cell = display.laneGlyphCells.get(glyphsKey(1))!
    return new Set(cell.kind === 'glyphs' ? cell.data.hits.map(h => h.y1) : [])
  }
  const before = geneTops()
  expect(before.size).toBe(1)

  redecide(display, d => ({ flipped: !d.flipped }))
  expect(display.animating).toBe(true)
  expectSamePicture(picture(display), old)
  const { startMs } = display.laneTransitions.get(C)!
  display.advanceAnimation(startMs + MORPH_DURATION_MS * 0.45)
  expect(geneTops()).toEqual(before)
  display.advanceAnimation(startMs + MORPH_DURATION_MS * 0.55)
  const after = geneTops()
  expect(after.size).toBe(1)
  expect([...after][0]).toBeGreaterThan([...before][0]!)

  display.advanceAnimation(startMs + MORPH_DURATION_MS)
  const landed = picture(display)
  const decisions = new Map(display.laneDecisions)
  display.setLaneFrames(display.renderOriginPx, new Map())
  display.setLaneFrames(display.renderOriginPx, decisions)
  expectSamePicture(landed, picture(display))
})

test('a moving lane names the frame it is drawn nearer to', async () => {
  const { display } = await settledDisplay()
  const header = () =>
    display.laneHeaderRows.find(r => r.assemblyName === C)!.label
  const before = header()
  expect(before).not.toContain('[rev]')
  display.flipLane(C)
  const { startMs } = display.laneTransitions.get(C)!
  expect(header()).toBe(before)
  display.advanceAnimation(startMs + MORPH_DURATION_MS * 0.45)
  expect(header()).toBe(before)
  display.advanceAnimation(startMs + MORPH_DURATION_MS * 0.55)
  expect(header()).toContain('[rev]')
})

test('a Flip lane moves the lane rather than snapping it', async () => {
  const { display } = await settledDisplay()
  display.flipLane(C)
  expect(display.animating).toBe(true)
  expect(display.laneMaps.get(1)?.scale).toBeCloseTo(-1, 6)
})

// the frame loop is the component's; a display whose loop never runs — not
// mounted, a hidden tab — must still stop animating at the end time
test('the published signal is idle after the end time even if no frame advanced', async () => {
  const { display } = await settledDisplay()
  jest.useFakeTimers()
  try {
    display.flipLane(C)
    expect(display.animating).toBe(true)
    expect(display.dataSuperseded).toBe(true)
    jest.advanceTimersByTime(MORPH_DURATION_MS - 1)
    expect(display.animating).toBe(true)
    jest.advanceTimersByTime(2)
    expect(display.animating).toBe(false)
    expect(display.dataSuperseded).toBe(false)
    expect(display.rowFrames.get(C)?.morphFrom).toBeUndefined()
    expect(display.laneMaps.size).toBe(0)
  } finally {
    jest.useRealTimers()
  }
})

// a ribbon too thin to draw in the new frame can be several px wide in the old
// one, where the move starts; the width gate reads it at its widest
test('a ribbon the old frame drew wide is kept for a move that starts magnified', () => {
  const frame = (refName: string): RowFrame => ({
    refName,
    min: 1000,
    max: 2000,
    flipped: false,
    fitMin: 1000,
    fitMax: 2000,
    alsoOn: [],
    alsoOnMore: 0,
  })
  const narrowFrom = (f: RowFrame): RowFrame => ({
    ...f,
    morphFrom: [{ frame: { ...f, min: 1050, max: 1300 }, weight: 1 }],
  })
  const groups = groupFeatures(
    ['peach', 'cacao'].map(
      mate =>
        new SimpleFeature({
          uniqueId: `g1-${mate}`,
          name: 'g1',
          refName: 'chr1',
          start: 100,
          end: 200,
          strand: 1,
          mate: { assemblyName: mate, refName: 'm1', start: 1100, end: 1102 },
        }),
    ),
  )
  const gutter = (peach: RowFrame, cacao: RowFrame) => {
    const { cells } = buildRibbonGeometry({
      stack: buildLanes({
        assemblyNames: ['grape', 'peach', 'cacao'],
        groups,
        anchorSpans: new Map([['g1', [80, 160]]]),
        rowFrames: new Map([
          ['peach', peach],
          ['cacao', cacao],
        ]),
        laneGeneAdapters: new Map(),
        axisSpanOf: () => undefined,
        anchorRegionSpans: [],
        anchorBpPerPx: 1,
        contigOf: () => undefined,
        refNameAliasOf: () => undefined,
        width: 800,
        height: 240,
      }),
      laneLinks: undefined,
      ribbonColor: 'grey',
      drawCurves: false,
      bridgeSkippedLanes: false,
    })
    const cell = cells.get('ribbons:1')!
    return cell.kind === 'ribbons' ? cell.data.instanceCount : -1
  }
  expect(gutter(frame('m1'), frame('m1'))).toBe(0)
  expect(gutter(narrowFrom(frame('m1')), narrowFrom(frame('m1')))).toBe(1)
})
