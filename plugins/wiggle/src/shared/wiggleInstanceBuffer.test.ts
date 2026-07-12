import {
  FIELD_OFFSET_F32,
  INSTANCE_STRIDE_F32,
} from './shaders/wiggle.generated.ts'
import { interleaveInstances } from './wiggleInstanceBuffer.ts'

import type { SourceRenderData } from '@jbrowse/wiggle-core'

function makeSource(
  scores: number[],
  starts: number[],
  ends: number[],
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
  }
}

function readInstance(buf: ArrayBuffer, i: number) {
  const f32 = new Float32Array(buf)
  const u32 = new Uint32Array(buf)
  const base = i * INSTANCE_STRIDE_F32
  return {
    score: f32[base + FIELD_OFFSET_F32.score]!,
    prevScore: f32[base + FIELD_OFFSET_F32.prevScore]!,
    nextScore: f32[base + FIELD_OFFSET_F32.nextScore]!,
    prevMidBp: u32[base + FIELD_OFFSET_F32.prevMidBp]!,
  }
}

// Sentinel written when there's no adjacent previous feature; must match
// NO_PREV_MID in wiggle.slang.
const NO_PREV_MID = 0xffffffff

describe('interleaveInstances', () => {
  test('single isolated feature has prevScore=0 and nextScore=0', () => {
    const buf = interleaveInstances([makeSource([5], [0], [100])], 1)
    const f = readInstance(buf, 0)
    expect(f.score).toBe(5)
    expect(f.prevScore).toBe(0)
    expect(f.nextScore).toBe(0)
  })

  test('adjacent pair: first rises from zero and uses self-nextScore; second transitions and drops', () => {
    const buf = interleaveInstances(
      [makeSource([5, 8], [0, 100], [100, 200])],
      2,
    )
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
    const buf = interleaveInstances(
      [makeSource([5, 8], [0, 200], [100, 300])],
      2,
    )
    const f0 = readInstance(buf, 0)
    const f1 = readInstance(buf, 1)

    expect(f0.prevScore).toBe(0)
    expect(f0.nextScore).toBe(0)
    expect(f1.prevScore).toBe(0)
    expect(f1.nextScore).toBe(0)
  })

  test('middle feature in adjacent triple: prevScore=left, nextScore=self', () => {
    const buf = interleaveInstances(
      [makeSource([3, 7, 5], [0, 100, 200], [100, 200, 300])],
      3,
    )
    const f = readInstance(buf, 1)
    expect(f.score).toBe(7)
    expect(f.prevScore).toBe(3)
    // nextScore=self makes seg3 degenerate; the next feature's seg1 draws the transition
    expect(f.nextScore).toBe(7)
  })

  test('multiple sources: each source starts and ends at zero, regardless of position overlap', () => {
    // Two sources at the same genomic position; they are independent signals
    const src0 = makeSource([5], [0], [100])
    const src1 = makeSource([8], [0], [100])
    const buf = interleaveInstances([src0, src1], 2)
    const f0 = readInstance(buf, 0)
    const f1 = readInstance(buf, 1)

    expect(f0.prevScore).toBe(0)
    expect(f0.nextScore).toBe(0)
    expect(f1.prevScore).toBe(0)
    expect(f1.nextScore).toBe(0)
  })

  test('gap in middle of three features: boundary features isolated, middle one stranded', () => {
    // features: [0-100], gap, [200-300], [300-400]
    const buf = interleaveInstances(
      [makeSource([3, 7, 5], [0, 200, 300], [100, 300, 400])],
      3,
    )
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

  // prevMidBp drives the center-line (RENDERING_TYPE_LINE_CENTER) pass, which
  // draws a segment from the previous feature's bp midpoint to this one's.
  describe('prevMidBp (center-line)', () => {
    test('first feature has no previous → sentinel', () => {
      const buf = interleaveInstances([makeSource([5], [0], [100])], 1)
      expect(readInstance(buf, 0).prevMidBp).toBe(NO_PREV_MID)
    })

    test('adjacent feature carries the previous midpoint (floored)', () => {
      // prev [0,100] midpoint = 50; [100,201] midpoint = 150 (floored from 150.5)
      const buf = interleaveInstances(
        [makeSource([5, 8], [0, 100], [100, 201])],
        2,
      )
      expect(readInstance(buf, 0).prevMidBp).toBe(NO_PREV_MID)
      expect(readInstance(buf, 1).prevMidBp).toBe(50)
    })

    test('gap before a feature → sentinel, breaking the line', () => {
      // gap between bp 100 and 200
      const buf = interleaveInstances(
        [makeSource([5, 8], [0, 200], [100, 300])],
        2,
      )
      expect(readInstance(buf, 1).prevMidBp).toBe(NO_PREV_MID)
    })

    test('large coordinates near uint32 range keep an exact floored midpoint', () => {
      const a = 4_000_000_000
      const b = 4_000_000_100
      const buf = interleaveInstances(
        [makeSource([5, 8], [a, b], [b, b + 100])],
        2,
      )
      expect(readInstance(buf, 1).prevMidBp).toBe(Math.floor((a + b) / 2))
    })
  })
})
