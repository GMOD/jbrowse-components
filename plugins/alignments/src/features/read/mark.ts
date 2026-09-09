import { spanLeft, strokeRectInside } from '@jbrowse/render-core/canvas2dUtils'
import { defineMark } from '@jbrowse/render-core/marks'
import { slangPass } from '@jbrowse/render-core/slangPass'

import { readColorFromCategoryIndex } from '../../LinearAlignmentsDisplay/colorUtils.ts'
import { writePileupUniforms } from '../../LinearAlignmentsDisplay/renderers/pileupUniforms.ts'
import {
  bpToScreenX,
  pileupRowOffCanvas,
  pileupRowY,
  shouldOutlineReads,
} from '../../LinearAlignmentsDisplay/renderers/rendererTypes.ts'
import {
  READ_OUTLINE_MIN_WIDTH_PX,
  READ_OUTLINE_PX,
  READ_OUTLINE_SHADE,
} from '../../shaders/slang/read.consts.generated.ts'
import * as readShader from '../../shaders/slang/read.generated.ts'
import { showChevron as shaderShowChevron } from '../../shaders/slang/read.js.generated.ts'
import { CHEVRON_PX } from '../../shaders/slang/readChevron.generated.ts'
import { chevronCapsEdge } from '../../shaders/slang/readChevron.js.generated.ts'

import type { RenderState } from '../../LinearAlignmentsDisplay/renderers/rendererTypes.ts'
import type { InsertSizeBand } from '../../shared/insertSizeStats.ts'
import type { MarkContext2D, MarkShape } from '@jbrowse/render-core/marks'

/**
 * What the read mark reads: the per-read arrays every CIGAR, coverage and
 * highlight path also walks, plus the per-exon segments (reads split at CIGAR
 * N/skip) that are the pass's instances. Each segment carries its parent read
 * index so per-read color, strand and flags resolve through it.
 */
export interface ReadMarkRegion {
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
  segmentPositions: Uint32Array
  segmentReadIndices: Uint32Array
  segmentEdgeFlags: Uint8Array
}

// Pure: pack per-segment instances for the read pass. Hot loop over thousands
// of segments — all host-object property accesses are hoisted to locals so V8
// reads through typed-array views directly.
export function packReadSegments(data: ReadMarkRegion): ArrayBuffer {
  const n = data.segmentReadIndices.length
  const stride32 = readShader.INSTANCE_STRIDE_WORDS
  const F_F32 = readShader.INSTANCE_OFFSET_F32
  const F_I32 = readShader.INSTANCE_OFFSET_I32
  const F_U32 = readShader.INSTANCE_OFFSET_U32
  const buf = new ArrayBuffer(n * readShader.INSTANCE_STRIDE_BYTES)
  const u32 = new Uint32Array(buf)
  const f32 = new Float32Array(buf)
  const i32 = new Int32Array(buf)
  const tagColors = data.readTagColors
  const hasTagColors = tagColors.length > 0
  const colorCategories = data.readColorCategories
  const interchrom = data.readInterchrom
  const readYs = data.readYs
  const readFlags = data.readFlags
  const readMapqs = data.readMapqs
  const readInsertSizes = data.readInsertSizes
  const readStrands = data.readStrands
  const segmentPositions = data.segmentPositions
  const segmentReadIndices = data.segmentReadIndices
  const segmentEdgeFlags = data.segmentEdgeFlags
  for (let j = 0; j < n; j++) {
    const ri = segmentReadIndices[j]!
    const o = j * stride32
    u32[o + F_U32.startOff] = segmentPositions[j * 2]!
    u32[o + F_U32.endOff] = segmentPositions[j * 2 + 1]!
    u32[o + F_U32.y] = readYs[ri]!
    u32[o + F_U32.flags] = readFlags[ri]!
    u32[o + F_U32.mapq] = readMapqs[ri]!
    f32[o + F_F32.insertSize] = readInsertSizes[ri]!
    i32[o + F_I32.strand] = readStrands[ri]!
    u32[o + F_U32.tagColor] = hasTagColors ? tagColors[ri]! : 0
    u32[o + F_U32.edgeFlags] = segmentEdgeFlags[j]!
    u32[o + F_U32.interchrom] = interchrom[ri]!
    u32[o + F_U32.colorCategory] = colorCategories[ri]!
  }
  return buf
}

// Chevron geometry + gating. An arrowhead protrudes past the read's leading
// (fwd) / trailing (rev) edge once the row is tall enough and zoomed in enough;
// direction-uninformative reads need extra width before it appears, and paired
// reads whose mates have collapsed on screen drop it entirely. That whole gate
// is read.slang's, generated into TS below, and which edge it caps and how far
// it reaches are readChevron.slang's — so nothing here can drift from what the
// GPU draws.
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

// Screen x of the arrowhead apex. `capsEdge` is genomic (+1 the end, -1 the
// start); the sign folds in screen orientation so it stays correct on reversed
// blocks (apex lands CHEVRON_PX outside whichever edge is the leading one).
function chevronApexX(capsEdge: number, xStart: number, xEnd: number) {
  const tipX = capsEdge > 0 ? xEnd : xStart
  const otherX = capsEdge > 0 ? xStart : xEnd
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
  ctx: MarkContext2D,
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

function drawReads(
  ctx: MarkContext2D,
  region: ReadMarkRegion,
  block: {
    start: number
    end: number
    screenStartPx: number
    screenEndPx: number
    reversed: boolean
  },
  state: RenderState,
) {
  const bpLength = block.end - block.start
  const fullBlockWidth = block.screenEndPx - block.screenStartPx
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
    // The 1 px floor grows away from the read's start, like every pileup cell
    // (`pileupCellX`) and read.slang's body quad, so a reversed block mirrors a
    // forward one. Anchoring the leftmost edge instead slid a sub-pixel read
    // on a flipped region by up to a pixel from where the shader put it.
    const w = Math.max(1, Math.abs(xEnd - xStart))
    const xL = spanLeft(xStart, xEnd, w)
    const xR = xL + w
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

    const capsEdge = chevronCapsEdge(
      region.readStrands[i]!,
      region.segmentEdgeFlags[s]!,
    )
    const hasChev =
      capsEdge !== 0 &&
      showChevron(
        chevronFrame,
        region.readFlags[i]!,
        region.readInterchrom[i]!,
        region.readInsertSizes[i]!,
        w,
      )

    if (hasChev) {
      const apexX = chevronApexX(capsEdge, xStart, xEnd)
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

/**
 * The read body: one "home plate" pentagon or rect per exon segment, in the
 * category colour the classification pass decided, outlined when the row is
 * tall enough. A hand-tuned glyph rather than a `pileupShape` — its instance
 * is a segment, its colour a per-read function of the scheme — and its ink is
 * the segment's box with the arrowhead it caps. The display answers a hover
 * with the READ (`hitTestFeature`) and lights it as its segments' boxes, so
 * the hit test this shape's ink implies is not the one it uses.
 */
const readShape: MarkShape<ReadMarkRegion, RenderState> = {
  id: 'read',
  pass: {
    ...slangPass({ id: 'read', mod: readShader }),
    pack: packReadSegments,
  },
  writeUniforms: writePileupUniforms,
  paintBlock(ctx, region, block, _frame, state) {
    drawReads(ctx, region, block, state)
  },
  ink(region, block, _frame, state, s) {
    const i = region.segmentReadIndices[s]
    if (i === undefined) {
      return undefined
    }
    const y = pileupRowY(region.readYs[i]!, state)
    if (pileupRowOffCanvas(y, state)) {
      return undefined
    }
    const bpLength = block.end - block.start
    const fullBlockWidth = block.screenEndPx - block.screenStartPx
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
    const w = Math.max(1, Math.abs(xEnd - xStart))
    const xL = spanLeft(xStart, xEnd, w)
    const capsEdge = chevronCapsEdge(
      region.readStrands[i]!,
      region.segmentEdgeFlags[s]!,
    )
    const chevron =
      capsEdge !== 0 &&
      showChevron(
        {
          pxPerBp: fullBlockWidth / bpLength,
          chainMode: state.chainMode,
          colorScheme: state.colorScheme,
          featureHeight: state.featureHeight,
        },
        region.readFlags[i]!,
        region.readInterchrom[i]!,
        region.readInsertSizes[i]!,
        w,
      )
    const apexX = chevron ? chevronApexX(capsEdge, xStart, xEnd) : xL
    const left = Math.min(xL, apexX)
    return {
      left,
      top: y,
      width: Math.max(xL + w, apexX) - left,
      height: state.featureHeight,
    }
  },
}

export const READ_MARK = defineMark({
  shape: readShape,
  channels: (data: ReadMarkRegion) => data,
  params: (state: RenderState) => state,
})
