import { clipBlock } from '@jbrowse/render-core/blockClipUtils'
import { COVERAGE_BAND_LAYER_ORDER } from '@jbrowse/render-core/coverageBand'
import { MockHal } from '@jbrowse/render-core/hal'
import { defineMark } from '@jbrowse/render-core/marks'
import { GpuMarkBackend } from '@jbrowse/render-core/marks/backend'
import { sweepMarkAgainstHit } from '@jbrowse/render-core/marks/drawAgainstHit'
import { UNIFORM_OFFSET_F32 } from '@jbrowse/render-core/shaders/coverageBar'
import { SCALE_TYPE_LINEAR } from '@jbrowse/wiggle-core/normalize'

import { interbaseBarHeightPx } from './coverageBandBox.ts'
import {
  coverageBandMarks,
  coverageInterbaseShape,
  hitCoverageBand,
} from './coverageBandMarks.ts'
import { packCoverageBinsForGpu } from './coverageGpuPacking.ts'
import { packInstances as packInterbaseInstances } from './interbaseHistogramLayout.generated.ts'
import { packInstances as packModCovInstances } from './modCoverageLayout.generated.ts'
import { packInstances as packSnpInstances } from './snpCoverageLayout.generated.ts'

import type {
  CoverageBandParams,
  CoverageBandRegion,
  CoverageBandState,
} from './coverageBandMarks.ts'
import type { MarkContext2D } from '@jbrowse/render-core/marks'

Object.defineProperty(globalThis, 'devicePixelRatio', {
  value: 1,
  writable: true,
  configurable: true,
})

const START = 10_000
const DOMAIN_MAX = 50
const HEIGHT = 100

interface Region extends CoverageBandRegion {
  modCovPackedBuffer: ArrayBuffer
}

interface State {
  canvasWidth: number
  canvasHeight: number
  band: CoverageBandState
}

// One mark in every feed, so each layer has exactly one thing to paint.
function region(): Region {
  return {
    coverageMaxDepth: DOMAIN_MAX,
    coverageBinSize: 1,
    interbaseMaxCount: 4,
    coveragePackedBuffer: packCoverageBinsForGpu(
      new Float32Array([30]),
      DOMAIN_MAX,
      START,
      1,
    ),
    snpPackedBuffer: packSnpInstances(
      {
        position: [START + 1],
        yOffset: [0],
        segHeight: [0.4],
        colorType: [1],
        relDepth: [1],
      },
      1,
    ),
    modCovPackedBuffer: packModCovInstances(
      {
        position: [START + 4],
        yOffset: [0],
        segHeight: [0.2],
        packedColor: [0xff00ff00],
        relDepth: [1],
      },
      1,
    ),
    interbasePackedBuffer: packInterbaseInstances(
      {
        position: [START + 2],
        yOffset: [0],
        segHeight: [0.5],
        colorType: [1],
      },
      1,
    ),
    indicatorPositions: Uint32Array.of(START + 3),
    indicatorTypes: Float32Array.of(1),
  }
}

const state = (over: Partial<CoverageBandState> = {}): State => ({
  canvasWidth: 200,
  canvasHeight: 300,
  band: {
    height: HEIGHT,
    top: 0,
    domainMin: 0,
    domainMax: DOMAIN_MAX,
    scaleType: SCALE_TYPE_LINEAR,
    symlogConstant: 1,
    snpMinFrequency: 0,
    showInterbase: true,
    colors: {
      coverage: 1,
      baseA: 2,
      baseC: 3,
      baseG: 4,
      baseT: 5,
      baseN: 6,
      insertionIndicator: 7,
      softclipIndicator: 8,
      hardclipIndicator: 9,
    },
    ...over,
  },
})

const FIVE = coverageBandMarks({
  channels: (r: Region) => r,
  state: (s: State) => s.band,
  modCov: true,
})
const FOUR = coverageBandMarks({
  channels: (r: Region) => r,
  state: (s: State) => s.band,
})

const block = {
  displayedRegionIndex: 0,
  start: START,
  end: START + 100,
  screenStartPx: 0,
  screenEndPx: 200,
  reversed: false,
}

// Which primitive a layer reaches for is its own business — the bars fill
// rects, the triangles fill a path — so a signature is "what ink appeared".
function recordingCtx() {
  const ink: string[] = []
  const ctx = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    fillRect(x: number, y: number, w: number, h: number) {
      ink.push(`rect ${x} ${y} ${w} ${h}`)
    },
    fill() {
      ink.push('path')
    },
    moveTo(x: number, y: number) {
      ink.push(`m ${x} ${y}`)
    },
    lineTo(x: number, y: number) {
      ink.push(`l ${x} ${y}`)
    },
    translate(x: number, y: number) {
      ink.push(`translate ${x} ${y}`)
    },
    stroke() {},
    strokeRect() {},
    beginPath() {},
    closePath() {},
    rect() {},
    clip() {},
    save() {},
    restore() {},
    arc() {},
    ellipse() {},
    setLineDash() {},
    scale() {},
    rotate() {},
    bezierCurveTo() {},
  } satisfies MarkContext2D
  return { ctx, ink }
}

function render(marks: typeof FIVE, s = state()) {
  const hal = new MockHal(marks.map(m => m.pass))
  const backend = new GpuMarkBackend(hal, marks)
  const r = region()
  backend.upload(0, r)
  backend.renderBlocks([block], new Map([[0, r]]), s)
  return hal
}

function paintOne(mark: (typeof FIVE)[number], s = state()) {
  const { ctx, ink } = recordingCtx()
  mark.paintBlock(ctx, region(), block, s)
  return ink
}

test('the six layers are the band order, and the second list leaves out the modification slices', () => {
  expect(FIVE.map(m => m.pass.id)).toEqual(COVERAGE_BAND_LAYER_ORDER)
  expect(FOUR.map(m => m.pass.id)).toEqual(
    COVERAGE_BAND_LAYER_ORDER.filter(id => id !== 'modCov'),
  )
})

test('the band\u2019s own layers share one uniform write per block', () => {
  const hal = render(FIVE)
  // The five band layers read `writeBandUniforms` through one `params` lens
  // and draw off the slot the first staged; the triangles are a point mark,
  // with the point shader's struct, and the clip strip after them restages
  // the band's.
  expect(hal.getUniformWritesF32()).toHaveLength(3)
  expect(hal.draws().map(d => d.uniformWrite)).toEqual([0, 0, 0, 0, 1, 2])
})

// The domain max under the one bin's depth, so the clip strip has a bar to mark.
test('every layer paints, and no two paint the same ink', () => {
  const s = state({ domainMax: 20 })
  const signatures = FIVE.map(m => paintOne(m, s).join('|'))
  for (const sig of signatures) {
    expect(sig).not.toBe('')
  }
  expect(new Set(signatures).size).toBe(FIVE.length)
})

test('the clip strip marks only a bar the domain cut, and draws last', () => {
  const strip = FIVE.at(-1)!
  expect(strip.pass.id).toBe('clipStrip')
  expect(paintOne(strip)).toEqual([])
  const ink = paintOne(strip, state({ domainMax: 20 }))
  expect(ink).toHaveLength(1)
  // 2 px down from the band's top inset, the bar's top once it is clamped.
  expect(ink[0]).toMatch(/^rect \d+(\.\d+)? 5 \d+(\.\d+)? 2$/)
})

test('the GPU draws every layer in order off the one uniform struct', () => {
  const hal = render(FIVE)
  const draws = hal.draws()
  expect(draws.map(d => d.passId)).toEqual(COVERAGE_BAND_LAYER_ORDER)
  const u = hal.uniformsOf(draws[0]!)!
  expect(u[UNIFORM_OFFSET_F32.covHeight]).toBe(HEIGHT)
  expect(u[UNIFORM_OFFSET_F32.covTop]).toBe(0)
  expect(u[UNIFORM_OFFSET_F32.canvasH]).toBe(300)
  expect(u[UNIFORM_OFFSET_F32.depthDomainMax]).toBe(DOMAIN_MAX)
  expect(u[UNIFORM_OFFSET_F32.regionMaxDepth]).toBe(DOMAIN_MAX)
  expect(u[UNIFORM_OFFSET_F32.hpZero]).toBe(0)
  expect(u[UNIFORM_OFFSET_F32.interbaseHeight]).toBeCloseTo(
    interbaseBarHeightPx(HEIGHT, 4, DOMAIN_MAX),
  )
})

test('an unresolved domain draws only the indicator triangles on both backends', () => {
  const s = state({ domainMax: undefined })
  expect(
    render(FIVE, s)
      .draws()
      .map(d => d.passId),
  ).toEqual(['indicator'])
  expect(FIVE.map(m => paintOne(m, s).length > 0)).toEqual([
    false,
    false,
    false,
    false,
    true,
    false,
  ])
})

test('interbase off drops the histogram and its triangles on both backends', () => {
  const s = state({ showInterbase: false })
  expect(
    render(FIVE, s)
      .draws()
      .map(d => d.passId),
  ).toEqual(['coverage', 'snpCov', 'modCov', 'clipStrip'])
  expect(FIVE.map(m => paintOne(m, s).length > 0)).toEqual([
    true,
    true,
    true,
    false,
    false,
    false,
  ])
})

test('a band below the canvas top is a uniform on the GPU and a translate on Canvas2D', () => {
  const s = state({ top: 40 })
  const hal = render(FOUR, s)
  expect(hal.uniformsOf(hal.draws()[0]!)![UNIFORM_OFFSET_F32.covTop]).toBe(40)
  const ink = paintOne(FOUR[0]!, s)
  expect(ink[0]).toBe('translate 0 40')
  expect(paintOne(FOUR[0]!)[0]).toMatch(/^rect/)
})

test('a reversed block writes the low bp and a positive length, flipped by the flag', () => {
  const hal = new MockHal(FOUR.map(m => m.pass))
  const scratch = new ArrayBuffer(FOUR[0]!.pass.uniformByteSize)
  const reversed = { ...block, reversed: true }
  const clip = clipBlock(reversed, 200, 300, { x: 1, y: 1 })!
  FOUR[0]!.drawRegion(
    hal,
    scratch,
    reversed,
    clip,
    region(),
    state(),
    reversed.displayedRegionIndex,
  )
  const u = hal.getLastUniformsF32()!
  expect(u[UNIFORM_OFFSET_F32.bpHi]! + u[UNIFORM_OFFSET_F32.bpLo]!).toBe(START)
  expect(u[UNIFORM_OFFSET_F32.bpLen]).toBe(100)
  expect(u[UNIFORM_OFFSET_F32.reversed]).toBe(1)
})

const SWEEP_FRAME = { canvasWidth: 200, canvasHeight: 300 }

interface Segment {
  position: number
  yOffset: number
  segHeight: number
  colorType: number
}

function interbaseChannels(segments: Segment[]) {
  return {
    interbasePackedBuffer: packInterbaseInstances(
      {
        position: segments.map(s => s.position),
        yOffset: segments.map(s => s.yOffset),
        segHeight: segments.map(s => s.segHeight),
        colorType: segments.map(s => s.colorType),
      },
      segments.length,
    ),
    count: segments.length,
  }
}

const sweepParams = (
  over: Partial<CoverageBandParams> = {},
): CoverageBandParams => ({
  ...state().band,
  regionMaxDepth: DOMAIN_MAX,
  coverageBinSize: 1,
  // Tall enough that a stack's snapped edges differ, where the region
  // fixture's 4 collapses them all onto one pixel.
  interbaseMaxCount: 40,
  ...over,
})

// A stack of all three segment types at one position, a lone bar and a
// full-scale one. Every segment is inside the block and inside the band, so
// every candidate paints its rect and the sweep's rect-per-instance check
// holds. At `interbaseMaxCount` 40 the tallest is 36px, so it clears a band 100
// tall wherever that band's top is put.
const SWEEP_SEGMENTS: Segment[] = [
  { position: START + 2, yOffset: 0, segHeight: 0.2, colorType: 1 },
  { position: START + 2, yOffset: 0.2, segHeight: 0.3, colorType: 2 },
  { position: START + 2, yOffset: 0.5, segHeight: 0.25, colorType: 3 },
  { position: START + 20, yOffset: 0, segHeight: 0.6, colorType: 1 },
  { position: START + 61, yOffset: 0, segHeight: 1, colorType: 2 },
]

// `top` 40 is the grouped alignments section, where the band's offset reaches
// the painter as a `translate` and the hit test as an addend on both a bar's
// edges — two spellings of one number, which is what this half of the sweep is
// for.
describe.each([0, 40])('interbase at band top %i', top => {
  test.each([false, true])(
    'every drawn bar answers its own hit, reversed=%s',
    reversed => {
      const channels = interbaseChannels(SWEEP_SEGMENTS)
      expect(
        sweepMarkAgainstHit(
          defineMark({
            shape: coverageInterbaseShape,
            channels: (c: typeof channels) => c,
            params: () => sweepParams({ top }),
          }),
          channels,
          { ...block, reversed },
          SWEEP_FRAME,
          { maxDistSq: Number.MIN_VALUE },
        ),
      ).toEqual([])
    },
  )
})

// The sweep cannot cover this pair: the painter draws the whole bar and leaves
// the band clip to the backend, so a bar overhanging the band is ink the hit
// deliberately does not claim.
test('a bar taller than the band stops at the band bottom, and the band top moves both its edges', () => {
  const channels = interbaseChannels([
    { position: START + 2, yOffset: 0, segHeight: 0.8, colorType: 1 },
  ])
  // 200/50 of the half-band overruns a band that starts at 40 and is 100 tall.
  const p = sweepParams({ top: 40, interbaseMaxCount: 200 })
  const hitAt = (yPx: number) =>
    coverageInterbaseShape.hitNearest!(
      channels,
      block,
      SWEEP_FRAME,
      p,
      4,
      yPx,
      [0],
      1e6,
    )
  expect(hitAt(300)).toEqual({ index: 0, x: 4, y: 140, distSq: 160 ** 2 })
  expect(hitAt(0)).toEqual({ index: 0, x: 4, y: 44, distSq: 44 ** 2 })
})

// The triangles paint through render-core's point mark, which batches a
// color's glyphs into one path, so the sweep slices each one out. Every point
// of a triangle's 7x4.5 box has to answer that triangle, and the last-painted
// one where two overlap: the first two are 2bp apart, which at this zoom is
// 4px, so their boxes do overlap.
const SWEEP_INDICATORS = [
  { position: START + 2, colorType: 1 },
  { position: START + 4, colorType: 2 },
  { position: START + 31, colorType: 3 },
  { position: START + 77, colorType: 1 },
]

function indicatorRegion(
  indicators: { position: number; colorType: number }[],
): Region & { count: number } {
  return {
    ...region(),
    indicatorPositions: Uint32Array.from(indicators, i => i.position),
    indicatorTypes: Float32Array.from(indicators, i => i.colorType),
    count: indicators.length,
  }
}

function sliceIndicator(r: Region & { count: number }, i: number) {
  return {
    ...r,
    indicatorPositions: r.indicatorPositions.subarray(i, i + 1),
    indicatorTypes: r.indicatorTypes.subarray(i, i + 1),
    count: 1,
  }
}

const INDICATOR = FIVE.find(m => m.pass.id === 'indicator')!

// Both band tops: `top` reaches the point mark as its row offset, on the
// painter and the hit test alike.
describe.each([0, 40])('indicators at band top %i', top => {
  test.each([false, true])(
    'every drawn triangle answers its own hit, reversed=%s',
    reversed => {
      expect(
        sweepMarkAgainstHit(
          INDICATOR,
          indicatorRegion(SWEEP_INDICATORS),
          { ...block, reversed },
          state({ top }),
          { maxDistSq: Number.MIN_VALUE, sliceOne: sliceIndicator },
        ),
      ).toEqual([])
    },
  )
})

test('a triangle is 7 px wide and 4.5 tall, hanging from the band top in its type\u2019s color', () => {
  const { ctx, ink } = recordingCtx()
  const fills: unknown[] = []
  const recording = {
    ...ctx,
    set fillStyle(v: string) {
      fills.push(v)
    },
    get fillStyle() {
      return ''
    },
  }
  INDICATOR.paintBlock(
    recording,
    indicatorRegion([{ position: START + 20, colorType: 3 }]),
    block,
    state({ top: 40 }),
  )
  // START + 20 is x 40 at 0.5 bp/px
  expect(ink.filter(c => c.startsWith('m') || c.startsWith('l'))).toEqual([
    'm 36.5 40',
    'l 43.5 40',
    'l 40 44.5',
  ])
  expect(fills).toEqual(['rgba(9,0,0,0)'])
})

test('the band hit test answers a triangle by its box and its type', () => {
  const r = indicatorRegion([{ position: START + 20, colorType: 2 }])
  const band = {
    height: HEIGHT,
    top: 40,
    domainMax: DOMAIN_MAX,
    showInterbase: true,
  }
  expect(hitCoverageBand(r, band, block, 40, 42)).toEqual({
    layer: 'indicator',
    position: START + 20,
    type: 2,
  })
  expect(hitCoverageBand(r, band, block, 43, 41)).toMatchObject({
    layer: 'indicator',
  })
  expect(hitCoverageBand(r, band, block, 45, 41)).toBeUndefined()
})
