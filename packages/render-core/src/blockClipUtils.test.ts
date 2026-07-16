import {
  bpRangeXTuple,
  clipBlock,
  writeBpRangeUniforms,
} from './blockClipUtils.ts'

import type { BpRegionBounds } from './renderBlock.ts'

function block(
  screenStartPx: number,
  screenEndPx: number,
  extra?: Partial<BpRegionBounds>,
): BpRegionBounds {
  return { start: 0, end: 1000, screenStartPx, screenEndPx, ...extra }
}

// The scissor/viewport rect must stay inside the backing store: WebGPU rejects a
// scissor whose right edge passes the attachment, blanking the whole frame.
test('rightmost block scissor never overflows the canvas at fractional dpr', () => {
  const dpr = 1.5
  const canvasWidth = 1000
  const backingWidth = Math.round(canvasWidth * dpr)
  // scan every rightmost-block position; each must stay within the backing store
  for (let sx = 900; sx < 1000; sx++) {
    const clip = clipBlock(block(sx + 0.3, 1200), canvasWidth, 20, dpr)!
    expect(clip.pxX).toBeGreaterThanOrEqual(0)
    expect(clip.pxX + clip.pxW).toBeLessThanOrEqual(backingWidth)
  }
})

// The exact case that overflowed before edge-rounding: [997,1000] at dpr 1.5 gave
// pxX=1496 pxW=5 -> right edge 1501, one past the 1500px backing store.
test('the previously-overflowing rightmost block is now clamped', () => {
  const clip = clipBlock(block(997, 1200), 1000, 20, 1.5)!
  expect(clip.pxX).toBe(1496)
  expect(clip.pxX + clip.pxW).toBe(1500)
})

// Adjacent blocks must share a device-pixel boundary — no 1px seam or overlap.
test('adjacent blocks abut exactly at their shared edge', () => {
  const dpr = 1.5
  const canvasWidth = 2000
  for (let b = 100; b < 140; b++) {
    const left = clipBlock(block(b - 1, b), canvasWidth, 20, dpr)!
    const right = clipBlock(block(b, b + 1), canvasWidth, 20, dpr)!
    expect(left.pxX + left.pxW).toBe(right.pxX)
  }
})

test('returns null for a fully off-screen block', () => {
  expect(clipBlock(block(1200, 1400), 1000, 20, 1)).toBeNull()
})

// bpRangeXTuple + writeBpRangeUniforms are the single chokepoint for the one
// uniform write every genome-mapped shader shares; the reversed-block pivot
// (start->end, +len->-len) is the part that's easy to get subtly wrong.
test('bpRangeXTuple pivots on bpEnd with a negated length for reversed blocks', () => {
  const clip = clipBlock(block(100, 900), 1000, 20, 1)!
  expect(bpRangeXTuple(clip, false)).toEqual([
    clip.bpStartHi,
    clip.bpStartLo,
    clip.clippedLengthBp,
  ])
  expect(bpRangeXTuple(clip, true)).toEqual([
    clip.bpEndHi,
    clip.bpEndLo,
    -clip.clippedLengthBp,
  ])
})

test('writeBpRangeUniforms writes the tuple at offsetF32, leaving other slots untouched', () => {
  const clip = clipBlock(block(100, 900), 1000, 20, 1)!
  const f32 = new Float32Array(8)
  const offset = 3
  writeBpRangeUniforms(f32, offset, clip, false)
  const expected = Float32Array.from(bpRangeXTuple(clip, false))
  expect(f32[offset]).toBe(expected[0])
  expect(f32[offset + 1]).toBe(expected[1])
  expect(f32[offset + 2]).toBe(expected[2])
  // slots outside [offset, offset+2] stay at their initial 0
  expect(f32[0]).toBe(0)
  expect(f32[offset + 3]).toBe(0)
})

test('writeBpRangeUniforms honors the reversed pivot', () => {
  const clip = clipBlock(block(100, 900), 1000, 20, 1)!
  const f32 = new Float32Array(3)
  writeBpRangeUniforms(f32, 0, clip, true)
  const expected = Float32Array.from(bpRangeXTuple(clip, true))
  expect(Array.from(f32)).toEqual(Array.from(expected))
})
