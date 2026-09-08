import { clipBlock } from '@jbrowse/render-core/blockClipUtils'
import { COVERAGE_BAND_LAYER_ORDER } from '@jbrowse/render-core/coverageBand'
import { MockHal } from '@jbrowse/render-core/hal'
import { GpuMarkBackend } from '@jbrowse/render-core/marks/backend'
import { sweepDrawAgainstHit } from '@jbrowse/render-core/marks/drawAgainstHit'
import { UNIFORM_OFFSET_F32 } from '@jbrowse/render-core/shaders/coverageBar'
import { SCALE_TYPE_LINEAR } from '@jbrowse/wiggle-core/normalize'

import { interbaseBarHeightPx } from './coverageBandBox.ts'
import {
  coverageBandMarks,
  coverageIndicatorShape,
  coverageInterbaseShape,
} from './coverageBandMarks.ts'
import { packCoverageBinsForGpu } from './coverageGpuPacking.ts'
import { packInstances as packIndicatorInstances } from './indicatorLayout.generated.ts'
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
    indicatorPackedBuffer: packIndicatorInstances(
      { position: [START + 3], colorType: [1] },
      1,
    ),
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

test('the five layers are the band order, and the fourth list leaves out the modification slices', () => {
  expect(FIVE.map(m => m.pass.id)).toEqual(COVERAGE_BAND_LAYER_ORDER)
  expect(FOUR.map(m => m.pass.id)).toEqual(
    COVERAGE_BAND_LAYER_ORDER.filter(id => id !== 'modCov'),
  )
})

test('the band stages one uniform write per block, not one per layer', () => {
  const hal = render(FIVE)
  // The five layers read `writeBandUniforms` through one `params` lens, so the
  // four after the first draw off the slot the first staged.
  expect(hal.getUniformWritesF32()).toHaveLength(1)
  expect(hal.draws().map(d => d.uniformWrite)).toEqual([0, 0, 0, 0, 0])
})

test('every layer paints, and no two paint the same ink', () => {
  const signatures = FIVE.map(m => paintOne(m).join('|'))
  for (const s of signatures) {
    expect(s).not.toBe('')
  }
  expect(new Set(signatures).size).toBe(FIVE.length)
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
  ])
})

test('interbase off drops the histogram and its triangles on both backends', () => {
  const s = state({ showInterbase: false })
  expect(
    render(FIVE, s)
      .draws()
      .map(d => d.passId),
  ).toEqual(['coverage', 'snpCov', 'modCov'])
  expect(FIVE.map(m => paintOne(m, s).length > 0)).toEqual([
    true,
    true,
    true,
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
      expect(
        sweepDrawAgainstHit(
          coverageInterbaseShape,
          interbaseChannels(SWEEP_SEGMENTS),
          { ...block, reversed },
          SWEEP_FRAME,
          sweepParams({ top }),
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
  // 200/50 of the half-band is a 180px bar, which ends 49px below a band that
  // starts at 40 and is 100 tall.
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
  expect(hitAt(0)).toEqual({ index: 0, x: 4, y: 45, distSq: 45 ** 2 })
})

function indicatorChannels(
  indicators: { position: number; colorType: number }[],
) {
  return {
    indicatorPackedBuffer: packIndicatorInstances(
      {
        position: indicators.map(i => i.position),
        colorType: indicators.map(i => i.colorType),
      },
      indicators.length,
    ),
    count: indicators.length,
  }
}

// The triangles are traced as a PATH, so what the sweep records per instance is
// the path's bounding box — which is exactly what the hit answers, so this arm
// keeps the containment claim a `fillRect` layer gets rather than needing
// `sliceOne`: every point of a triangle's 7x4.5 box has to answer that triangle,
// and the last-painted one where two overlap. The first two are 2bp apart, which
// at this zoom is 4px, so their boxes do overlap; all four are far enough inside
// the block that `drawIndicators`' extent cull keeps every one of them, which is
// what makes the rects attributable positionally.
const SWEEP_INDICATORS = [
  { position: START + 2, colorType: 1 },
  { position: START + 4, colorType: 2 },
  { position: START + 31, colorType: 3 },
  { position: START + 77, colorType: 1 },
]

// Both band tops, for the same reason the interbase arm sweeps both: `top`
// reaches the painter as a `ctx.translate` and the hit test as an addend.
describe.each([0, 40])('indicators at band top %i', top => {
  test.each([false, true])(
    'every drawn triangle answers its own hit, reversed=%s',
    reversed => {
      expect(
        sweepDrawAgainstHit(
          coverageIndicatorShape,
          indicatorChannels(SWEEP_INDICATORS),
          { ...block, reversed },
          SWEEP_FRAME,
          sweepParams({ top }),
          { maxDistSq: Number.MIN_VALUE },
        ),
      ).toEqual([])
    },
  )
})

// The other half of the interbase clip test, and outside the sweep for the same
// reason: the painter draws the whole 4.5px triangle and leaves the band clip to
// the backend, so on a band shorter than the triangle the hit claims only the
// part inside the band. A band that short is a config-declared one —
// `MIN_BAND_HEIGHT` is 20 — and at every height above the triangle the clamp is
// the triangle's own height and the two boxes are one box.
test('a band shorter than the triangle claims only the part of it inside the band', () => {
  const channels = indicatorChannels([{ position: START + 2, colorType: 1 }])
  const p = sweepParams({ top: 40, height: 3 })
  const hitAt = (yPx: number) =>
    coverageIndicatorShape.hitNearest!(
      channels,
      block,
      SWEEP_FRAME,
      p,
      4,
      yPx,
      [0],
      1e6,
    )
  expect(hitAt(50)).toEqual({ index: 0, x: 4, y: 43, distSq: 49 })
  expect(hitAt(0)).toEqual({ index: 0, x: 4, y: 40, distSq: 1600 })
})
