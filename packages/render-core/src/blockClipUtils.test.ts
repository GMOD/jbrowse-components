import {
  bpRangeXTuple,
  clipBlock,
  writeBpRangeUniforms,
} from './blockClipUtils.ts'
import { makeBpMapper } from './canvas2dUtils.ts'

import type { BlockClipResult } from './blockClipUtils.ts'
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
    const clip = clipBlock(block(sx + 0.3, 1200), canvasWidth, 20, {
      x: dpr,
      y: dpr,
    })!
    expect(clip.pxX).toBeGreaterThanOrEqual(0)
    expect(clip.pxX + clip.pxW).toBeLessThanOrEqual(backingWidth)
  }
})

// The same rule on the other axis, and the reason `clipBlock` takes a per-axis
// scale rather than a dpr. A display taller than `MAX_CANVAS_DIM_PX / dpr` gets a
// backing store clamped at 8192 while its CSS height keeps growing, so a viewport
// derived from the true dpr asks for more rows than the attachment has and WebGPU
// rejects the whole pass — the track paints blank, with no banner and no error.
// Measured on a retina panel 2026-08-22: 4200 css px at dpr 2 asked for 8400.
test('a clamped canvas gets a viewport its backing store can hold', () => {
  const cssHeight = 4200
  const backingHeight = 8192
  const clip = clipBlock(block(0, 1200), 1000, cssHeight, {
    x: 2,
    y: backingHeight / cssHeight,
  })!
  expect(clip.pxH).toBe(backingHeight)
  // what the true dpr would have asked for, and what got the frame rejected
  expect(Math.round(cssHeight * 2)).toBe(8400)
})

// The exact case that overflowed before edge-rounding: [997,1000] at dpr 1.5 gave
// pxX=1496 pxW=5 -> right edge 1501, one past the 1500px backing store.
test('the previously-overflowing rightmost block is now clamped', () => {
  const clip = clipBlock(block(997, 1200), 1000, 20, { x: 1.5, y: 1.5 })!
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

// The shader half of the contract, in CSS px: `hpToClipX` maps bp to NDC over
// the bpRangeX tuple, and the viewport is set to the block's clipped span, so
// NDC -1/+1 land on the scissor's two edges.
function gpuScreenPx(bp: number, clip: BlockClipResult, reversed: boolean) {
  const [hi, lo, len] = bpRangeXTuple(clip, reversed)
  const ndc = -1 + (2 * (bp - (hi + lo))) / len
  return clip.scissorX + ((ndc + 1) / 2) * clip.scissorW
}

// The GPU and Canvas2D paths have to put a base on the same pixel column, and
// the reversed case is the one that can drift: `clipBlock` derives the clipped
// bp range from `screenStartPx` alone, which names the block's LOW bp forward
// and its HIGH bp reversed. Any asymmetric clip then mirrors the range — and
// `canvasWidth` is `view.trackWidthPx` (`view.width - 2` with track outlines on,
// the default), so the rightmost block is asymmetrically clipped on every view.
test.each([false, true])(
  'GPU bp->px agrees with makeBpMapper on a clipped block (reversed=%s)',
  reversed => {
    const bounds = {
      start: 1_000_000,
      end: 1_001_000,
      screenStartPx: 0,
      screenEndPx: 1000,
      reversed,
    }
    // view.width 1000 minus the 2px track outline: what every display passes
    const clip = clipBlock(bounds, 998, 20, 1)!
    const toX = makeBpMapper(bounds)
    for (const bp of [1_000_000, 1_000_250, 1_000_500, 1_001_000]) {
      expect(gpuScreenPx(bp, clip, reversed)).toBeCloseTo(toX(bp), 6)
    }
  },
)

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

// A block with no pixel span survives clampBlockScissor — floor/ceil widen a
// zero-width span straddling a pixel boundary to one column — and used to feed
// Infinity/NaN straight into every bpRangeX uniform.
test('clipBlock skips a degenerate block instead of emitting NaN uniforms', () => {
  expect(
    clipBlock(
      { start: 1000, end: 2000, screenStartPx: 100.5, screenEndPx: 100.5 },
      800,
      100,
      1,
    ),
  ).toBeNull()
  expect(
    clipBlock(
      { start: 1000, end: 1000, screenStartPx: 100, screenEndPx: 200 },
      800,
      100,
      1,
    ),
  ).toBeNull()
})
