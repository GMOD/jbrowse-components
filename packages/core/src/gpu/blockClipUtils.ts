import { splitPositionWithFrac } from './webglUtils.ts'

export interface RenderBlock {
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
  bpStartHi: number
  bpStartLo: number
  clippedLengthBp: number
  bpPerPx: number
}

export function writeBpRangeUniforms(
  uniformF32: Float32Array,
  clip: BlockClipResult,
  reversed: boolean,
) {
  if (reversed) {
    const endBp = clip.bpStartHi + clip.bpStartLo + clip.clippedLengthBp
    const [endHi, endLo] = splitPositionWithFrac(endBp)
    uniformF32[0] = endHi
    uniformF32[1] = endLo
    uniformF32[2] = -clip.clippedLengthBp
  } else {
    uniformF32[0] = clip.bpStartHi
    uniformF32[1] = clip.bpStartLo
    uniformF32[2] = clip.clippedLengthBp
  }
}

export function clipBlock(
  block: RenderBlock,
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
  const clippedLengthBp = clippedBpEnd - clippedBpStart

  return {
    scissorX,
    scissorW,
    pxX,
    pxW,
    pxH,
    bpStartHi,
    bpStartLo,
    clippedLengthBp,
    bpPerPx,
  }
}
