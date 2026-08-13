import {
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
  INSTANCE_OFFSET_F32,
  INSTANCE_OFFSET_U32,
  INSTANCE_STRIDE_BYTES as LINE_STRIDE_BYTES,
  INSTANCE_STRIDE_WORDS,
} from './shaders/wiggleLine.generated.ts'
import { packFillInstances, packLineInstances } from './wiggleInstanceBuffer.ts'

import type {
  SourceRenderData,
  WiggleRenderingType,
} from '@jbrowse/wiggle-core'

// `renderingType` decides which neighbor-derived fields get written at all, so
// every test below states the mode it is about — the step-line group builds
// step-line layers, the center-line group center-line ones.
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

function readInstance(buf: ArrayBuffer, i: number) {
  const f32 = new Float32Array(buf)
  const u32 = new Uint32Array(buf)
  const base = i * INSTANCE_STRIDE_WORDS
  return {
    score: f32[base + INSTANCE_OFFSET_F32.score]!,
    prevScore: f32[base + INSTANCE_OFFSET_F32.prevScore]!,
    nextScore: f32[base + INSTANCE_OFFSET_F32.nextScore]!,
    prevStart: u32[base + INSTANCE_OFFSET_U32.prevStartEnd]!,
    prevEnd: u32[base + INSTANCE_OFFSET_U32.prevStartEnd + 1]!,
    prevScoreLine: f32[base + INSTANCE_OFFSET_F32.prevScoreLine]!,
  }
}

// Sentinel written when there's no previous feature; must match NO_PREV_START
// in wiggle.slang.
const NO_PREV_START = 0xffffffff

describe('packLineInstances', () => {
  test('single isolated feature has prevScore=0 and nextScore=0', () => {
    const buf = packLineInstances([stepSource([5], [0], [100])])
    const f = readInstance(buf, 0)
    expect(f.score).toBe(5)
    expect(f.prevScore).toBe(0)
    expect(f.nextScore).toBe(0)
  })

  test('adjacent pair: first rises from zero and uses self-nextScore; second transitions and drops', () => {
    const buf = packLineInstances([stepSource([5, 8], [0, 100], [100, 200])])
    const f0 = readInstance(buf, 0)
    const f1 = readInstance(buf, 1)

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
    const f0 = readInstance(buf, 0)
    const f1 = readInstance(buf, 1)

    expect(f0.prevScore).toBe(0)
    expect(f0.nextScore).toBe(0)
    expect(f1.prevScore).toBe(0)
    expect(f1.nextScore).toBe(0)
  })

  test('middle feature in adjacent triple: prevScore=left, nextScore=self', () => {
    const buf = packLineInstances([
      stepSource([3, 7, 5], [0, 100, 200], [100, 200, 300]),
    ])
    const f = readInstance(buf, 1)
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
    const f0 = readInstance(buf, 0)
    const f1 = readInstance(buf, 1)

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
    const f0 = readInstance(buf, 0)
    const f1 = readInstance(buf, 1)
    const f2 = readInstance(buf, 2)

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

  // prevStartEnd + prevScoreLine drive the center-line
  // (RENDERING_TYPE_LINE_CENTER) pass, which connects each feature's bp midpoint
  // to the previous feature's. It links *every* consecutive pair in a source
  // (only the first is a run start), so sporadic non-tiling bins don't dash the
  // line. The span is passed whole, not pre-averaged: the shader averages it in
  // clip space the same way it averages the current feature's, so an odd-width
  // bin's half-base midpoint can't shift one end of a segment relative to the
  // other.
  describe('center-line (prevStartEnd / prevScoreLine)', () => {
    test('first feature has no previous → sentinel', () => {
      const f = readInstance(
        packLineInstances([centerSource([5], [0], [100])]),
        0,
      )
      expect(f.prevStart).toBe(NO_PREV_START)
      expect(f.prevScoreLine).toBe(0)
    })

    test('adjacent feature carries the previous span and score', () => {
      const buf = packLineInstances([
        centerSource([5, 8], [0, 100], [100, 201]),
      ])
      expect(readInstance(buf, 0).prevStart).toBe(NO_PREV_START)
      expect(readInstance(buf, 1).prevStart).toBe(0)
      expect(readInstance(buf, 1).prevEnd).toBe(100)
      expect(readInstance(buf, 1).prevScoreLine).toBe(5)
    })

    test('odd-width bins keep their half-base midpoint intact', () => {
      // 1bp bins: midpoints are 100.5 / 101.5, unrepresentable as integer bp.
      // The span reaches the shader whole, so the average stays exact.
      const buf = packLineInstances([
        centerSource([5, 8], [100, 101], [101, 102]),
      ])
      expect(readInstance(buf, 1).prevStart).toBe(100)
      expect(readInstance(buf, 1).prevEnd).toBe(101)
    })

    test('non-adjacent (gapped) features still connect: prev span + real score', () => {
      // gap between bp 100 and 200; the center-line bridges it rather than break
      const buf = packLineInstances([
        centerSource([5, 8], [0, 200], [100, 300]),
      ])
      expect(readInstance(buf, 1).prevStart).toBe(0)
      expect(readInstance(buf, 1).prevEnd).toBe(100)
      expect(readInstance(buf, 1).prevScoreLine).toBe(5) // real prev score, not 0
    })

    test('each source restarts the run (first feature = sentinel)', () => {
      const buf = packLineInstances([
        centerSource([5], [0], [100]),
        centerSource([8], [0], [100]),
      ])
      expect(readInstance(buf, 0).prevStart).toBe(NO_PREV_START)
      expect(readInstance(buf, 1).prevStart).toBe(NO_PREV_START)
    })

    test('large coordinates near uint32 range survive intact', () => {
      const a = 4_000_000_000
      const b = 4_000_000_100
      const buf = packLineInstances([
        centerSource([5, 8], [a, b], [b, b + 100]),
      ])
      expect(readInstance(buf, 1).prevStart).toBe(a)
      expect(readInstance(buf, 1).prevEnd).toBe(b)
    })
  })
})

// The center-line connects consecutive pairs regardless of bp-adjacency, so a
// hole is the only thing that may break the run — encoded as the same
// NO_PREV_START the source start uses, which collapses that capsule in the
// shader. buildSourceRenderData supplies the threshold so this and
// drawLineCenter break in the same places.
describe('packLineInstances center-line gap breaks', () => {
  // bins at 0..10, 10..20, then a hole, then 1000..1010
  const starts = [0, 10, 1000]
  const ends = [10, 20, 1010]
  const scores = [1, 2, 3]

  test('a gap past gapLimitBp restarts the run', () => {
    const buf = packLineInstances([centerSource(scores, starts, ends, 50)])
    // the in-run feature still links to its predecessor
    expect(readInstance(buf, 1).prevStart).toBe(0)
    expect(readInstance(buf, 1).prevScoreLine).toBe(1)
    // the one across the hole does not
    expect(readInstance(buf, 2).prevStart).toBe(NO_PREV_START)
    expect(readInstance(buf, 2).prevScoreLine).toBe(0)
  })

  test('a gap within gapLimitBp stays connected', () => {
    const buf = packLineInstances([centerSource(scores, starts, ends, 5000)])
    expect(readInstance(buf, 2).prevStart).toBe(10)
    expect(readInstance(buf, 2).prevScoreLine).toBe(2)
  })

  // buildSourceRenderData leaves the limit unset for every rendering but this
  // one, which is one connected run.
  test('no limit means one connected run, as before', () => {
    const buf = packLineInstances([centerSource(scores, starts, ends)])
    expect(readInstance(buf, 2).prevStart).toBe(10)
    expect(readInstance(buf, 2).prevScoreLine).toBe(2)
  })
})

// A region's layers feed exactly one packer, and the other returns empty — which
// is how that pass releases its buffer, so only the layout being drawn stays
// resident. This is also what makes GpuWiggleRenderer.drawRegion take the pass
// off the layers rather than the render state: the two layouts are different
// sizes, so a pass reading the wrong one reads past the end of its records.
describe('each packer serves only its own renderings', () => {
  const scores = [3, 7, 5]
  const starts = [0, 100, 200]
  const ends = [100, 200, 300]

  test('a fill rendering packs 20 bytes a feature and no line buffer', () => {
    const layers = [fillSource(scores, starts, ends)]
    const fill = packFillInstances(layers)
    expect(fill.byteLength).toBe(3 * FILL_STRIDE_BYTES)
    expect(FILL_STRIDE_BYTES).toBe(20)
    // nothing for the line passes to draw, so their buffer is released
    expect(packLineInstances(layers).byteLength).toBe(0)

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

  test('a line rendering packs 40 bytes a feature and no fill buffer', () => {
    const layers = [stepSource(scores, starts, ends)]
    expect(packLineInstances(layers).byteLength).toBe(3 * LINE_STRIDE_BYTES)
    expect(LINE_STRIDE_BYTES).toBe(40)
    expect(packFillInstances(layers).byteLength).toBe(0)
  })

  // Within the shared line record, each of the two renderings still writes only
  // its own neighbour group; the other keeps the zeroes ArrayBuffer hands out.
  test('the step-line writes prevScore/nextScore and not the center-line pair', () => {
    const f = readInstance(
      packLineInstances([stepSource(scores, starts, ends)]),
      1,
    )
    expect(f.prevScore).toBe(3)
    expect(f.nextScore).toBe(7)
    expect(f.prevStart).toBe(0)
    expect(f.prevScoreLine).toBe(0)
  })

  test('the center-line writes prevStartEnd/prevScoreLine and not the step pair', () => {
    const f = readInstance(
      packLineInstances([centerSource(scores, starts, ends)]),
      1,
    )
    expect(f.prevStart).toBe(0)
    expect(f.prevEnd).toBe(100)
    expect(f.prevScoreLine).toBe(3)
    expect(f.prevScore).toBe(0)
    expect(f.nextScore).toBe(0)
  })
})
