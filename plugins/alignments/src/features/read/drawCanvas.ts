import { readColorFromCategoryIndex } from '../../LinearAlignmentsDisplay/colorUtils.ts'
import {
  bpToScreenX,
  pileupRowOffCanvas,
  pileupRowY,
} from '../../LinearAlignmentsDisplay/renderers/rendererTypes.ts'
import { CHEVRON_PX } from '../../shaders/slang/read.iface.generated.ts'
import { showChevron as shaderShowChevron } from '../../shaders/slang/read.js.generated.ts'

import type {
  DrawBlock,
  RenderState,
} from '../../LinearAlignmentsDisplay/renderers/rendererTypes.ts'
import type { InsertSizeBand } from '../../shared/insertSizeStats.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

interface DrawReadsRegion {
  readPositions: Uint32Array
  readYs: Uint16Array
  readStrands: Int8Array
  readFlags: Uint16Array
  readPairOrientations: Uint8Array
  readTagColors: Uint32Array
  readColorCategories: Uint8Array
  readMapqs: Uint8Array
  readInsertSizes: Float32Array
  readChainHasSupp: Uint8Array | undefined
  readInterchrom: Uint8Array
  insertSizeStats?: InsertSizeBand
  // Per-exon segments: reads split at CIGAR N/skip. Each segment carries its
  // parent read index so per-read color/strand/flags resolve via readIndex.
  segmentPositions: Uint32Array
  segmentReadIndices: Uint32Array
  segmentEdgeFlags: Uint8Array
}

// Chevron geometry + gating. An arrowhead protrudes past the read's leading
// (fwd) / trailing (rev) edge once the row is tall enough and zoomed in enough;
// direction-uninformative reads need extra width before it appears, and paired
// reads whose mates have collapsed on screen drop it entirely. That whole gate
// is read.slang's, generated into TS below, and CHEVRON_PX (the geometry) comes
// from the same shader — so nothing here can drift from what the GPU draws.
//
// Read-edge clipping that the shader's edgeFlags handle is covered here by the
// per-block scissor clip: drawing the arrowhead at the true genomic edge means
// a region-clipped edge falls outside the clip and is suppressed automatically.
const OUTLINE_STYLE = 'rgba(0,0,0,0.3)'
const OUTLINE_WIDTH = 0.5

// Frame-level inputs to the chevron gate, constant across reads in one block.
export interface ChevronFrame {
  pxPerBp: number
  chainMode: boolean
  colorScheme: number
  featureHeight: number
}

// The gate itself is read.slang's `showChevron`, generated into TS (adr-051) —
// this only unpacks the frame-level inputs the draw loop carries as an object.
// It was a hand-written mirror, and an arrow the GPU draws but Canvas2D doesn't
// is a difference between the screen and the SVG export.
export function showChevron(
  f: ChevronFrame,
  flags: number,
  interchrom: number,
  insertSize: number,
  widthPx: number,
) {
  return shaderShowChevron(
    f.chainMode,
    f.pxPerBp,
    f.featureHeight,
    f.colorScheme,
    flags,
    interchrom,
    insertSize,
    widthPx,
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
  const chevronFrame: ChevronFrame = {
    pxPerBp: fullBlockWidth / bpLength,
    chainMode: state.chainMode,
    colorScheme: state.colorScheme,
    featureHeight: fH,
  }

  // Outline paint state is constant across reads; set it once.
  ctx.strokeStyle = OUTLINE_STYLE
  ctx.lineWidth = OUTLINE_WIDTH

  // Assigning fillStyle re-parses the CSS string, which is the per-read cost
  // that matters here — the category→CSS lookup is minor next to it. Under
  // the default scheme every read resolves to the same color, so guarding the
  // assignment collapses a deep pileup's parses to one; schemes that do vary
  // per read (mapq, tag, insert-size gradient) just fall through and assign as
  // before. Strings compare by value, so a freshly built one still matches.
  let lastFill: string | undefined

  // Walk per-exon segments, not whole reads: a spliced read contributes one
  // body rect per exon, so the intron span between them is never filled — the
  // skip pass (drawGaps) draws only its 1px centerline there, with no
  // clearRect. Mirrors the GPU read pass (read.slang / packReadSegments).
  const numSegments = region.segmentReadIndices.length
  for (let s = 0; s < numSegments; s++) {
    const i = region.segmentReadIndices[s]!
    const y = pileupRowY(region.readYs[i]!, state)
    if (pileupRowOffCanvas(y, state)) {
      continue
    }
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
    const w = Math.max(1, xR - xL)
    const outline = state.showOutline && w > 2

    // Paints the category the classification pass already decided — the exact
    // byte read.slang gets as `inst.colorCategory`, so the two backends cannot
    // disagree about a read's color.
    const fill = readColorFromCategoryIndex(
      region.readColorCategories[i]!,
      i,
      region,
      state.colorScheme,
      state.colors,
    )
    if (fill !== lastFill) {
      ctx.fillStyle = fill
      lastFill = fill
    }

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
