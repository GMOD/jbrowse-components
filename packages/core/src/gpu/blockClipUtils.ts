import { splitPositionWithFrac } from './webglUtils.ts'

interface ClipBlock {
  screenStartPx: number
  screenEndPx: number
  bpRangeX: [number, number]
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

export function writeBpRangeUniforms(
  uniformF32: Float32Array,
  clip: BlockClipResult,
  reversed: boolean,
) {
  const [hi, lo, len] = bpRangeXTuple(clip, reversed)
  uniformF32[0] = hi
  uniformF32[1] = lo
  uniformF32[2] = len
}

export function clipBlock(
  block: ClipBlock,
  canvasWidth: number,
  canvasHeight: number,
  dpr: number,
): BlockClipResult | null {
  const scissorX = Math.max(0, Math.floor(block.screenStartPx))
  const scissorEnd = Math.min(canvasWidth, Math.ceil(block.screenEndPx))
  const scissorW = scissorEnd - scissorX
  if (scissorW <= 0) {
    return null
  }

  const pxX = Math.round(scissorX * dpr)
  const pxW = Math.round(scissorW * dpr)
  const pxH = Math.round(canvasHeight * dpr)

  const fullBlockWidth = block.screenEndPx - block.screenStartPx
  const regionLengthBp = block.bpRangeX[1] - block.bpRangeX[0]
  const bpPerPx = regionLengthBp / fullBlockWidth
  const clippedBpStart =
    block.bpRangeX[0] + (scissorX - block.screenStartPx) * bpPerPx
  const clippedBpEnd =
    block.bpRangeX[0] + (scissorEnd - block.screenStartPx) * bpPerPx
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
