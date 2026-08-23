import { clampBlockScissor, devicePxSpan } from './canvas2dUtils.ts'

import type { CanvasScale } from './canvas2dUtils.ts'
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
  /**
   * The vertical scale the backing store ACTUALLY got — `hal.resize`'s answer,
   * not `getDpr()`. Carried through so a renderer scissoring bands out of one
   * canvas (`devicePxBand`) has the ratio the clip was built with rather than
   * reconstructing it as `pxH / canvasHeight`, which is a division by a height
   * that can be 0.
   */
  scaleY: number
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

// Poke the hp-math bpRangeX tuple (hi, lo, ±clippedLengthBp) into the uniform
// buffer at `offsetF32` — pass the shader's `UNIFORM_OFFSET_F32.bpRangeX`.
//
// **The offset-poke form, for a renderer that writes its uniforms
// incrementally.** A renderer that sets the whole block in one place says
// `bpRangeX: bpRangeXTuple(clip, reversed)` inside the generated
// `writeUniforms` instead, which is every genome-mapped renderer in tree today.
// Either way the point is the same and is the reason neither is spelled out at
// the call site: the reversed-block pivot and the hi/lo split live in one place,
// and a hand-rolled `uniformF32[U.bpRangeX + n] = …` triple is easy to get
// subtly wrong for reversed blocks.
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
  // The scale the backing store actually got, per axis (`hal.resize`), NOT
  // `getDpr()`: only one axis clamps at a time, so past `MAX_CANVAS_DIM_PX` a
  // canvas is 2x on one axis and less on the other.
  scale: CanvasScale,
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

  const fullBlockWidth = block.screenEndPx - block.screenStartPx
  const regionLengthBp = block.end - block.start
  // A degenerate block (no pixel span, or no bp span) still survives
  // clampBlockScissor — floor/ceil widen a zero-width span straddling a pixel
  // boundary to scissorW === 1. Dividing by it yields Infinity/NaN, which
  // propagates through splitPositionWithFrac into every bpRangeX uniform and
  // silently poisons the draw. Nothing is visible in a zero-width block, so
  // skip it the same way a fully off-screen one is skipped.
  if (fullBlockWidth <= 0 || regionLengthBp <= 0) {
    return null
  }

  const { start: pxX, width: pxW } = devicePxSpan(scissorX, scissorEnd, scale.x)
  const pxH = Math.round(canvasHeight * scale.y)

  const bpPerPx = regionLengthBp / fullBlockWidth
  // How much the clip cut off each SCREEN edge of the block.
  const trimLeftPx = scissorX - block.screenStartPx
  const trimRightPx = block.screenEndPx - scissorEnd
  // `bpStart` is the LOW bp on both orientations and `bpEnd` the high one
  // (`bpRangeXTuple` pivots on bpEnd when reversed), so each is pulled in by the
  // trim on ITS OWN end — and which screen edge that is flips with the
  // orientation, since a reversed block runs bp leftward from `end`. The two
  // orientations agree exactly when nothing is trimmed, which is why the
  // forward-only spelling survived — but `canvasWidth` is `trackWidthPx`, i.e.
  // `view.width - 2` whenever track outlines are on (the default), so the
  // rightmost block is clipped on every view and a reversed one had its whole
  // painting shifted 2px against `makeBpMapper` (the Canvas2D painter and every
  // hit-test). Another member of the reversed-block family in this package's
  // CLAUDE.md: invisible forward, only ever wrong on a flipped view.
  const clippedBpStart =
    block.start + (block.reversed ? trimRightPx : trimLeftPx) * bpPerPx
  const clippedBpEnd =
    block.end - (block.reversed ? trimLeftPx : trimRightPx) * bpPerPx
  const [bpStartHi, bpStartLo] = splitPositionWithFrac(clippedBpStart)
  const [bpEndHi, bpEndLo] = splitPositionWithFrac(clippedBpEnd)

  return {
    scissorX,
    scissorW,
    pxX,
    pxW,
    pxH,
    scaleY: scale.y,
    bpStartHi,
    bpStartLo,
    bpEndHi,
    bpEndLo,
    clippedLengthBp: clippedBpEnd - clippedBpStart,
    bpPerPx,
  }
}
