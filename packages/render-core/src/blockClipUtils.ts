import { clampBlockScissor, devicePxSpan } from './canvas2dUtils.ts'

import type { BpRegionBounds } from './renderBlock.ts'

// hp-math split: factor a bp position into a (hi, lo) pair safe to feed
// shaders as float32 (cumulative-bp coordinates can exceed 2^31, so a plain
// `intValue & 0xfff` would wrap). Float64 modulo handles the full 2^53
// safe range. The CPU counterpart of the shader-side `hpSplitUint` in
// shaders/hpmath.slang — but not a byte-for-byte mirror: `hpSplitUint` masks a
// `uint`, whereas this also carries the fractional part and tolerates
// cumulative-bp beyond 2^31. Renderer-side uniform writes use this to mirror
// the shader's hi/lo coordinate space.
export function splitPositionWithFrac(value: number): [number, number] {
  const intValue = Math.floor(value)
  const frac = value - intValue
  // Genomic positions are non-negative, so % matches Math.floor(intValue/4096)*4096
  // pattern while making the modulo intent explicit.
  const loInt = intValue % 4096
  const hi = intValue - loInt
  const lo = loInt + frac
  return [hi, lo]
}

export interface BlockClipResult {
  scissorX: number
  scissorW: number
  pxX: number
  pxW: number
  pxH: number
  // HP-split of the visible block's start/end bp. `clipBlock` computes both
  // so renderers handling reversed blocks can pivot on bpEnd without
  // reconstructing + re-splitting at render time.
  bpStartHi: number
  bpStartLo: number
  bpEndHi: number
  bpEndLo: number
  clippedLengthBp: number
  bpPerPx: number
}

// [hi, lo, ±clippedLengthBp] — the first three floats of the HP uniform buffer
// used by hpmath.slang's hpToClipX. Reversed blocks pivot on bpEnd with a
// negated length.
export function bpRangeXTuple(
  clip: BlockClipResult,
  reversed: boolean,
): [number, number, number] {
  return reversed
    ? [clip.bpEndHi, clip.bpEndLo, -clip.clippedLengthBp]
    : [clip.bpStartHi, clip.bpStartLo, clip.clippedLengthBp]
}

// Write the hp-math bpRangeX tuple (hi, lo, ±clippedLengthBp) into the uniform
// buffer at `offsetF32` — pass the shader's `UNIFORM_OFFSET_F32.bpRangeX`. This
// is the one uniform write every genome-mapped shader shares; routing all of
// them through here keeps the reversed-block pivot and hi/lo split in one place
// (a hand-rolled `uniformF32[U.bpRangeX + n] = …` triple is easy to get subtly
// wrong for reversed blocks).
export function writeBpRangeUniforms(
  uniformF32: Float32Array,
  offsetF32: number,
  clip: BlockClipResult,
  reversed: boolean,
) {
  const [hi, lo, len] = bpRangeXTuple(clip, reversed)
  uniformF32[offsetF32] = hi
  uniformF32[offsetF32 + 1] = lo
  uniformF32[offsetF32 + 2] = len
}

export function clipBlock(
  block: BpRegionBounds,
  canvasWidth: number,
  canvasHeight: number,
  dpr: number,
): BlockClipResult | null {
  const clamp = clampBlockScissor(
    block.screenStartPx,
    block.screenEndPx,
    canvasWidth,
  )
  if (!clamp) {
    return null
  }
  const { scissorX, scissorEnd, scissorW } = clamp

  const { start: pxX, width: pxW } = devicePxSpan(scissorX, scissorEnd, dpr)
  const pxH = Math.round(canvasHeight * dpr)

  const fullBlockWidth = block.screenEndPx - block.screenStartPx
  const regionLengthBp = block.end - block.start
  const bpPerPx = regionLengthBp / fullBlockWidth
  const clippedBpStart =
    block.start + (scissorX - block.screenStartPx) * bpPerPx
  const clippedBpEnd =
    block.start + (scissorEnd - block.screenStartPx) * bpPerPx
  const [bpStartHi, bpStartLo] = splitPositionWithFrac(clippedBpStart)
  const [bpEndHi, bpEndLo] = splitPositionWithFrac(clippedBpEnd)

  return {
    scissorX,
    scissorW,
    pxX,
    pxW,
    pxH,
    bpStartHi,
    bpStartLo,
    bpEndHi,
    bpEndLo,
    clippedLengthBp: clippedBpEnd - clippedBpStart,
    bpPerPx,
  }
}
