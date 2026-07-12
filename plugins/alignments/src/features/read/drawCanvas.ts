import { getReadColor } from '../../LinearAlignmentsDisplay/colorUtils.ts'
import { ColorScheme } from '../../LinearAlignmentsDisplay/constants.ts'
import {
  bpToScreenX,
  pileupRowOffCanvas,
  pileupRowY,
} from '../../LinearAlignmentsDisplay/renderers/rendererTypes.ts'
import {
  CHEVRON_DIRLESS_MIN_WIDTH_PX,
  CHEVRON_PX,
  PAIR_MIN_SPAN_PX,
} from '../../LinearAlignmentsDisplay/shaders/slang/read.iface.generated.ts'

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
  readInsertSizes: Float32Array
  readChainHasSupp: Uint8Array | undefined
  readInterchrom: Uint8Array
  insertSizeStats?: { upper: number; lower: number }
  // Per-exon segments: reads split at CIGAR N/skip. Each segment carries its
  // parent read index so per-read color/strand/flags resolve via readIndex.
  segmentPositions: Uint32Array
  segmentReadIndices: Uint32Array
  segmentEdgeFlags: Uint8Array
}

// Chevron geometry + gating. CHEVRON_PX / CHEVRON_DIRLESS_MIN_WIDTH_PX /
// PAIR_MIN_SPAN_PX are imported from read.generated.ts (read.slang is the
// source of truth), so this Canvas2D path can't drift from the shader. The
// shader draws an arrowhead protruding past the read's leading (fwd) / trailing
// (rev) edge once the row is tall enough and zoomed in enough. Direction-
// uninformative reads (normal scheme, mate unmapped, mate on another
// chromosome) need extra width before the arrow appears, and paired reads whose
// mates have collapsed on screen drop the arrow entirely. Read-edge clipping
// that the shader's edgeFlags handle is covered here by the per-block scissor
// clip: drawing the arrowhead at the true genomic edge means a region-clipped
// edge falls outside the clip and is suppressed automatically.
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
    colorSupplementaryChains: state.colorSupplementaryChains,
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

  // Walk per-exon segments, not whole reads: a spliced read contributes one
  // body rect per exon, so the intron span between them is never filled — the
  // skip pass (drawGaps) draws only its 1px centerline there, with no
  // clearRect. Mirrors the GPU read pass (read.slang / packReadSegments).
  const numSegments = region.segmentReadIndices.length
  for (let s = 0; s < numSegments; s++) {
    const i = region.segmentReadIndices[s]!
    const xStart = bpToScreenX(
      region.segmentPositions[s * 2]!,
      block,
      bpLength,
      fullBlockWidth,
    )
    const xEnd = bpToScreenX(
      region.segmentPositions[s * 2 + 1]!,
      block,
      bpLength,
      fullBlockWidth,
    )
    const xL = Math.min(xStart, xEnd)
    const xR = Math.max(xStart, xEnd)
    const y = pileupRowY(region.readYs[i]!, state)
    if (pileupRowOffCanvas(y, state)) {
      continue
    }
    const w = Math.max(1, xR - xL)
    const outline = state.showOutline && w > 2

    ctx.fillStyle = getReadColor(
      i,
      region,
      state.colorScheme,
      state.colors,
      colorOpts,
    )

    // Chevron rides only the read's leading exon: forward → last segment,
    // reverse → first segment (edgeFlags bit 1 = isLast, bit 0 = isFirst).
    // Matches read.slang's edge-flag gate so the arrow sits at the true read
    // end, never at an internal intron boundary.
    const edgeFlags = region.segmentEdgeFlags[s]!
    const strand = region.readStrands[i]!
    const leadingExon =
      (strand > 0 && (edgeFlags & 0b10) !== 0) ||
      (strand < 0 && (edgeFlags & 0b01) !== 0)
    const hasChev =
      strand !== 0 &&
      leadingExon &&
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
