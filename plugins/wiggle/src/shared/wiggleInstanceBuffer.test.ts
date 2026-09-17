import {
  NO_PREV_START,
  RENDERING_TYPE_LINE,
  RENDERING_TYPE_LINE_CENTER,
  RENDERING_TYPE_XYPLOT,
} from '@jbrowse/wiggle-core'

import {
  INSTANCE_OFFSET_F32 as FILL_F32,
  INSTANCE_OFFSET_U32 as FILL_U32,
  INSTANCE_STRIDE_BYTES as FILL_STRIDE_BYTES,
  INSTANCE_STRIDE_WORDS as FILL_STRIDE_WORDS,
} from './shaders/wiggle.generated.ts'
import {
  INSTANCE_OFFSET_F32 as BAND_F32,
  INSTANCE_OFFSET_U32 as BAND_U32,
  INSTANCE_STRIDE_BYTES as BAND_STRIDE_BYTES,
  INSTANCE_STRIDE_WORDS as BAND_STRIDE_WORDS,
} from './shaders/wiggleBand.generated.ts'
import {
  INSTANCE_OFFSET_F32 as LINE_F32,
  INSTANCE_OFFSET_U32 as LINE_U32,
  INSTANCE_STRIDE_BYTES as LINE_STRIDE_BYTES,
  INSTANCE_STRIDE_WORDS as LINE_STRIDE_WORDS,
} from './shaders/wiggleLine.generated.ts'
import {
  INSTANCE_OFFSET_F32 as CENTER_F32,
  INSTANCE_OFFSET_U32 as CENTER_U32,
  INSTANCE_STRIDE_BYTES as CENTER_STRIDE_BYTES,
  INSTANCE_STRIDE_WORDS as CENTER_STRIDE_WORDS,
} from './shaders/wiggleLineCenter.generated.ts'
import {
  packBandInstances,
  packFillInstances,
  packLineCenterInstances,
  packLineInstances,
} from './wiggleInstanceBuffer.ts'

import type {
  SourceRenderData,
  WiggleRenderingType,
} from '@jbrowse/wiggle-core'

// `renderingType` decides which packer serves a layer at all, so every test
// below states the mode it is about.
function makeSource(
  renderingType: WiggleRenderingType,
  scores: number[],
  starts: number[],
  ends: number[],
  gapLimitBp?: number,
): SourceRenderData {
  const positions = new Uint32Array(scores.length * 2)
  for (let i = 0; i < scores.length; i++) {
    positions[i * 2] = starts[i]!
    positions[i * 2 + 1] = ends[i]!
  }
  return {
    featurePositions: positions,
    featureScores: new Float32Array(scores),
    numFeatures: scores.length,
    color: [1, 0, 0],
    rowIndex: 0,
    renderingType,
    gapLimitBp,
  }
}

const stepSource = (
  scores: number[],
  starts: number[],
  ends: number[],
  gapLimitBp?: number,
) => makeSource(RENDERING_TYPE_LINE, scores, starts, ends, gapLimitBp)

const centerSource = (
  scores: number[],
  starts: number[],
  ends: number[],
  gapLimitBp?: number,
) => makeSource(RENDERING_TYPE_LINE_CENTER, scores, starts, ends, gapLimitBp)

const fillSource = (scores: number[], starts: number[], ends: number[]) =>
  makeSource(RENDERING_TYPE_XYPLOT, scores, starts, ends)

function readStep(buf: ArrayBuffer, i: number) {
  const f32 = new Float32Array(buf)
  const base = i * LINE_STRIDE_WORDS
  return {
    score: f32[base + LINE_F32.score]!,
    prevScore: f32[base + LINE_F32.prevScore]!,
    nextScore: f32[base + LINE_F32.nextScore]!,
  }
}

function readCenter(buf: ArrayBuffer, i: number) {
  const f32 = new Float32Array(buf)
  const u32 = new Uint32Array(buf)
  const base = i * CENTER_STRIDE_WORDS
  return {
    score: f32[base + CENTER_F32.score]!,
    prevStart: u32[base + CENTER_U32.prevStartEnd]!,
    prevEnd: u32[base + CENTER_U32.prevStartEnd + 1]!,
    prevScore: f32[base + CENTER_F32.prevScore]!,
  }
}

describe('packLineInstances', () => {
  test('single isolated feature has prevScore=0 and nextScore=0', () => {
    const buf = packLineInstances([stepSource([5], [0], [100])])
    const f = readStep(buf, 0)
    expect(f.score).toBe(5)
    expect(f.prevScore).toBe(0)
    expect(f.nextScore).toBe(0)
  })

  test('adjacent pair: first rises from zero and uses self-nextScore; second transitions and drops', () => {
    const buf = packLineInstances([stepSource([5, 8], [0, 100], [100, 200])])
    const f0 = readStep(buf, 0)
    const f1 = readStep(buf, 1)

    // first: no prev → rise from zero; adjacent next → nextScore=self so seg3 is degenerate
    expect(f0.prevScore).toBe(0)
    expect(f0.nextScore).toBe(5)

    // second: adjacent prev → transition from prev score; last → drop to zero
    expect(f1.prevScore).toBe(5)
    expect(f1.nextScore).toBe(0)
  })

  test('non-adjacent pair: both features rise from and drop to zero independently', () => {
    // gap between bp 100 and 200
    const buf = packLineInstances([stepSource([5, 8], [0, 200], [100, 300])])
    const f0 = readStep(buf, 0)
    const f1 = readStep(buf, 1)

    expect(f0.prevScore).toBe(0)
    expect(f0.nextScore).toBe(0)
    expect(f1.prevScore).toBe(0)
    expect(f1.nextScore).toBe(0)
  })

  test('middle feature in adjacent triple: prevScore=left, nextScore=self', () => {
    const buf = packLineInstances([
      stepSource([3, 7, 5], [0, 100, 200], [100, 200, 300]),
    ])
    const f = readStep(buf, 1)
    expect(f.score).toBe(7)
    expect(f.prevScore).toBe(3)
    // nextScore=self makes seg3 degenerate; the next feature's seg1 draws the transition
    expect(f.nextScore).toBe(7)
  })

  test('multiple sources: each source starts and ends at zero, regardless of position overlap', () => {
    // Two sources at the same genomic position; they are independent signals
    const src0 = stepSource([5], [0], [100])
    const src1 = stepSource([8], [0], [100])
    const buf = packLineInstances([src0, src1])
    const f0 = readStep(buf, 0)
    const f1 = readStep(buf, 1)

    expect(f0.prevScore).toBe(0)
    expect(f0.nextScore).toBe(0)
    expect(f1.prevScore).toBe(0)
    expect(f1.nextScore).toBe(0)
  })

  test('gap in middle of three features: boundary features isolated, middle one stranded', () => {
    // features: [0-100], gap, [200-300], [300-400]
    const buf = packLineInstances([
      stepSource([3, 7, 5], [0, 200, 300], [100, 300, 400]),
    ])
    const f0 = readStep(buf, 0)
    const f1 = readStep(buf, 1)
    const f2 = readStep(buf, 2)

    // f0: isolated on right side (gap after)
    expect(f0.prevScore).toBe(0)
    expect(f0.nextScore).toBe(0)

    // f1: gap before, adjacent to f2
    expect(f1.prevScore).toBe(0)
    expect(f1.nextScore).toBe(7) // self → degenerate seg3

    // f2: adjacent to f1, last feature
    expect(f2.prevScore).toBe(7)
    expect(f2.nextScore).toBe(0)
  })
})

// prevStartEnd + prevScore drive the center line, which connects each
// feature's bp midpoint to the previous feature's. It links *every* consecutive
// pair in a source (only the first is a run start), so sporadic non-tiling bins
// don't dash the line. The span is passed whole, not pre-averaged: the shader
// averages it in clip space the same way it averages the current feature's, so
// an odd-width bin's half-base midpoint can't shift one end of a segment
// relative to the other.
describe('packLineCenterInstances', () => {
  test('first feature has no previous → sentinel', () => {
    const f = readCenter(
      packLineCenterInstances([centerSource([5], [0], [100])]),
      0,
    )
    expect(f.prevStart).toBe(NO_PREV_START)
    expect(f.prevScore).toBe(0)
  })

  test('adjacent feature carries the previous span and score', () => {
    const buf = packLineCenterInstances([
      centerSource([5, 8], [0, 100], [100, 201]),
    ])
    expect(readCenter(buf, 0).prevStart).toBe(NO_PREV_START)
    expect(readCenter(buf, 1).prevStart).toBe(0)
    expect(readCenter(buf, 1).prevEnd).toBe(100)
    expect(readCenter(buf, 1).prevScore).toBe(5)
  })

  test('odd-width bins keep their half-base midpoint intact', () => {
    // 1bp bins: midpoints are 100.5 / 101.5, unrepresentable as integer bp.
    // The span reaches the shader whole, so the average stays exact.
    const buf = packLineCenterInstances([
      centerSource([5, 8], [100, 101], [101, 102]),
    ])
    expect(readCenter(buf, 1).prevStart).toBe(100)
    expect(readCenter(buf, 1).prevEnd).toBe(101)
  })

  test('non-adjacent (gapped) features still connect: prev span + real score', () => {
    // gap between bp 100 and 200; the center-line bridges it rather than break
    const buf = packLineCenterInstances([
      centerSource([5, 8], [0, 200], [100, 300]),
    ])
    expect(readCenter(buf, 1).prevStart).toBe(0)
    expect(readCenter(buf, 1).prevEnd).toBe(100)
    expect(readCenter(buf, 1).prevScore).toBe(5) // real prev score, not 0
  })

  test('each source restarts the run (first feature = sentinel)', () => {
    const buf = packLineCenterInstances([
      centerSource([5], [0], [100]),
      centerSource([8], [0], [100]),
    ])
    expect(readCenter(buf, 0).prevStart).toBe(NO_PREV_START)
    expect(readCenter(buf, 1).prevStart).toBe(NO_PREV_START)
  })

  test('large coordinates near uint32 range survive intact', () => {
    const a = 4_000_000_000
    const b = 4_000_000_100
    const buf = packLineCenterInstances([
      centerSource([5, 8], [a, b], [b, b + 100]),
    ])
    expect(readCenter(buf, 1).prevStart).toBe(a)
    expect(readCenter(buf, 1).prevEnd).toBe(b)
  })
})

// The center-line connects consecutive pairs regardless of bp-adjacency, so a
// hole is the only thing that may break the run — encoded as the same
// NO_PREV_START the source start uses, which collapses that capsule in the
// shader. buildSourceRenderData supplies the threshold so this and
// drawLineCenter break in the same places.
describe('packLineCenterInstances gap breaks', () => {
  // bins at 0..10, 10..20, then a hole, then 1000..1010
  const starts = [0, 10, 1000]
  const ends = [10, 20, 1010]
  const scores = [1, 2, 3]

  test('a gap past gapLimitBp restarts the run', () => {
    const buf = packLineCenterInstances([
      centerSource(scores, starts, ends, 50),
    ])
    // the in-run feature still links to its predecessor
    expect(readCenter(buf, 1).prevStart).toBe(0)
    expect(readCenter(buf, 1).prevScore).toBe(1)
    // the one across the hole does not
    expect(readCenter(buf, 2).prevStart).toBe(NO_PREV_START)
    expect(readCenter(buf, 2).prevScore).toBe(0)
  })

  test('a gap within gapLimitBp stays connected', () => {
    const buf = packLineCenterInstances([
      centerSource(scores, starts, ends, 5000),
    ])
    expect(readCenter(buf, 2).prevStart).toBe(10)
    expect(readCenter(buf, 2).prevScore).toBe(2)
  })

  // buildSourceRenderData leaves the limit unset for every rendering but this
  // one, which is one connected run.
  test('no limit means one connected run, as before', () => {
    const buf = packLineCenterInstances([centerSource(scores, starts, ends)])
    expect(readCenter(buf, 2).prevStart).toBe(10)
    expect(readCenter(buf, 2).prevScore).toBe(2)
  })
})

// A region's layers feed exactly one of the three packers a rendering can
// select, and the others return empty — which is how those passes release
// their buffers, so only the layout being drawn stays resident. This is also
// what makes each wiggle mark gate on the layers' rendering rather than the
// render state's: the layouts are different sizes, so a pass reading the wrong
// one reads past the end of its records.
describe('each packer serves only its own rendering', () => {
  const scores = [3, 7, 5]
  const starts = [0, 100, 200]
  const ends = [100, 200, 300]

  test('a fill rendering packs 20 bytes a feature and no line buffer', () => {
    const layers = [fillSource(scores, starts, ends)]
    const fill = packFillInstances(layers)
    expect(fill.byteLength).toBe(3 * FILL_STRIDE_BYTES)
    expect(FILL_STRIDE_BYTES).toBe(20)
    expect(packLineInstances(layers).byteLength).toBe(0)
    expect(packLineCenterInstances(layers).byteLength).toBe(0)

    const f32 = new Float32Array(fill)
    const u32 = new Uint32Array(fill)
    for (let i = 0; i < 3; i++) {
      const base = i * FILL_STRIDE_WORDS
      expect(u32[base + FILL_U32.startEnd]).toBe(starts[i])
      expect(u32[base + FILL_U32.startEnd + 1]).toBe(ends[i])
      expect(f32[base + FILL_F32.score]).toBe(scores[i])
      expect(f32[base + FILL_F32.rowIndex]).toBe(0)
    }
  })

  test('a step line packs 32 bytes a feature and nothing else', () => {
    const layers = [stepSource(scores, starts, ends)]
    expect(packLineInstances(layers).byteLength).toBe(3 * LINE_STRIDE_BYTES)
    expect(LINE_STRIDE_BYTES).toBe(32)
    expect(packFillInstances(layers).byteLength).toBe(0)
    expect(packLineCenterInstances(layers).byteLength).toBe(0)
  })

  test('a center line packs 36 bytes a feature and nothing else', () => {
    const layers = [centerSource(scores, starts, ends)]
    expect(packLineCenterInstances(layers).byteLength).toBe(
      3 * CENTER_STRIDE_BYTES,
    )
    expect(CENTER_STRIDE_BYTES).toBe(36)
    expect(packFillInstances(layers).byteLength).toBe(0)
    expect(packLineInstances(layers).byteLength).toBe(0)
  })
})

describe('both line records carry both pivot-side colours', () => {
  const signedColor = [0, 0, 1] as [number, number, number]

  test.each([
    ['step', stepSource, packLineInstances, LINE_U32],
    ['center', centerSource, packLineCenterInstances, CENTER_U32],
  ] as const)(
    '%s: negColor is written beside color, and falls back to it',
    (_name, source, pack, offsets) => {
      const read = (buf: ArrayBuffer) => {
        const u32 = new Uint32Array(buf)
        return [u32[offsets.color], u32[offsets.negColor]]
      }
      const layer = source([1, -1], [0, 100], [100, 200])
      const [pos, neg] = read(pack([{ ...layer, negColor: signedColor }]))
      expect(pos).not.toBe(neg)
      const [solid, solidNeg] = read(pack([layer]))
      expect(solidNeg).toBe(solid)
    },
  )
})

describe('packBandInstances', () => {
  const max = [9, 12, 6]
  const min = [2, 4, -3]
  const starts = [0, 100, 300]
  const ends = [100, 200, 400]

  function bandSource(
    renderingType: WiggleRenderingType,
    gapLimitBp?: number,
  ): SourceRenderData {
    return {
      ...makeSource(renderingType, max, starts, ends, gapLimitBp),
      negColor: [0, 0, 1],
      band: { minScores: new Float32Array(min) },
    }
  }

  function readBand(buf: ArrayBuffer, i: number) {
    const f32 = new Float32Array(buf)
    const u32 = new Uint32Array(buf)
    const base = i * BAND_STRIDE_WORDS
    return {
      start: u32[base + BAND_U32.startEnd]!,
      prevStart: u32[base + BAND_U32.prevStartEnd]!,
      prevEnd: u32[base + BAND_U32.prevStartEnd + 1]!,
      min: f32[base + BAND_F32.minScore]!,
      max: f32[base + BAND_F32.maxScore]!,
      prevMin: f32[base + BAND_F32.prevMinScore]!,
      prevMax: f32[base + BAND_F32.prevMaxScore]!,
      posColor: u32[base + BAND_U32.posColor]!,
      negColor: u32[base + BAND_U32.negColor]!,
    }
  }

  test('packs only band layers, and the line packer skips them', () => {
    const band = bandSource(RENDERING_TYPE_LINE)
    const mean = stepSource([5, 8, 1], starts, ends)
    expect(BAND_STRIDE_BYTES).toBe(44)
    expect(packBandInstances([band, mean]).byteLength).toBe(
      3 * BAND_STRIDE_BYTES,
    )
    expect(packLineInstances([band, mean]).byteLength).toBe(
      3 * LINE_STRIDE_BYTES,
    )
    expect(packBandInstances([mean]).byteLength).toBe(0)
  })

  // Canvas2D paints bands in source order with source-over; the GPU composites
  // the packed instances behind one another. Both must leave the last source's
  // band on top where overlaid bands cross.
  test('overlaid bands stack as Canvas2D paints them', () => {
    const red = { ...bandSource(RENDERING_TYPE_LINE), color: [1, 0, 0] }
    const blue = { ...bandSource(RENDERING_TYPE_LINE), color: [0, 0, 1] }
    const sources = [red, blue] as SourceRenderData[]
    const a = 0.3
    const over = (dst: number[], [r, g, b]: number[]) => [
      r! * a + dst[0]! * (1 - a),
      g! * a + dst[1]! * (1 - a),
      b! * a + dst[2]! * (1 - a),
      a + dst[3]! * (1 - a),
    ]
    const behind = (dst: number[], [r, g, b]: number[]) => [
      dst[0]! + r! * a * (1 - dst[3]!),
      dst[1]! + g! * a * (1 - dst[3]!),
      dst[2]! + b! * a * (1 - dst[3]!),
      dst[3]! + a * (1 - dst[3]!),
    ]
    const unpack = (abgr: number) => [
      (abgr & 0xff) / 255,
      ((abgr >>> 8) & 0xff) / 255,
      ((abgr >>> 16) & 0xff) / 255,
    ]
    const buf = packBandInstances(sources)
    const gpu = [0, 3].map(i => unpack(readBand(buf, i).posColor))
    const clear = [0, 0, 0, 0]
    expect(gpu.reduce(behind, clear)).toEqual(
      sources.map(s => s.color).reduce(over, clear),
    )
  })

  test('each bin carries its range and both sign colours', () => {
    const f = readBand(packBandInstances([bandSource(RENDERING_TYPE_LINE)]), 2)
    expect(f.start).toBe(300)
    expect(f.max).toBe(6)
    expect(f.min).toBe(-3)
    expect(f.posColor).not.toBe(f.negColor)
    expect(f.prevStart).toBe(NO_PREV_START)
  })

  // The ribbon's trapezoid runs from the previous bin's midpoint, so it needs
  // that bin's span and range, and breaks exactly where the mean stroke does.
  test('the interpolated band links to the previous bin within the gap limit', () => {
    const buf = packBandInstances([bandSource(RENDERING_TYPE_LINE_CENTER, 150)])
    const first = readBand(buf, 0)
    const second = readBand(buf, 1)
    const third = readBand(buf, 2)
    expect(first.prevStart).toBe(NO_PREV_START)
    expect([second.prevStart, second.prevEnd]).toEqual([0, 100])
    expect([second.prevMin, second.prevMax]).toEqual([2, 9])
    // centers 150 and 350 sit 200bp apart, past the 150bp limit
    expect(third.prevStart).toBe(NO_PREV_START)

    const line = packLineCenterInstances([
      centerSource([5, 8, 1], starts, ends, 150),
    ])
    expect(readCenter(line, 2).prevStart).toBe(NO_PREV_START)
    expect(readCenter(line, 1).prevStart).toBe(0)
  })
})
