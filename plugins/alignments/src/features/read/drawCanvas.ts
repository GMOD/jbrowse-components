import { getReadColor } from '../../LinearAlignmentsDisplay/colorUtils.ts'
import { ColorScheme } from '../../LinearAlignmentsDisplay/constants.ts'
import {
  bpToScreenX,
  pileupRowY,
} from '../../LinearAlignmentsDisplay/renderers/rendererTypes.ts'

import type {
  DrawBlock,
  RenderState,
} from '../../LinearAlignmentsDisplay/renderers/rendererTypes.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

interface DrawReadsRegion {
  readPositions: Uint32Array
  readYs: Uint16Array
  readStrands: Int8Array
  readFlags: Uint16Array
  readPairOrientations: Uint8Array
  readTagColors: Uint32Array
  readMapqs: Uint8Array
  readAvgBaseQualities: Uint8Array
  readInsertSizes: Float32Array
  readChainHasSupp: Uint8Array | undefined
  readInterchrom: Uint8Array
  insertSizeStats?: { upper: number; lower: number }
}

// Chevron geometry + gating — SYNC(read.slang). The shader draws an 8px
// arrowhead protruding past the read's leading (fwd) / trailing (rev) edge once
// the row is tall enough and zoomed in enough. Direction-uninformative reads
// (normal scheme, mate unmapped, mate on another chromosome) need extra width
// before the arrow appears, and paired reads whose mates have collapsed on
// screen drop the arrow entirely. Read-edge clipping that the shader's
// edgeFlags handle is covered here by the per-block scissor clip: drawing the
// arrowhead at the true genomic edge means a region-clipped edge falls outside
// the clip and is suppressed automatically.
const CHEVRON_PX = 8
const CHEVRON_DIRLESS_MIN_WIDTH_PX = 30
const PAIR_MIN_SPAN_PX = 10
const OUTLINE_STYLE = 'rgba(0,0,0,0.3)'
const OUTLINE_WIDTH = 0.5

// Frame-level inputs to the chevron gate, constant across reads in one block.
export interface ChevronFrame {
  pxPerBp: number
  chainMode: boolean
  colorScheme: number
  featureHeight: number
}

// Mirror of read.slang `showChev`. Exported so drawCanvas.test.ts can pin it
// against the shader predicate.
export function showChevron(
  f: ChevronFrame,
  flags: number,
  interchrom: number,
  insertSize: number,
  widthPx: number,
) {
  const baseShow = (f.chainMode || f.pxPerBp > 0.1) && f.featureHeight >= 3
  const dirMoot =
    f.colorScheme === ColorScheme.normal ||
    (flags & 8) !== 0 ||
    interchrom !== 0
  const isPaired = (flags & 1) !== 0
  const pairTooTight =
    isPaired && Math.abs(insertSize) * f.pxPerBp < PAIR_MIN_SPAN_PX
  return (
    baseShow &&
    !pairTooTight &&
    (!dirMoot || widthPx > CHEVRON_DIRLESS_MIN_WIDTH_PX)
  )
}

// Screen x of the arrowhead apex. Fwd reads point toward endBp, rev toward
// startBp; the sign folds in screen orientation so it stays correct on reversed
// blocks (apex lands CHEVRON_PX outside whichever edge is the leading one).
function chevronApexX(strand: number, xStart: number, xEnd: number) {
  const tipX = strand > 0 ? xEnd : xStart
  const otherX = strand > 0 ? xStart : xEnd
  const dirSign = Math.sign(tipX - otherX) || 1
  return tipX + dirSign * CHEVRON_PX
}

// "Home plate" pentagon: a [xL,xR] body rect with an arrowhead poking out to
// apexX (right when apexX > xR, otherwise left).
function traceReadArrow(
  ctx: Ctx2D,
  xL: number,
  xR: number,
  y: number,
  fH: number,
  apexX: number,
) {
  const yMid = y + fH / 2
  ctx.beginPath()
  if (apexX > xR) {
    ctx.moveTo(xL, y)
    ctx.lineTo(xR, y)
    ctx.lineTo(apexX, yMid)
    ctx.lineTo(xR, y + fH)
    ctx.lineTo(xL, y + fH)
  } else {
    ctx.moveTo(xR, y)
    ctx.lineTo(xL, y)
    ctx.lineTo(apexX, yMid)
    ctx.lineTo(xL, y + fH)
    ctx.lineTo(xR, y + fH)
  }
  ctx.closePath()
}

export function drawReads(
  ctx: Ctx2D,
  region: DrawReadsRegion,
  block: DrawBlock,
  bpLength: number,
  fullBlockWidth: number,
  state: RenderState,
) {
  const fH = state.featureHeight
  const colorOpts = {
    linkedReads: state.linkedReads,
    flipStrandLongReadChains: state.flipStrandLongReadChains,
  }
  const chevronFrame: ChevronFrame = {
    pxPerBp: fullBlockWidth / bpLength,
    chainMode: state.linkedReads === 'normal',
    colorScheme: state.colorScheme,
    featureHeight: fH,
  }

  // Outline paint state is constant across reads; set it once.
  ctx.strokeStyle = OUTLINE_STYLE
  ctx.lineWidth = OUTLINE_WIDTH

  for (let i = 0; i < region.readFlags.length; i++) {
    const xStart = bpToScreenX(
      region.readPositions[i * 2]!,
      block,
      bpLength,
      fullBlockWidth,
    )
    const xEnd = bpToScreenX(
      region.readPositions[i * 2 + 1]!,
      block,
      bpLength,
      fullBlockWidth,
    )
    const xL = Math.min(xStart, xEnd)
    const xR = Math.max(xStart, xEnd)
    const y = pileupRowY(region.readYs[i]!, state)
    const w = Math.max(1, xR - xL)
    const outline = state.showOutline && w > 2

    ctx.fillStyle = getReadColor(
      i,
      region,
      state.colorScheme,
      state.colors,
      colorOpts,
    )

    const strand = region.readStrands[i]!
    const hasChev =
      strand !== 0 &&
      showChevron(
        chevronFrame,
        region.readFlags[i]!,
        region.readInterchrom[i]!,
        region.readInsertSizes[i]!,
        w,
      )

    if (hasChev) {
      traceReadArrow(ctx, xL, xR, y, fH, chevronApexX(strand, xStart, xEnd))
      ctx.fill()
      if (outline) {
        ctx.stroke()
      }
    } else {
      ctx.fillRect(xL, y, w, fH)
      if (outline) {
        ctx.strokeRect(xL, y, w, fH)
      }
    }
  }
}
