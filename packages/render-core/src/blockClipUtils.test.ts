import { clipBlock } from './blockClipUtils.ts'

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
