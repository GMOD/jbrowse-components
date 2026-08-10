import { coverageLayout } from '@jbrowse/alignments-core'
import { normalizedRgbToABGR } from '@jbrowse/core/util/colorBits'
import { splitPositionWithFrac } from '@jbrowse/render-core/blockClipUtils'
import {
  clampBlockScissor,
  devicePxSpan,
  getDpr,
} from '@jbrowse/render-core/canvas2dUtils'
import { slangPass } from '@jbrowse/render-core/slangPass'

import { arcAvailH, arcYScale } from '../../features/arcs/arcYScale.ts'
import {
  ARC_FLAT_PASS,
  ARC_LINE_PASS,
  ARC_MARKER_PASS,
  ARC_PASS,
  PASS_ARC,
  PASS_ARC_FLAT,
  PASS_ARC_LINE,
  PASS_ARC_MARKER,
} from '../../features/arcs/packGpu.ts'
import { uploadArcs } from '../../features/arcs/uploadGpu.ts'
import {
  CONN_LINE_PASS,
  PASS_CONN_LINE,
} from '../../features/connectingLines/packGpu.ts'
import { uploadConnectingLines } from '../../features/connectingLines/uploadGpu.ts'
import {
  COVERAGE_PASS,
  PASS_COVERAGE,
} from '../../features/coverage/packGpu.ts'
import { uploadCoverageBins } from '../../features/coverage/uploadGpu.ts'
import { GAP_PASS, PASS_GAP } from '../../features/gap/packGpu.ts'
import { uploadGaps } from '../../features/gap/uploadGpu.ts'
import {
  INDICATOR_PASS,
  PASS_INDICATOR,
} from '../../features/indicator/packGpu.ts'
import { uploadIndicators } from '../../features/indicator/uploadGpu.ts'
import {
  INSERTION_PASS,
  PASS_INSERTION,
} from '../../features/insertion/packGpu.ts'
import { uploadInsertions } from '../../features/insertion/uploadGpu.ts'
import {
  INTERBASE_PASS,
  PASS_INTERBASE,
} from '../../features/interbase/packGpu.ts'
import { uploadInterbase } from '../../features/interbase/uploadGpu.ts'
import {
  LINKED_READ_LINE_PASS,
  PASS_LINKED_READ_LINE,
} from '../../features/linkedReads/packGpu.ts'
import { uploadLinkedReadLines } from '../../features/linkedReads/uploadGpu.ts'
import {
  MISMATCH_PASS,
  PASS_MISMATCH,
} from '../../features/mismatch/packGpu.ts'
import { uploadMismatches } from '../../features/mismatch/uploadGpu.ts'
import {
  MOD_COVERAGE_PASS,
  PASS_MOD_COV,
} from '../../features/modCoverage/packGpu.ts'
import { uploadModCoverage } from '../../features/modCoverage/uploadGpu.ts'
import {
  MODIFICATION_PASS,
  PASS_MOD,
} from '../../features/modification/packGpu.ts'
import { uploadModifications } from '../../features/modification/uploadGpu.ts'
import { OVERLAP_PASS, PASS_OVERLAP } from '../../features/overlap/packGpu.ts'
import { uploadOverlaps } from '../../features/overlap/uploadGpu.ts'
import {
  PASS_PER_BASE_LETTER,
  PER_BASE_LETTER_PASS,
} from '../../features/perBaseLetter/packGpu.ts'
import { uploadPerBaseLetter } from '../../features/perBaseLetter/uploadGpu.ts'
import {
  PASS_PER_BASE_QUAL,
  PER_BASE_QUALITY_PASS,
} from '../../features/perBaseQuality/packGpu.ts'
import { uploadPerBaseQuality } from '../../features/perBaseQuality/uploadGpu.ts'
import { PASS_READ, READ_PASS } from '../../features/read/packGpu.ts'
import { uploadReads as uploadReadSegments } from '../../features/read/uploadGpu.ts'
import {
  PASS_SNP_COV,
  SNP_COVERAGE_PASS,
} from '../../features/snpCoverage/packGpu.ts'
import { uploadSnpCoverage } from '../../features/snpCoverage/uploadGpu.ts'
import {
  PASS_SOFTCLIP_BASES,
  SOFTCLIP_BASES_PASS,
} from '../../features/softclip/packBases.ts'
import { uploadSoftclipBases } from '../../features/softclip/uploadBases.ts'
import { CLIP_PASS, PASS_CLIP, uploadClips } from '../../shared/clipPass.ts'
import { READ_COLOR_CATEGORY, readCategoryPaletteKeys } from '../colorUtils.ts'
import {
  getSelectionBounds,
  toClipRect,
} from '../components/chainOverlayUtils.ts'
import {
  arcColorPalette,
  arcMarkerColorPalette,
  linkedReadColorPalette,
} from '../shaders/palettes.ts'
import * as flatQuadShader from '../shaders/slang/flatQuad.generated.ts'
import * as readShader from '../shaders/slang/read.generated.ts'
import { PILEUP_LAYERS } from './pileupLayers.ts'
import {
  lazyReadIdToIndex,
  sectionRegionKey,
  sectionRenderState,
} from './rendererTypes.ts'

import type { PileupDataResult } from '../../RenderAlignmentDataRPC/types.ts'
import type { ArcsUploadData } from '../../features/arcs/types.ts'
import type { InsertSizeBand } from '../../shared/insertSizeStats.ts'
import type { ReadColorCategory } from '../colorUtils.ts'
import type { ChainBoundsRegion } from '../components/chainOverlayUtils.ts'
import type { PileupLayerId } from './pileupLayers.ts'
import type {
  AlignmentsRenderingBackend,
  AlignmentsSources,
  ArcBand,
  ColorPalette,
  CoverageUploadData,
  RGBColor,
  ReadUploadData,
  RenderBlock,
  RenderState,
} from './rendererTypes.ts'
import type { GpuHal, PassDescriptor } from '@jbrowse/render-core/hal'

// Shader strides — every pass shares the same Uniforms struct (see
// shaders/slang/alignmentsUniforms.slang) so we use any module's
// UNIFORMS_SIZE_BYTES. Keep one shared ArrayBuffer for the UBO.
const UNIFORMS_SIZE_BYTES = readShader.UNIFORMS_SIZE_BYTES
const U = readShader.UNIFORM_OFFSET_F32
const UI = readShader.UNIFORM_OFFSET_I32
const UU = readShader.UNIFORM_OFFSET_U32
const USLOTS = readShader.UNIFORM_SLOT_ARRAYS

// Pass IDs not yet hosted by a feature folder. Per-feature PASS_* constants
// are imported from features/X/packGpu.ts.
const PASS_FLAT_QUAD = 'flatQuad'

// Fill the per-frame UBO slots. Pure — mutates only the given typed-array
// views. Every field here corresponds to a `u.fieldName` in
// alignmentsUniforms.slang; adding a new field means updating both.
function fillFrameUniforms(
  f: Float32Array,
  i: Int32Array,
  state: RenderState,
  frame: BlockFrame,
) {
  const { region } = frame
  // Set on every frame, not just the arc passes: a zero here would divide by
  // zero in strokeCoverage for anything else that antialiases a stroke.
  f[U.dpr] = getDpr()
  f[U.bpHi] = frame.bpHi
  f[U.bpLo] = frame.bpLo
  // Keep bpLen POSITIVE for reversed regions — this plugin applies the flip via
  // the separate `reversed` uniform (flipX in the shaders), NOT by negating the
  // span length. So bpToClipX stays monotonic and span shaders (mismatch/gap/
  // overlap/read) need no abs/min/max. If you ever bake reversal into bpLen (as
  // wiggle/manhattan/variants do), all of those break at once.
  f[U.bpLen] = frame.clippedBpEnd - frame.clippedBpStart
  f[U.hpZero] = 0
  f[U.canvasW] = frame.canvasW
  f[U.pxPerBp] = frame.canvasW / (frame.clippedBpEnd - frame.clippedBpStart)
  f[U.canvasH] = state.canvasHeight
  // The pileup top in scrolled px: pileupY and the connecting/linked-read
  // shaders all read this as rangeY0 (via pileupRowCenterPx).
  f[U.rangeY0] = state.scrollTop
  f[U.covOffset] = state.pileupTopOffset
  f[U.featHeight] = state.featureHeight
  f[U.featSpacing] = state.featureSpacing
  f[U.covHeight] = state.coverageHeight
  f[U.covYOffset] = state.coverageYOffset
  // Coverage band top in screen px. 0 = sticky (ungrouped); grouped sections
  // pass their scrolled top so the band scrolls with its section.
  f[U.covTop] = state.coverageTopOffset
  const domainMax = state.coverageMaxDepth
  f[U.depthScale] =
    domainMax !== undefined && region.maxDepth > 0
      ? region.maxDepth / domainMax
      : 1
  f[U.depthDomainMax] = domainMax ?? 0
  i[UI.coverageScaleType] = state.coverageIsLog ? 1 : 0
  i[UI.filterMismatchesByFrequency] = state.filterMismatchesByFrequency ? 1 : 0
  i[UI.mismatchAlpha] = state.mismatchAlpha ? 1 : 0
  f[U.binSize] = region.binSize
  // Scale clip/insertion bars to half the coverage drawing height (matches
  // origin/main + the Canvas2D path in drawInterbaseSegments). The worker bakes
  // each bar as a fraction of the region's raw peak depth (interbaseMaxCount ===
  // region.maxDepth); renormalize onto the display's autoscaled coverage domain
  // via depthScale so clip bars track the same domain as the coverage bars
  // (otherwise they render too short when the fetched peak exceeds the nice
  // rounded visible domain — e.g. at SV breakpoints).
  f[U.interbaseHeight] =
    region.interbaseMaxCount > 0
      ? (coverageLayout(state.coverageHeight).effectiveH / 2) * f[U.depthScale]!
      : 0
  f[U.insertUpper] = region.insertSizeStats?.upper ?? NO_INSERT_UPPER
  f[U.insertLower] = region.insertSizeStats?.lower ?? 0
  i[UI.colorScheme] = state.colorScheme
  // Chevron gating only — chain mode's effect on read COLOR is now resolved on
  // the CPU into `readColorCategories`, so the shader no longer branches on it
  // for fills. The bezier connection overlay is orthogonal to chain layout.
  i[UI.chainMode] = state.chainMode ? 1 : 0
  i[UI.showStroke] = state.showOutline && state.featureHeight >= 4 ? 1 : 0
  f[U.reversed] = frame.reversed ? 1 : 0
}

// ---------------------------------------------------------------------------
// Pure buffer-pack helpers. Each takes an RPC payload and returns a ready-to-
// upload ArrayBuffer matching the corresponding Slang shader's instance
// layout. They live outside the renderer class because they touch no HAL
// state — and all performance-sensitive inner loops hoist the host-object
// property accesses to locals so V8 reads through typed-array views directly.
// Per-feature pack/upload helpers live in features/X/{packGpu,uploadGpu}.ts.
// ---------------------------------------------------------------------------

// Arc-pass UBO patch. The arc shaders read the same UBO as the read pass but
// place Y in absolute canvas px against the arc band, so we overwrite the
// band-sensitive slots before the draw. Pure — mutates only the views.
//
// `arcAnchorPx` is the arc baseline in absolute canvas px (band bottom in up
// mode, band top in down mode) — what the shaders add to their per-vertex Y
// before dividing by the full canvas height. `arcBandH` is the band's height,
// the extent the dome/flat Y-scale maps into. Keeping the band out of the
// viewport (it stays full-canvas) means a grouped section's band can scroll
// partly off-screen without an out-of-bounds viewport (WebGPU rejects those
// pre-Chrome-135); the devBand scissor does the real band clip.
interface ArcFrame {
  region: LocalRegion
  block: RenderBlock
  state: RenderState
  scissorX: number
  scissorW: number
  arcBandH: number
  dpr: number
  arcAnchorPx: number
}
function fillArcUniforms(f: Float32Array, a: ArcFrame) {
  const { block, state, scissorX, scissorW, arcBandH, dpr, arcAnchorPx } = a
  const blockW = block.screenEndPx - block.screenStartPx
  const [hi, lo] = splitPositionWithFrac(block.start)
  f[U.covOffset] = arcAnchorPx
  f[U.canvasH] = state.canvasHeight
  f[U.arcBandH] = arcBandH
  f[U.canvasW] = scissorW
  f[U.blockStartPx] = block.screenStartPx - scissorX
  f[U.blockWidth] = blockW
  f[U.bpHi] = hi
  f[U.bpLo] = lo
  f[U.bpLen] = block.end - block.start
  // A near-horizontal arc thinner than ~1.5 device px has no vertical room to
  // anti-alias and stairsteps. Floor at 1.5 device px (expressed in CSS px via
  // /dpr) so the AA always spans >1px. On HiDPI a 1px CSS line is already 2
  // device px, so the floor is below it and the look is unchanged.
  f[U.lineWidthPx] = Math.max(state.readConnectionsLineWidth, 1.5 / dpr)
  // Sizes the antialiasing ramp in device pixels (see STROKE_AA_PX).
  f[U.dpr] = dpr
  f[U.pairedArcsDown] = state.readConnectionsDown ? 1 : 0
  // Same domain rule the Canvas2D/SVG draw applies (arcYScale): read cloud
  // picks its own autoscaled |tlen| domain on a base-2 log axis, arc mode falls
  // back to the bp-span that fits availH at the current zoom and stays linear.
  const pxPerBp = blockW / (block.end - block.start)
  const { domainBp, log } = arcYScale(
    state.arcsYDomainBp,
    arcAvailH(arcBandH),
    pxPerBp,
  )
  f[U.pxPerBp] = pxPerBp
  f[U.arcsYDomainBp] = domainBp
  f[U.arcsYLog] = log ? 1 : 0
}

// Which ColorPalette entry backs each NAMED shader color uniform — the ones a
// pass reads by name (`u.colorBaseA` in snpCoverage, `u.colorInsertion` in
// insertion). The indexed palettes are separate and written below.
//
// A table rather than 30 assignments because it used to be introspected:
// colorCategory.test.ts composed it with `swatchPaletteKeys` to check
// read.slang's category→uniform chain. That chain is gone — the categories are
// an indexed array the CPU fills — so nothing reads this but the loop under it.
export const PALETTE_UNIFORM_FIELDS = {
  colorFwd: 'colorFwdStrand',
  colorRev: 'colorRevStrand',
  colorNostrand: 'colorNostrand',
  colorPairLR: 'colorPairLR',
  colorPairRL: 'colorPairRL',
  colorPairRR: 'colorPairRR',
  colorPairLL: 'colorPairLL',
  colorBaseA: 'colorBaseA',
  colorBaseC: 'colorBaseC',
  colorBaseG: 'colorBaseG',
  colorBaseT: 'colorBaseT',
  colorBaseN: 'colorBaseN',
  colorInsertion: 'colorInsertion',
  colorDeletion: 'colorDeletion',
  colorSkip: 'colorSkip',
  colorSoftclip: 'colorSoftclip',
  colorHardclip: 'colorHardclip',
  colorInsertionIndicator: 'colorInsertionIndicator',
  colorSoftclipIndicator: 'colorSoftclipIndicator',
  colorHardclipIndicator: 'colorHardclipIndicator',
  colorCoverage: 'colorCoverage',
  colorModFwd: 'colorModificationFwd',
  colorModRev: 'colorModificationRev',
  colorLongInsert: 'colorLongInsert',
  colorShortInsert: 'colorShortInsert',
  colorSupplementary: 'colorSupplementary',
  colorSplitInversion: 'colorSplitInversion',
  colorUnmappedMate: 'colorUnmappedMate',
  colorInterchrom: 'colorInterchrom',
  colorMutedSnpBase: 'colorMutedSnpBase',
} satisfies Record<string, keyof ColorPalette>

// Pack every palette color into the UBO. Pure — writes through the given views
// only, no rendering side effects.
//
// Two representations on purpose. The NAMED colors are packed ABGR u32, one
// slot each, which is how every color travels through this renderer. The two
// INDEXED palettes are `float4[]` in the shader and so are written as four
// floats per slot: std140 pads an array element to 16 bytes whatever it holds,
// so the packed form would occupy the same space and still cost an unpack per
// vertex (and slangc can't compile it — see colorPack.slang).
function writePaletteToUbo(u: Uint32Array, f: Float32Array, c: ColorPalette) {
  for (const [uniform, key] of Object.entries(PALETTE_UNIFORM_FIELDS)) {
    const rgb = c[key]
    u[UU[uniform as keyof typeof UU]] = normalizedRgbToABGR(
      rgb[0],
      rgb[1],
      rgb[2],
    )
  }
  const writeSlots = (
    slots: readonly number[],
    palette: readonly RGBColor[],
  ) => {
    for (let i = 0; i < slots.length; i++) {
      const at = slots[i]!
      const rgb = palette[i]!
      f[at] = rgb[0]
      f[at + 1] = rgb[1]
      f[at + 2] = rgb[2]
      // Alpha. The shaders read `.xyz` and set their own, but a uniform slot
      // left unwritten is whatever the last block render put there.
      f[at + 3] = 1
    }
  }
  // Driven by the SHADER's slot count, not the palette's, so a palette that
  // fell out of step leaves an undefined behind here rather than silently
  // painting stale colors in the slots it didn't reach. arcYScale.test.ts pins
  // the two lengths equal.
  writeSlots(USLOTS.arcColor, arcColorPalette)
  writeSlots(USLOTS.arcMarkerColor, arcMarkerColorPalette)
  writeSlots(USLOTS.linkedReadColor, linkedReadColorPalette)
  // One color per read category, indexed by the RC_* the CPU classifier baked
  // into each instance. read.slang used to branch through 17 `cat == RC_X` arms
  // to reach the same named colors; this is that mapping, from the one table
  // the legend also reads.
  for (const [category, key] of Object.entries(readCategoryPaletteKeys)) {
    const at =
      USLOTS.readCategoryColor[
        READ_COLOR_CATEGORY[category as ReadColorCategory]
      ]!
    const rgb = c[key]
    f[at] = rgb[0]
    f[at + 1] = rgb[1]
    f[at + 2] = rgb[2]
    f[at + 3] = 1
  }
}

export const ALIGNMENTS_PASSES: PassDescriptor[] = [
  READ_PASS,
  GAP_PASS,
  MISMATCH_PASS,
  INSERTION_PASS,
  CLIP_PASS,
  MODIFICATION_PASS,
  PER_BASE_QUALITY_PASS,
  PER_BASE_LETTER_PASS,
  COVERAGE_PASS,
  SNP_COVERAGE_PASS,
  MOD_COVERAGE_PASS,
  INTERBASE_PASS,
  INDICATOR_PASS,
  ARC_PASS,
  ARC_FLAT_PASS,
  ARC_MARKER_PASS,
  ARC_LINE_PASS,
  CONN_LINE_PASS,
  LINKED_READ_LINE_PASS,
  OVERLAP_PASS,
  SOFTCLIP_BASES_PASS,
  slangPass({
    id: PASS_FLAT_QUAD,
    mod: flatQuadShader,
  }),
]

export { UNIFORMS_SIZE_BYTES }

// Pure LocalRegion constructor — the shape a region with no pileup feed gets
// (arcs whose mate is off-screen bring their own region key).
function emptyRegion(): LocalRegion {
  return {
    readIdToIndex: lazyReadIdToIndex([]),
    readPositions: new Uint32Array(0),
    readYs: new Uint16Array(0),
    maxDepth: 0,
    binSize: 1,
    interbaseMaxCount: 0,
  }
}

// Pure: the per-region metadata `renderBlocks` reads each frame, derived from
// the same payload the uploads pack. Deliberately separate from the uploads, so
// a region whose data is unchanged can rebuild this (a handful of field reads)
// while skipping the pack — see `syncRegion`. The two conditionals mirror the
// uploads' own guards: a region with no coverage bars / no interbase counts
// keeps `emptyRegion`'s neutral scaling values rather than a stale peak.
function regionMeta(data: ReadUploadData & CoverageUploadData): LocalRegion {
  const hasCoverage = data.coverageGpuBinCount > 0
  return {
    readIdToIndex: lazyReadIdToIndex(data.readIds),
    readPositions: data.readPositions,
    readYs: data.readYs,
    insertSizeStats: data.insertSizeStats,
    maxDepth: hasCoverage ? data.coverageMaxDepth : 0,
    binSize: hasCoverage ? data.coverageBinSize : 1,
    interbaseMaxCount:
      data.interbaseCovPositions.length > 0 ? data.interbaseMaxCount : 0,
  }
}

// What a region's GPU buffers were last packed from. Only the identities are
// held, never the payload itself — a region evicted from `rpcDataMap` must not
// stay alive through the renderer's upload bookkeeping.
interface UploadedRegion {
  // Main-thread layout allocates a fresh `readYs` per run (`cloneWithLayout`),
  // and the color overlay spreads over the laid-out result without touching it,
  // so an identical `readYs` means "same layout run" — i.e. every array feeding
  // every pass but the read pass is the same object the GPU already holds.
  // `undefined` for an arcs-only region.
  layout: Uint16Array | undefined
  // The two per-read arrays the color tier rebakes (`overlayReadTagColors` /
  // `overlayReadColorCategories`). Only the read pass carries them.
  tagColors: Uint32Array | undefined
  colorCategories: Uint8Array | undefined
  arcs: ArcsUploadData | undefined
}

// Per-block inputs collected before each writeUniforms call. Keeping them
// in one record avoids a 10-arg method signature and lets downstream
// overlay passes refer to the same frame without recomputation.
interface BlockFrame {
  region: LocalRegion
  bpHi: number
  bpLo: number
  clippedBpStart: number
  clippedBpEnd: number
  canvasW: number
  reversed: boolean
}

// Per-region data not tracked by the HAL. Extends ChainBoundsRegion so
// `getChainBounds` accepts it directly.
interface LocalRegion extends ChainBoundsRegion {
  insertSizeStats?: InsertSizeBand
  maxDepth: number
  binSize: number
  interbaseMaxCount: number
}

const OVERLAY_REGION = 999999

// Upper bound (bp) for the insert-size color cutoff when no paired stats are
// available. The shader has no "band is undefined" state — it always compares
// against insertUpper/insertLower — so this has to be a value nothing can
// exceed, matching classifyInsertSize's `band === undefined` → always 'normal'.
// 2^31 is exactly that: TLEN is a BAM int32, so |TLEN| <= 2^31 and the shader's
// strict `is > u.insertUpper` is false even for INT32_MIN. It is also exact in
// the f32 uniform. The old 999999 was NOT unreachable — a mate ~1 Mb away in a
// fetch with no primary proper pairs (SV-heavy or all-discordant region) painted
// long-insert on the GPU while the Canvas2D/SVG path and the legend said normal.
// insertLower = 0 needs no such treatment: `is > 0.0 &&` already blocks 'short'.
const NO_INSERT_UPPER = 2 ** 31

// A device-px vertical span: scissor/viewport top + height in backing-store px.
interface DevBand {
  top: number
  height: number
}

// Convert a CSS-px vertical band [top, top+height] to a device-px scissor band,
// clamped to the backing store. `devicePxSpan` rounds the top and bottom edges
// separately (keeping the single-section case bit-exact with the prior
// `bufH - round(top*dpr)` math); the clamp keeps a band that scrolled partly
// off-screen inside [0, bufH].
function devBand(
  top: number,
  height: number,
  dpr: number,
  bufH: number,
): DevBand {
  const span = devicePxSpan(top, top + height, dpr)
  const t = Math.max(0, span.start)
  const b = Math.min(bufH, span.start + span.width)
  return { top: t, height: Math.max(0, b - t) }
}

// Per-block screen geometry shared by every section: the on-screen scissor span
// (CSS px), the genomic window that span maps to, and the device-px viewport.
interface BlockGeom {
  scissorX: number
  scissorW: number
  clippedBpStart: number
  clippedBpEnd: number
  bpHi: number
  bpLo: number
  vpX: number
  vpW: number
}

// Pure: clip a block to the canvas and derive the bp window of the visible
// slice. `reversed` blocks measure the clipped offset from the right edge.
// Returns null when the block is fully off-screen. Shares `clampBlockScissor`
// with the standard `clipBlock` path so both clip to the exact same columns.
function computeBlockGeom(
  block: RenderBlock,
  canvasWidth: number,
  dpr: number,
): BlockGeom | null {
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
  const bpPerPx =
    fullBlockWidth > 0 ? (block.end - block.start) / fullBlockWidth : 1
  const pxFromEdge = block.reversed
    ? block.screenEndPx - scissorEnd
    : scissorX - block.screenStartPx
  const clippedBpStart = block.start + pxFromEdge * bpPerPx
  const clippedBpEnd = clippedBpStart + scissorW * bpPerPx
  const [bpHi, bpLo] = splitPositionWithFrac(clippedBpStart)

  const { start: vpX, width: vpW } = devicePxSpan(scissorX, scissorEnd, dpr)
  return {
    scissorX,
    scissorW,
    clippedBpStart,
    clippedBpEnd,
    bpHi,
    bpLo,
    vpX,
    vpW,
  }
}

// Each pileup layer's shader pass id. The z-order and visibility gating live in
// the shared `PILEUP_LAYERS` list (also driving the Canvas2D renderer); this map
// just resolves each layer to its GPU pass. Typed `Record<PileupLayerId, …>` so
// a new layer can't be added without wiring its pass here.
export const GPU_PILEUP_PASS: Record<PileupLayerId, string> = {
  connLine: PASS_CONN_LINE,
  linkedReadLine: PASS_LINKED_READ_LINE,
  read: PASS_READ,
  overlap: PASS_OVERLAP,
  mod: PASS_MOD,
  perBaseQual: PASS_PER_BASE_QUAL,
  gap: PASS_GAP,
  mismatch: PASS_MISMATCH,
  insertion: PASS_INSERTION,
  clip: PASS_CLIP,
  softclipBases: PASS_SOFTCLIP_BASES,
  perBaseLetter: PASS_PER_BASE_LETTER,
}

// Coverage-band passes in z-order; the band itself is gated by `showCoverage`
// at the call site. The depth-scaled passes need the autoscaled domain max, so
// they are skipped until coverage stats settle (coarseDynamicBlocks is
// 500ms-debounced and `coverageMaxDepth` is undefined until then) — matching the
// Canvas2D `domainMax !== undefined` gate. The interbase count bars (depth-
// scaled) and the fixed-size indicator triangles are both gated on the user's
// `showInterbaseIndicators` — the one toggle governs all interbase marks.
export function coveragePassPlan(
  state: RenderState,
): [pass: string, enabled: boolean][] {
  const hasDomain = state.coverageMaxDepth !== undefined
  return [
    [PASS_COVERAGE, hasDomain],
    [PASS_SNP_COV, hasDomain],
    [PASS_MOD_COV, hasDomain],
    [PASS_INTERBASE, hasDomain && state.showInterbaseIndicators],
    [PASS_INDICATOR, state.showInterbaseIndicators],
  ]
}

// JBrowse brand blue (#00B8FF approx) in normalized linear RGB.
const SELECTION_RGBA = [0, 0.722, 1, 1] as const

// A clip-space selection rectangle, as returned by `toClipRect`.
interface ClipRect {
  sx1: number
  sx2: number
  syTop: number
  syBot: number
}

// Append 4 quads forming a 2px-wide selection frame (top + bottom + two sides)
// to `out`. 2 CSS px matches Canvas2D's strokeRect(lineWidth=2) so the box looks
// identical on the GPU fallback; tx/ty convert that to clip space. Each quad is
// 8 floats: x1,y1,x2,y2,r,g,b,a.
function pushSelectionFrame(
  out: number[],
  c: ClipRect,
  scissorW: number,
  canvasHeight: number,
) {
  const tx = 2 / scissorW
  const ty = 2 / canvasHeight
  const [r, g, b, a] = SELECTION_RGBA
  out.push(
    c.sx1,
    c.syTop,
    c.sx2,
    c.syTop - ty,
    r,
    g,
    b,
    a,
    c.sx1,
    c.syBot + ty,
    c.sx2,
    c.syBot,
    r,
    g,
    b,
    a,
    c.sx1,
    c.syTop,
    c.sx1 + tx,
    c.syBot,
    r,
    g,
    b,
    a,
    c.sx2 - tx,
    c.syTop,
    c.sx2,
    c.syBot,
    r,
    g,
    b,
    a,
  )
}

export class GpuAlignmentsRenderer implements AlignmentsRenderingBackend {
  private hal: GpuHal
  private uData = new ArrayBuffer(UNIFORMS_SIZE_BYTES)
  private uF32 = new Float32Array(this.uData)
  private uU32 = new Uint32Array(this.uData)
  private uI32 = new Int32Array(this.uData)
  // Reusable scratch for save/restore around overlay & arc passes that mutate
  // the UBO. Pre-allocated to avoid per-overlay-block allocations during hover.
  private uScratch = new ArrayBuffer(UNIFORMS_SIZE_BYTES)
  private regions = new Map<number, LocalRegion>()
  // Upload memo, written only by `sync`. Lives on the renderer rather than in a
  // model-side `createRegionUploadSync` because this backend is whole-map synced
  // (one `sync(sources)` call owns every section), and because the renderer is
  // rebuilt with its HAL on a context loss — so the memo drops exactly when the
  // GPU buffers do, which is the part a hand-rolled model-side memo forgets.
  private uploaded = new Map<number, UploadedRegion>()

  constructor(hal: GpuHal) {
    this.hal = hal
  }

  // Save/restore the entire UBO via byte-level memcpy. Float32Array.set on a
  // shared-byte view technically works on spec-compliant engines, but a
  // Uint8Array copy reads as "restore the bytes" and avoids any NaN-pattern
  // reinterpretation concerns.
  private saveUBO() {
    new Uint8Array(this.uScratch).set(new Uint8Array(this.uData))
  }
  private restoreUBO() {
    new Uint8Array(this.uData).set(new Uint8Array(this.uScratch))
  }

  sync(sources: AlignmentsSources) {
    // The HAL side is bracketed by beginUpload/endUpload: endUpload destroys any
    // pass buffer not rewritten (or retained) below, so a pass whose data went
    // empty — and was skipped by its `if (n > 0)` guard — can't leave a stale
    // buffer. The renderer-side metadata map is rebuilt unconditionally: cleared
    // up front and repopulated only for regions present this sync, so it can
    // never hold a stale entry. No manual prune, no `active` bookkeeping to
    // drift out of sync with the HAL. Each (section, region) pair is namespaced
    // via sectionRegionKey; section 0 keys equal the raw region index, so the
    // ungrouped path is byte-identical to pre-grouping.
    this.hal.beginUpload()
    this.regions.clear()
    const seen = new Set<number>()
    sources.sections.forEach((section, s) => {
      for (const [regionIdx, data] of section.laidOutPileupMap) {
        const idx = sectionRegionKey(s, regionIdx)
        seen.add(idx)
        this.syncRegion(idx, data, section.arcsRpcDataMap.get(regionIdx))
      }
      // Each section draws its own arcs. A region with arcs but no pileup (mate
      // off-screen) gets its own pass here; the loop above already handled every
      // region that has both.
      for (const [regionIdx, arcs] of section.arcsRpcDataMap) {
        if (!section.laidOutPileupMap.has(regionIdx)) {
          const idx = sectionRegionKey(s, regionIdx)
          seen.add(idx)
          this.syncRegion(idx, undefined, arcs)
        }
      }
    })
    this.hal.endUpload()
    // Forget keys that went away, so a region that later returns with a
    // reference-identical payload re-uploads instead of trusting buffers
    // endUpload has since swept.
    for (const key of this.uploaded.keys()) {
      if (!seen.has(key)) {
        this.uploaded.delete(key)
      }
    }
  }

  /**
   * Upload one (section, region) key, skipping the pack when the GPU already
   * holds these bytes.
   *
   * The upload autorun re-fires on far more than new data: `sourceSections` is
   * derived through `sections`, so every band-resize drag frame, arc-mode flip
   * and group-collapse rebuilds the array and lands here with the same laid-out
   * payloads. Repacking ~9 passes per region for those cost more than the draw
   * they were preparing for.
   *
   * The gate is whole-region on purpose. `retainRegion` is what keeps the
   * skipped buffers out of endUpload's sweep, and it can only make a
   * region-granular assertion — so any change to any part of a region rebuilds
   * all of it, which is what preserves "a pass whose data went empty leaves no
   * stale buffer".
   *
   * The recolor path is the one exception, and it is safe for a narrower reason:
   * an unchanged `readYs` means the payload is the *same layout run* with only
   * the two per-read color arrays rebaked (the color tier spreads over it —
   * `overlayReadTagColors` / `overlayReadColorCategories`), so no other pass's
   * data can have gone empty and only the read pass needs rewriting. Same shape
   * as `GpuSyntenyRenderer.getInterleaved`'s geometry/color split.
   */
  private syncRegion(
    idx: number,
    data: PileupDataResult | undefined,
    arcs: ArcsUploadData | undefined,
  ) {
    this.regions.set(idx, data ? regionMeta(data) : emptyRegion())
    const prev = this.uploaded.get(idx)
    this.uploaded.set(idx, {
      layout: data?.readYs,
      tagColors: data?.readTagColors,
      colorCategories: data?.readColorCategories,
      arcs,
    })

    if (prev && prev.layout === data?.readYs && prev.arcs === arcs) {
      this.hal.retainRegion(idx)
      if (
        data &&
        (prev.tagColors !== data.readTagColors ||
          prev.colorCategories !== data.readColorCategories)
      ) {
        uploadReadSegments(this.hal, idx, data)
      }
      return
    }

    if (data) {
      uploadReadSegments(this.hal, idx, data)
      uploadGaps(this.hal, idx, data)
      uploadMismatches(this.hal, idx, data)
      uploadInsertions(this.hal, idx, data)
      uploadClips(this.hal, idx, data)
      uploadSoftclipBases(this.hal, idx, data)
      uploadModifications(this.hal, idx, data)
      uploadPerBaseQuality(this.hal, idx, data)
      uploadPerBaseLetter(this.hal, idx, data)
      this.uploadCoverage(idx, data)
      uploadModCoverage(
        this.hal,
        idx,
        data.modCovPackedBuffer,
        data.modCovPositions.length,
      )
      if (data.connectingLinePositions.length > 0) {
        uploadConnectingLines(this.hal, idx, data)
      }
      if (data.numLinkedReadLines > 0) {
        uploadLinkedReadLines(this.hal, idx, data)
      }
      if (data.overlapPositions.length > 0) {
        uploadOverlaps(this.hal, idx, data)
      }
    }
    if (arcs) {
      uploadArcs(this.hal, idx, arcs)
    }
  }

  private uploadCoverage(
    displayedRegionIndex: number,
    data: CoverageUploadData,
  ) {
    if (data.coverageGpuBinCount > 0) {
      uploadCoverageBins(
        this.hal,
        displayedRegionIndex,
        data.coveragePackedBuffer,
        data.coverageGpuBinCount,
      )
    }

    uploadSnpCoverage(
      this.hal,
      displayedRegionIndex,
      data.snpPackedBuffer,
      data.snpPositions.length,
    )

    uploadInterbase(
      this.hal,
      displayedRegionIndex,
      data.interbasePackedBuffer,
      data.interbaseCovPositions.length,
    )

    uploadIndicators(
      this.hal,
      displayedRegionIndex,
      data.indicatorPackedBuffer,
      data.indicatorPositions.length,
    )
  }

  private writeUniforms(state: RenderState, frame: BlockFrame) {
    fillFrameUniforms(this.uF32, this.uI32, state, frame)
    writePaletteToUbo(this.uU32, this.uF32, state.colors)
    if (state.showModifications) {
      // Canvas equivalent: buildBaseColorTupleMap / buildCigarOpDrawColors in
      // features/mismatch/baseColors.ts — keep in sync when changing this.
      const m = state.colors.colorMutedSnpBase
      const grey = normalizedRgbToABGR(m[0], m[1], m[2])
      this.uU32[UU.colorBaseA] = grey
      this.uU32[UU.colorBaseC] = grey
      this.uU32[UU.colorBaseG] = grey
      this.uU32[UU.colorBaseT] = grey
      this.uU32[UU.colorBaseN] = grey
    }
    this.hal.writeUniforms(this.uData)
  }

  renderBlocks(blocks: RenderBlock[], state: RenderState) {
    const { canvasWidth, canvasHeight } = state
    const dpr = getDpr()
    const bufH = Math.round(canvasHeight * dpr)
    this.hal.resize(canvasWidth, canvasHeight)
    this.hal.beginFrame(0, 0, 0, 0)

    let hasDrawn = false
    for (const block of blocks) {
      const geom = computeBlockGeom(block, canvasWidth, dpr)
      if (geom) {
        // Each stacked section sets its own vertical offsets and clip bands.
        // Section 0's region key equals the raw region index, so the ungrouped
        // (single-section) case reproduces the prior draw exactly.
        for (let s = 0; s < state.sections.length; s++) {
          if (this.drawSection(block, geom, state, s, dpr, bufH)) {
            hasDrawn = true
          }
        }
      }
    }

    this.hal.clearScissor()
    this.hal.clearViewport()
    this.hal.endFrame()
    this.hal.deleteRegion(OVERLAY_REGION)

    if (!hasDrawn) {
      this.hal.beginFrame(0, 0, 0, 0)
      this.hal.endFrame()
    }
    return hasDrawn
  }

  // Draw one stacked section of one block. Returns whether any band painted, so
  // the caller can flip `canvasDrawn`. A coverage- or arcs-only section (empty
  // pileup band, e.g. read-cloud) still counts as a paint — gating this
  // on the pileup band once left read-cloud stuck on "Loading".
  private drawSection(
    block: RenderBlock,
    geom: BlockGeom,
    state: RenderState,
    sectionIdx: number,
    dpr: number,
    bufH: number,
  ) {
    const sec = state.sections[sectionIdx]!
    const regionKey = sectionRegionKey(sectionIdx, block.displayedRegionIndex)
    const region = this.regions.get(regionKey)
    if (!region) {
      return false
    }

    const frame: BlockFrame = {
      region,
      bpHi: geom.bpHi,
      bpLo: geom.bpLo,
      clippedBpStart: geom.clippedBpStart,
      clippedBpEnd: geom.clippedBpEnd,
      canvasW: geom.scissorW,
      reversed: block.reversed,
    }
    const sectionState = sectionRenderState(state, sec)
    this.writeUniforms(sectionState, frame)
    this.hal.setViewport(geom.vpX, 0, geom.vpW, bufH)

    const cov = devBand(sec.covClipTop, sec.covClipHeight, dpr, bufH)
    const drewCoverage = state.showCoverage && cov.height > 0
    if (drewCoverage) {
      this.hal.setScissor(geom.vpX, cov.top, geom.vpW, cov.height)
      for (const [pass, enabled] of coveragePassPlan(state)) {
        if (enabled) {
          this.hal.drawPass(pass, regionKey)
        }
      }
    }

    // Pileup passes are skipped when the band collapses to zero height
    // (read-cloud draws no stacked pileup); the arc band below is
    // decoupled and still draws.
    const pileup = devBand(sec.pileupClipTop, sec.pileupClipHeight, dpr, bufH)
    const drewPileup = pileup.height > 0
    if (drewPileup) {
      this.hal.setScissor(geom.vpX, pileup.top, geom.vpW, pileup.height)
      for (const layer of PILEUP_LAYERS) {
        if (layer.enabled(state)) {
          this.hal.drawPass(GPU_PILEUP_PASS[layer.id], regionKey)
        }
      }
      this.renderFeatureOverlays(block, sectionState, frame, geom, pileup, bufH)
    }

    // Up- and down-mode arcs both draw here, after the pileup, in their own
    // band: the band never overlaps the pileup, so a single pass suffices and
    // up-mode arcs still land in front of the coverage histogram (drawn
    // earlier). Decoupled from the pileup, so it draws even when the pileup band
    // is empty (read-cloud, where the cloud IS the visualization). Each
    // section carries its own (scrolled) band; undefined when arcs are off.
    if (sec.arcBand) {
      this.drawArcsPass(
        block,
        region,
        sectionState,
        regionKey,
        geom,
        sec.arcBand,
        dpr,
        bufH,
      )
    }

    return drewCoverage || drewPileup || sec.arcBand !== undefined
  }

  private drawArcsPass(
    block: RenderBlock,
    region: LocalRegion,
    state: RenderState,
    regionKey: number,
    geom: BlockGeom,
    band: ArcBand,
    dpr: number,
    bufH: number,
  ) {
    // Arcs render in the full-canvas viewport and place Y in absolute canvas px,
    // so a grouped section's band can scroll partly off-screen without an
    // out-of-bounds viewport (WebGPU rejects those pre-Chrome-135); the devBand
    // scissor does the real band clip. Ungrouped bands sit on-screen, so the
    // scissored output is byte-identical to the pre-grouping single pass.
    const scissor = devBand(band.top, band.height, dpr, bufH)
    if (scissor.height > 0) {
      // saveUBO/restoreUBO bracket a temporary clobber of the shared UBO with
      // arc-band uniforms. There's no try/finally, so everything between them
      // MUST stay synchronous and exception-free: an early return or throw here
      // would leave the UBO holding arc uniforms for the rest of the frame,
      // corrupting every later pass. Keep this block straight-line; if it ever
      // needs a guard that can bail, wrap the save/restore in try/finally.
      this.saveUBO()
      fillArcUniforms(this.uF32, {
        region,
        block,
        state,
        scissorX: geom.scissorX,
        scissorW: geom.scissorW,
        arcBandH: band.height,
        dpr,
        // Up mode anchors at the band bottom (band.top + full height); down
        // mode anchors at the band top.
        arcAnchorPx: band.top + (band.down ? 0 : band.height),
      })
      this.hal.writeUniforms(this.uData)

      this.hal.setViewport(geom.vpX, 0, geom.vpW, bufH)
      this.hal.setScissor(geom.vpX, scissor.top, geom.vpW, scissor.height)
      // Curves then flat connectors — one of the two is always empty, since
      // read cloud draws only flats and arc mode only curves.
      this.hal.drawPass(PASS_ARC, regionKey)
      this.hal.drawPass(PASS_ARC_FLAT, regionKey)
      // Endpoint squares paint on top of the (black) flat connector lines.
      this.hal.drawPass(PASS_ARC_MARKER, regionKey)
      this.hal.drawPass(PASS_ARC_LINE, regionKey)

      this.restoreUBO()
      this.hal.writeUniforms(this.uData)
    }
  }

  private renderFeatureOverlays(
    block: RenderBlock,
    state: RenderState,
    frame: BlockFrame,
    geom: BlockGeom,
    pileup: DevBand,
    bufH: number,
  ) {
    const { region, clippedBpStart, clippedBpEnd } = frame

    // Chain selection supersedes single-read; shared with the Canvas2D renderer.
    const bounds = getSelectionBounds(state, region)
    if (bounds) {
      const bpLen = clippedBpEnd - clippedBpStart
      const quads: number[] = []
      pushSelectionFrame(
        quads,
        toClipRect(
          bounds.startBp,
          bounds.endBp,
          bounds.yRow,
          state,
          clippedBpStart,
          bpLen,
          state.pileupTopOffset,
          state.canvasHeight,
          block.reversed,
        ),
        geom.scissorW,
        state.canvasHeight,
      )
      this.drawOverlayQuads(
        new Float32Array(quads),
        quads.length / 8,
        geom,
        pileup,
        bufH,
      )
    }
  }

  private drawOverlayQuads(
    quads: Float32Array,
    count: number,
    geom: BlockGeom,
    pileup: DevBand,
    bufH: number,
  ) {
    this.hal.uploadBuffer(
      OVERLAY_REGION,
      PASS_FLAT_QUAD,
      quads.buffer as ArrayBuffer,
      count,
    )
    this.hal.setViewport(geom.vpX, 0, geom.vpW, bufH)
    this.hal.setScissor(geom.vpX, pileup.top, geom.vpW, pileup.height)
    this.hal.drawPass(PASS_FLAT_QUAD, OVERLAY_REGION)
  }

  dispose() {
    for (const key of this.regions.keys()) {
      this.hal.deleteRegion(key)
    }
    this.regions.clear()
    this.uploaded.clear()
    this.hal.dispose()
  }
}
