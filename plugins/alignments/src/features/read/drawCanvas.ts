import { strokeRectInside } from '@jbrowse/render-core/canvas2dUtils'

import { readColorFromCategoryIndex } from '../../LinearAlignmentsDisplay/colorUtils.ts'
import {
  bpToScreenX,
  pileupRowOffCanvas,
  pileupRowY,
  shouldOutlineReads,
} from '../../LinearAlignmentsDisplay/renderers/rendererTypes.ts'
import {
  CHEVRON_PX,
  READ_OUTLINE_MIN_WIDTH_PX,
  READ_OUTLINE_PX,
  READ_OUTLINE_SHADE,
} from '../../shaders/slang/read.consts.generated.ts'
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

// The outline read.slang draws, reproduced with a stroke. The shader repaints
// the outermost READ_OUTLINE_PX of the glyph at READ_OUTLINE_SHADE of its own
// fill; compositing black at `1 - shade` over that fill is the same operation,
// which is how these two spellings came to agree on colour while disagreeing on
// everything else. Derived from the shader's number rather than restating it,
// so a change to the shade reaches both.
//
// Rounded because the subtraction does not land clean in binary — 1 - 0.85 is
// 0.15000000000000002 — and this string is not only parsed by a canvas. The SVG
// export emits it verbatim as a `stroke` attribute on every read in the file.
const OUTLINE_STYLE = `rgba(0,0,0,${Math.round((1 - READ_OUTLINE_SHADE) * 1e4) / 1e4})`

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
//
// `inset` shrinks it by that many px along every edge's inward normal — the
// polygon offset of the same shape, which is what `strokeRectInside` is to a
// rect: stroke the inset-by-`lineWidth / 2` pentagon at `lineWidth` and the
// whole line lands inside the glyph the fill painted. There is no `strokeRect`
// equivalent to lean on here and no clip either, because a per-read `clip()`
// would emit a `<clipPath>` + `<g>` per read in the vector SVG export.
//
// Three of the five edges are axis-aligned and just move by `inset`. The apex
// is the one that isn't, and both of its numbers come from the same fact: two
// edges meeting at half-angle β pull their shared vertex `inset / sin β` along
// the bisector. The chevron's bisector is the horizontal axis, so with `c` the
// arrowhead's run, `h` the half-height and `L` the diagonal's length, the tip
// pulls back by `inset * L / h`, and the two body corners — where an offset
// top/bottom line meets an offset diagonal — pull back by `inset * (L - c) / h`.
// Both stay far inside the `w > 2` gate: the corner term is under 0.15 px for
// every height the outline is drawn at.
function traceReadArrow(
  ctx: Ctx2D,
  xL: number,
  xR: number,
  y: number,
  fH: number,
  apexX: number,
  inset = 0,
) {
  const yMid = y + fH / 2
  // Which way the arrowhead points; `back` is the read's blunt end, `base` the
  // body edge the arrowhead springs from. Folding the direction into a sign
  // keeps one path for both, as the un-inset version already did.
  const dir = apexX > xR ? 1 : -1
  const backX = dir > 0 ? xL : xR
  const baseX = dir > 0 ? xR : xL
  let backIn = backX
  let baseIn = baseX
  let apexIn = apexX
  // Branch rather than fold `inset` into the arithmetic: the fill's call passes
  // 0, and a zero-height read would take that path through `0 * (L / 0)` = NaN
  // and drop the glyph. Only the outline's call has READ_OUTLINE_MIN_HEIGHT_PX
  // behind it, so only the outline's call may divide by the half-height.
  if (inset !== 0) {
    const h = fH / 2
    const c = Math.abs(apexX - baseX)
    const L = Math.hypot(c, h)
    backIn = backX + dir * inset
    baseIn = baseX - dir * inset * ((L - c) / h)
    apexIn = apexX - dir * inset * (L / h)
  }
  const yTop = y + inset
  const yBot = y + fH - inset
  ctx.beginPath()
  ctx.moveTo(backIn, yTop)
  ctx.lineTo(baseIn, yTop)
  ctx.lineTo(apexIn, yMid)
  ctx.lineTo(baseIn, yBot)
  ctx.lineTo(backIn, yBot)
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
  ctx.lineWidth = READ_OUTLINE_PX

  // The frame-level half of the outline gate, which the GPU spends a uniform on
  // for the same reason: it cannot vary per read. Reading it through the shared
  // predicate is what stops this painter and `GpuAlignmentsRenderer` from
  // answering the height question differently, which they did — this side used
  // to say `fH > 2` against the GPU's `>= 4`, so Compact reads outlined here and
  // in the SVG export but not on screen.
  const outlineFrame = shouldOutlineReads(state)

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
    // The per-read half of the gate. Width is a property of one read, so it
    // belongs in the loop; the frame-level half was decided once, above.
    const outline = outlineFrame && w > READ_OUTLINE_MIN_WIDTH_PX

    // Paints the category the classification pass already decided — the exact
    // byte read.slang gets as `inst.colorCategory`, so the two backends cannot
    // disagree about a read's color.
    const fill = readColorFromCategoryIndex(
      region.readColorCategories[i]!,
      i,
      region,
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
      const apexX = chevronApexX(strand, xStart, xEnd)
      traceReadArrow(ctx, xL, xR, y, fH, apexX)
      ctx.fill()
      if (outline) {
        // Re-traced inset rather than stroked on the fill's own path, for the
        // same reason the rect branch uses strokeRectInside: a centred stroke
        // puts half its width outside the read, where read.slang's outline is a
        // fragment test on distance-to-edge and cannot leave the glyph. On a
        // pileup that half-width lands in the 1px gap between rows and smudges
        // two neighbours together.
        traceReadArrow(ctx, xL, xR, y, fH, apexX, READ_OUTLINE_PX / 2)
        ctx.stroke()
      }
    } else {
      ctx.fillRect(xL, y, w, fH)
      if (outline) {
        // Inside the rect, not straddling its edge — the shader's outline is a
        // fragment test on distance-to-edge and cannot paint outside the glyph.
        // See strokeRectInside for why this matters most in the SVG export.
        strokeRectInside(ctx, xL, y, w, fH, READ_OUTLINE_PX)
      }
    }
  }
}
