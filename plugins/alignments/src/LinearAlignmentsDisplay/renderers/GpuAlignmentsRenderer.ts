import { interbaseBarHeightPx } from '@jbrowse/alignments-core'
import { normalizedRgbToABGR } from '@jbrowse/core/util/colorBits'
import { splitPositionWithFrac } from '@jbrowse/render-core/blockClipUtils'
import {
  clampBlockScissor,
  devicePxSpan,
  getDpr,
} from '@jbrowse/render-core/canvas2dUtils'
import { uploadPass } from '@jbrowse/render-core/instancePass'
import { GpuRenderingBackendBase } from '@jbrowse/render-core/renderingBackendBase'
import { slangPass } from '@jbrowse/render-core/slangPass'

import {
  arcAnchorY,
  arcAvailH,
  arcYScale,
} from '../../features/arcs/arcYScale.ts'
import {
  ARC_FLAT_PASS,
  ARC_LINE_PASS,
  ARC_MARKER_PASS,
  ARC_PASS,
} from '../../features/arcs/packGpu.ts'
import { CLIP_PASS } from '../../features/clip/packGpu.ts'
import { CONN_LINE_PASS } from '../../features/connectingLines/packGpu.ts'
import { COVERAGE_PASS } from '../../features/coverage/packGpu.ts'
import { DELETION_PASS, SKIP_PASS } from '../../features/gap/packGpu.ts'
import { INDICATOR_PASS } from '../../features/indicator/packGpu.ts'
import { INSERTION_PASS } from '../../features/insertion/packGpu.ts'
import { INTERBASE_PASS } from '../../features/interbase/packGpu.ts'
import { LINKED_READ_LINE_PASS } from '../../features/linkedReads/packGpu.ts'
import { effectiveBaseColors } from '../../features/mismatch/baseColors.ts'
import { MISMATCH_PASS } from '../../features/mismatch/packGpu.ts'
import { MOD_COVERAGE_PASS } from '../../features/modCoverage/packGpu.ts'
import { MODIFICATION_PASS } from '../../features/modification/packGpu.ts'
import { OVERLAP_PASS } from '../../features/overlap/packGpu.ts'
import { PER_BASE_LETTER_PASS } from '../../features/perBaseLetter/packGpu.ts'
import { PER_BASE_QUALITY_PASS } from '../../features/perBaseQuality/packGpu.ts'
import { READ_PASS } from '../../features/read/packGpu.ts'
import { SNP_COVERAGE_PASS } from '../../features/snpCoverage/packGpu.ts'
import { SOFTCLIP_BASES_PASS } from '../../features/softclipBases/packGpu.ts'
import { ARC_SLOT_KEYS, LINKED_READ_SLOT_KEYS } from '../../shaders/palettes.ts'
import * as flatQuadShader from '../../shaders/slang/flatQuad.generated.ts'
import * as readShader from '../../shaders/slang/read.generated.ts'
import { READ_COLOR_CATEGORY, readCategoryPaletteKeys } from '../colorUtils.ts'
import {
  getSelectionBounds,
  toClipRect,
} from '../components/chainOverlayUtils.ts'
import { COVERAGE_LAYERS } from './coverageLayers.ts'
import { PILEUP_LAYERS } from './pileupLayers.ts'
import {
  lazyReadIdToIndex,
  sectionRegionKey,
  sectionRenderState,
  shouldOutlineReads,
} from './rendererTypes.ts'

import type { PileupDataResult } from '../../RenderAlignmentDataRPC/types.ts'
import type { ArcsPackData } from '../../features/arcs/packGpu.ts'
import type { ArcsUploadData } from '../../features/arcs/types.ts'
import type { ReadColorCategory } from '../colorUtils.ts'
import type { ChainBoundsRegion } from '../components/chainOverlayUtils.ts'
import type { CoverageLayerId } from './coverageLayers.ts'
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
import type { GpuHal, PipelineDescriptor } from '@jbrowse/render-core/hal'
import type { InstancePass } from '@jbrowse/render-core/instancePass'

// Shader strides — every pass shares the same Uniforms struct (see
// shaders/slang/alignmentsUniforms.slang) so we use any module's
// UNIFORMS_SIZE_BYTES. Keep one shared ArrayBuffer for the UBO.
const UNIFORMS_SIZE_BYTES = readShader.UNIFORMS_SIZE_BYTES
const U = readShader.UNIFORM_OFFSET_F32
const UI = readShader.UNIFORM_OFFSET_I32
const UU = readShader.UNIFORM_OFFSET_U32
const USLOTS = readShader.UNIFORM_SLOT_ARRAYS

// The selection-frame overlay: the one pass with no feature folder and no
// packer, because its instances aren't a region's data — they are four quads
// built per frame from the current selection (see `drawOverlayQuads`), uploaded
// under their own region key and deleted at the end of the frame.
const PASS_FLAT_QUAD = 'flatQuad'
const FLAT_QUAD_PASS = slangPass({
  id: PASS_FLAT_QUAD,
  mod: flatQuadShader,
})

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
  // Both ends of the domain, so `normalizeDepthScalar` can be the twin of
  // `makeScoreNormalizer` rather than a max-only approximation of it. 0 unless
  // the track carries a `minScore` bound.
  f[U.depthDomainMin] = state.coverageMinDepth ?? 0
  // The band's allele-fraction floor, tested against each segment's own
  // `segHeight` in snpCoverage.slang and in `drawSnpSegments`.
  f[U.snpMinFreq] = state.coverageSnpMinFrequency
  i[UI.coverageScaleType] = state.coverageIsLog ? 1 : 0
  i[UI.filterMismatchesByFrequency] = state.filterMismatchesByFrequency ? 1 : 0
  i[UI.mismatchAlpha] = state.mismatchAlpha ? 1 : 0
  f[U.binSize] = region.binSize
  // The same rule drawInterbaseSegments and hitTestInterbase read — see
  // `interbaseBarHeightPx`. This used to spell the ratio `region.maxDepth /
  // domainMax` by reusing `depthScale`, which is the interbase bars' scale only
  // while `interbaseMaxCount === region.maxDepth`.
  f[U.interbaseHeight] = interbaseBarHeightPx(
    state.coverageHeight,
    region.interbaseMaxCount,
    domainMax,
  )
  i[UI.colorScheme] = state.colorScheme
  // Chevron gating only — chain mode's effect on read COLOR is now resolved on
  // the CPU into `readColorCategories`, so the shader no longer branches on it
  // for fills. The bezier connection overlay is orthogonal to chain layout.
  i[UI.chainMode] = state.chainMode ? 1 : 0
  // The frame-level half of the outline gate, which the uniform is the natural
  // home for: `featSize.y` is `u.featHeight` for every read, so deciding it once
  // here is what makes the shader's own y test redundant rather than a second
  // opinion. Shared with the Canvas2D painter — see `shouldOutlineReads`.
  i[UI.showStroke] = shouldOutlineReads(state) ? 1 : 0
  f[U.reversed] = frame.reversed ? 1 : 0
}

// ---------------------------------------------------------------------------
// Pure UBO-fill helpers. They live outside the renderer class because they touch
// no HAL state, and they are all this file holds of the per-pass detail: each
// pass's instance packing lives in its own `features/X/packGpu.ts`, carried by
// the pass descriptor itself, so the renderer names passes without knowing what
// any of them packs.
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
  //
  // All THREE stroked arc-band passes — arc, arcFlat and arcLine — take their
  // width per instance (support-scaled at pack time by `arcLineWidth`) and read
  // this only as the FLOOR to raise it to: `max(inst.lineWidthPx,
  // u.lineWidthPx)`. The floor is about the display, not about how many reads a
  // mark stands for. (The tick pass was the last to stroke with this uniform
  // directly, and the note saying so outlived the change.)
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
// EVERY ENTRY IS A MARK, none a read fill: a read's colour is its RC_* category
// and reaches the GPU through `readCategoryColor` (see alignmentsUniforms.slang).
// This table carried the sixteen read-fill slots for as long as read.slang's
// `cat == RC_X` chain read them, and then for a while after it did not — the
// walk below runs once per region, per track, per frame, so they were packed and
// stored every one of those with nothing left to read them.
export const PALETTE_UNIFORM_FIELDS = {
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
  colorFlatConnector: 'colorFlatConnector',
  colorConnectingLine: 'colorConnectingLine',
  colorOverlap: 'colorOverlap',
  colorOverlapTint: 'colorOverlapTint',
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
function packRgb(rgb: RGBColor) {
  return normalizedRgbToABGR(rgb[0], rgb[1], rgb[2])
}

// The two tables above resolved to `[uboWordIndex, paletteKey]` once at module
// load, because `writeUniforms` calls the writer below per BLOCK FRAME — once
// per region, per track, per frame. As `Object.entries` loop headers they
// allocated a pair array per field on every one of those calls, and each field
// then cost a string-keyed lookup (`UU[...]`, `READ_COLOR_CATEGORY[...]`) to
// reach a word index that never changes.
//
// The palette VALUES are still read per frame, from the live `ColorPalette`: it
// is themed and the modifications-mode mute rewrites five slots afterwards, so
// only the indices are constant. See `writeUniforms` before reaching for the
// larger version that memoizes the block.
type PaletteKey = keyof ColorPalette

const PALETTE_UBO_SLOTS: readonly (readonly [number, PaletteKey])[] =
  Object.entries(PALETTE_UNIFORM_FIELDS).map(
    ([uniform, key]) => [UU[uniform as keyof typeof UU], key] as const,
  )

const READ_CATEGORY_UBO_SLOTS: readonly (readonly [number, PaletteKey])[] =
  Object.entries(readCategoryPaletteKeys).map(
    ([category, key]) =>
      [READ_COLOR_CATEGORY[category as ReadColorCategory], key] as const,
  )

// Takes the shader's own generated setter, which writes every component of an
// element — so the alpha lane cannot be left out here. The shaders read `.xyz`
// and set their own, which is what made the fourth store look optional, and a
// uniform slot left unwritten keeps whatever the last block render put there.
//
// Module-level rather than a closure inside the writer, for the reason the slot
// tables are: it was rebuilt per block frame.
function writePaletteSlots(
  f: Float32Array,
  c: ColorPalette,
  set: (
    f32: Float32Array,
    i: number,
    v0: number,
    v1: number,
    v2: number,
    v3: number,
  ) => void,
  slotCount: number,
  keys: readonly PaletteKey[],
) {
  for (let i = 0; i < slotCount; i++) {
    const rgb = c[keys[i]!]
    set(f, i, rgb[0], rgb[1], rgb[2], 1)
  }
}

function writePaletteToUbo(u: Uint32Array, f: Float32Array, c: ColorPalette) {
  for (const [slot, key] of PALETTE_UBO_SLOTS) {
    u[slot] = packRgb(c[key])
  }
  // Driven by the SHADER's slot count, not the palette's, so a palette that
  // fell out of step leaves an undefined behind here rather than silently
  // painting stale colors in the slots it didn't reach. arcYScale.test.ts pins
  // the two lengths equal.
  // Resolved against `c`, the same themed palette the read categories below
  // use. These three used to be module constants, which is how a dark-mode
  // pileup ended up with dimmed reads under undimmed arcs.
  // One array, indexed by the arc curves, the connector ticks and the
  // read-cloud endpoint squares alike. The squares had a `arcMarkerColor` copy
  // of their own for a substitution that no longer exists (a pale short-insert
  // fill against the saturated stroke; both are pale now).
  //
  // `ARC_SLOT_KEYS` / `LINKED_READ_SLOT_KEYS` are the slot tables' own
  // resolution through `swatchPaletteKeys`, which is what `buildArcColorPalette`
  // (the Canvas2D, SVG and overlay path) also reads — so this writes the same
  // colours without materializing the array that function returns.
  writePaletteSlots(
    f,
    c,
    readShader.setUniformArcColor,
    USLOTS.arcColor.length,
    ARC_SLOT_KEYS,
  )
  writePaletteSlots(
    f,
    c,
    readShader.setUniformLinkedReadColor,
    USLOTS.linkedReadColor.length,
    LINKED_READ_SLOT_KEYS,
  )
  // One color per read category, indexed by the RC_* the CPU classifier baked
  // into each instance. read.slang used to branch through 17 `cat == RC_X` arms
  // to reach the same named colors; this is that mapping, from the one table
  // the legend also reads.
  for (const [slot, key] of READ_CATEGORY_UBO_SLOTS) {
    const rgb = c[key]
    readShader.setUniformReadCategoryColor(f, slot, rgb[0], rgb[1], rgb[2], 1)
  }
}

export { UNIFORMS_SIZE_BYTES }

// Pure LocalRegion constructor — the shape a region with no pileup feed gets
// (arcs whose mate is off-screen bring their own region key).
function emptyRegion(): LocalRegion {
  return {
    readIdToIndex: lazyReadIdToIndex({
      readKeys: [],
      readIdPrefix: undefined,
    }),
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
// while skipping the pack — see `syncRegion`. The conditional mirrors the
// uploads' own guard: a region with no coverage bars keeps `emptyRegion`'s
// neutral scaling values rather than a stale peak.
function regionMeta(data: ReadUploadData & CoverageUploadData): LocalRegion {
  const hasCoverage = data.coverageGpuBinCount > 0
  return {
    readIdToIndex: lazyReadIdToIndex(data),
    readPositions: data.readPositions,
    readYs: data.readYs,
    maxDepth: hasCoverage ? data.coverageMaxDepth : 0,
    binSize: hasCoverage ? data.coverageBinSize : 1,
    // No conditional twin of the two above: `computeInterbaseCoverage` already
    // reports 0 for a region with no interbase events, which is the same "keep
    // the neutral scaling value rather than a stale peak" answer.
    interbaseMaxCount: data.interbaseMaxCount,
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
  // The arc stroke width those buffers were packed at. Not a uniform any more:
  // each arc carries its own width, resolved from its read support at pack time
  // (packArcs), so identical arc data at a new configured width is genuinely
  // different bytes. Without this the width setting would appear to do nothing
  // until the next fetch.
  arcLineWidth: number
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
  maxDepth: number
  binSize: number
  interbaseMaxCount: number
}

const OVERLAY_REGION = 999999

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

// A pass over one region's pileup payload. Each `features/*/packGpu.ts` states
// its own narrow input (`GapUploadData`); the wide payload is accepted here
// because a packer of a supertype satisfies a registry of the subtype.
type PileupPass = InstancePass<PileupDataResult>

// Each pileup layer's GPU pass — which is also its upload, because an
// `InstancePass` carries the packer that fills it. The z-order and visibility
// gating live in the shared `PILEUP_LAYERS` list (also driving the Canvas2D
// renderer); this map resolves each layer to the pass that draws it.
//
// It used to be two maps: this one holding a pass ID string and a second
// holding an upload function, both `Record<PileupLayerId, …>`. A layer wired
// into the first and missed in the second compiles, registers, draws — and
// paints nothing, because the pass has no buffer, silently and on the GPU
// backend only. Two maps could disagree; one cannot.
export const GPU_PILEUP_PASS: Record<PileupLayerId, PileupPass> = {
  connLine: CONN_LINE_PASS,
  linkedReadLine: LINKED_READ_LINE_PASS,
  read: READ_PASS,
  overlap: OVERLAP_PASS,
  mod: MODIFICATION_PASS,
  perBaseQual: PER_BASE_QUALITY_PASS,
  skip: SKIP_PASS,
  deletion: DELETION_PASS,
  mismatch: MISMATCH_PASS,
  insertion: INSERTION_PASS,
  clip: CLIP_PASS,
  softclipBases: SOFTCLIP_BASES_PASS,
  perBaseLetter: PER_BASE_LETTER_PASS,
}

// Each coverage-band layer's GPU pass, keyed on the shared `CoverageLayerId` for
// the reason `GPU_PILEUP_PASS` is keyed on `PileupLayerId`: the z-order and the
// gating live in `COVERAGE_LAYERS`, and a layer added there is a compile error
// here until it is wired.
export const GPU_COVERAGE_PASS: Record<CoverageLayerId, PileupPass> = {
  coverage: COVERAGE_PASS,
  snpCov: SNP_COVERAGE_PASS,
  modCov: MOD_COVERAGE_PASS,
  interbase: INTERBASE_PASS,
  indicator: INDICATOR_PASS,
}

// The arc band's passes, in paint order — the interchromosomal ticks FIRST,
// then curves and flat connectors (one of the two is always empty, since read
// cloud draws only flats and arc mode only curves), then the endpoint squares
// that paint on top of the flat connector lines. The line pass runs first in
// both renderers, which is the paint order `hitTestArcBand` resolves ties by.
//
// The ticks used to run last, on the reading that a full-band vertical is the
// strongest statement in the band. On deep short-read data it is the opposite:
// mismapped pairs put a tick at a large share of loci, each one a full-height
// opaque line straight through every arc crossing it, and the arcs are the marks
// carrying insert size and orientation. A translocation is also the one call
// here that a single window cannot support on its own, so it is the claim to
// draw UNDER the evidence rather than over it.
//
// A separate list from the two above because the band packs from a separate RPC
// result plus the configured line width (`ArcsPackData`), not from the pileup
// payload — and it has no per-pass gate: the band as a whole is drawn or not.
const ARC_PASSES: InstancePass<ArcsPackData>[] = [
  ARC_LINE_PASS,
  ARC_PASS,
  ARC_FLAT_PASS,
  ARC_MARKER_PASS,
]

// Everything the HAL compiles, derived from the three registries above plus the
// packer-less overlay pass, so that registering a pass is not a fourth wiring
// point a new layer can be missed from. `drawPass` on an unregistered id draws
// nothing and throws nothing.
export const ALIGNMENTS_PASSES: PipelineDescriptor[] = [
  ...Object.values(GPU_PILEUP_PASS),
  ...Object.values(GPU_COVERAGE_PASS),
  ...ARC_PASSES,
  FLAT_QUAD_PASS,
]

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

export class GpuAlignmentsRenderer
  extends GpuRenderingBackendBase
  implements AlignmentsRenderingBackend
{
  private uData: ArrayBuffer
  private uF32: Float32Array
  private uU32: Uint32Array
  private uI32: Int32Array
  // The arc band's own copy of the UBO. The arc shaders share the struct but
  // place Y against the band rather than the pileup, so a handful of slots
  // differ — and the band draws in the middle of a frame whose other passes
  // need the originals back.
  //
  // A copy rather than a clobber-and-restore of `uData`, which is what this was:
  // that spent two full-buffer memcpys and two HAL writes per section per block
  // (the restoring write consumed by nothing — the next section writes uniforms
  // before anything draws), and it left `uData` holding arc uniforms for the
  // width of the bracket, so any early return or throw inside corrupted every
  // later pass in the frame. Copying forward costs one memcpy, one write, and
  // has no window to get wrong.
  private uArc = new ArrayBuffer(UNIFORMS_SIZE_BYTES)
  private uArcF32 = new Float32Array(this.uArc)
  private regions = new Map<number, LocalRegion>()
  // Upload memo, written only by `sync`. Lives on the renderer rather than in a
  // model-side `createRegionUploadSync` because this backend is whole-map synced
  // (one `sync(sources)` call owns every section), and because the renderer is
  // rebuilt with its HAL on a context loss — so the memo drops exactly when the
  // GPU buffers do, which is the part a hand-rolled model-side memo forgets.
  private uploaded = new Map<number, UploadedRegion>()

  constructor(hal: GpuHal) {
    // The base owns `hal`, the reusable uniform scratch, `dispose`, and the
    // `setErrorHandler` that routes a HAL over-limit allocation to renderError.
    super(hal, UNIFORMS_SIZE_BYTES)
    this.uData = this.uniformData
    this.uF32 = new Float32Array(this.uData)
    this.uU32 = new Uint32Array(this.uData)
    this.uI32 = new Int32Array(this.uData)
  }

  // Copy the frame's UBO into the arc scratch via byte-level memcpy.
  // Float32Array.set on a shared-byte view technically works on spec-compliant
  // engines, but a Uint8Array copy reads as "the same bytes" and avoids any
  // NaN-pattern reinterpretation concerns.
  private copyUboToArcScratch() {
    new Uint8Array(this.uArc).set(new Uint8Array(this.uData))
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
        this.syncRegion(
          idx,
          data,
          section.arcsRpcDataMap.get(regionIdx),
          sources.readConnectionsLineWidth,
        )
      }
      // Each section draws its own arcs. A region with arcs but no pileup (mate
      // off-screen) gets its own pass here; the loop above already handled every
      // region that has both.
      for (const [regionIdx, arcs] of section.arcsRpcDataMap) {
        if (!section.laidOutPileupMap.has(regionIdx)) {
          const idx = sectionRegionKey(s, regionIdx)
          seen.add(idx)
          this.syncRegion(
            idx,
            undefined,
            arcs,
            sources.readConnectionsLineWidth,
          )
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
    arcLineWidth: number,
  ) {
    this.regions.set(idx, data ? regionMeta(data) : emptyRegion())
    const prev = this.uploaded.get(idx)
    this.uploaded.set(idx, {
      layout: data?.readYs,
      tagColors: data?.readTagColors,
      colorCategories: data?.readColorCategories,
      arcs,
      arcLineWidth,
    })

    if (
      prev &&
      prev.layout === data?.readYs &&
      prev.arcs === arcs &&
      prev.arcLineWidth === arcLineWidth
    ) {
      this.hal.retainRegion(idx)
      if (
        data &&
        (prev.tagColors !== data.readTagColors ||
          prev.colorCategories !== data.readColorCategories)
      ) {
        uploadPass(this.hal, idx, GPU_PILEUP_PASS.read, data)
      }
      return
    }

    if (data) {
      // Every pileup layer and every coverage-band pass, by construction — the
      // registries are exhaustive over their key sets and the pass carries its
      // own packer. Uploads are unconditional: a layer's `enabled` gate belongs
      // to the DRAW (see COVERAGE_LAYERS).
      for (const pass of Object.values(GPU_PILEUP_PASS)) {
        uploadPass(this.hal, idx, pass, data)
      }
      for (const pass of Object.values(GPU_COVERAGE_PASS)) {
        uploadPass(this.hal, idx, pass, data)
      }
    }
    // The arc band packs from its own input — a separate RPC result, absent
    // whenever the band is off, plus the configured line width.
    if (arcs) {
      for (const pass of ARC_PASSES) {
        uploadPass(this.hal, idx, pass, { arcs, baseWidth: arcLineWidth })
      }
    }
  }

  // The colour half of the UBO, which is frame-constant: every input is
  // display-wide (`sectionRenderState` overrides two Y offsets and nothing
  // else), so this is ~60 slot writes that produce identical bytes for every
  // block and every section. It ran inside that loop — up to 120 times a frame
  // at MAX_GROUPS, and again on every frame of a pan.
  //
  // Hoisting works because the CPU-side `uData` persists between `writeUniforms`
  // calls and the arc band no longer clobbers it. The palette slots and the
  // per-frame ones are disjoint by construction: each is one field of the
  // generated struct, at one offset, in one of the three views.
  private writePalette(state: RenderState) {
    writePaletteToUbo(this.uU32, this.uF32, state.colors)
    // Overwrite the five base slots `writePaletteToUbo` just filled from the raw
    // palette with the resolved ones — unconditional, because
    // `effectiveBaseColors` is where the modifications-mode mute is decided for
    // both backends. Written here rather than inside `writePaletteToUbo`
    // because that takes a `ColorPalette` and the mute needs `RenderState`.
    const base = effectiveBaseColors(state)
    this.uU32[UU.colorBaseA] = packRgb(base.A)
    this.uU32[UU.colorBaseC] = packRgb(base.C)
    this.uU32[UU.colorBaseG] = packRgb(base.G)
    this.uU32[UU.colorBaseT] = packRgb(base.T)
    this.uU32[UU.colorBaseN] = packRgb(base.N)
  }

  private writeUniforms(state: RenderState, frame: BlockFrame) {
    fillFrameUniforms(this.uF32, this.uI32, state, frame)
    this.hal.writeUniforms(this.uData)
  }

  renderBlocks(blocks: RenderBlock[], state: RenderState) {
    const { canvasWidth, canvasHeight } = state
    const dpr = getDpr()
    const bufH = Math.round(canvasHeight * dpr)
    this.hal.resize(canvasWidth, canvasHeight)
    this.hal.beginFrame(0, 0, 0, 0)

    // Once, ahead of the loop. Nothing below rewrites these slots.
    this.writePalette(state)

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
      for (const layer of COVERAGE_LAYERS) {
        if (layer.enabled(state)) {
          this.hal.drawPass(GPU_COVERAGE_PASS[layer.id].id, regionKey)
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
          this.hal.drawPass(GPU_PILEUP_PASS[layer.id].id, regionKey)
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
      // The frame's uniforms, then the band's differences on top, in a buffer of
      // this pass's own — so `uData` still holds what every other pass needs and
      // an early return here can't strand the frame in arc uniforms.
      this.copyUboToArcScratch()
      fillArcUniforms(this.uArcF32, {
        block,
        state,
        scissorX: geom.scissorX,
        scissorW: geom.scissorW,
        arcBandH: band.height,
        dpr,
        // Up mode anchors at the band bottom (band.top + full height); down
        // mode anchors at the band top — `arcAnchorY`, the same rule the
        // Canvas2D placement and the insert-size ruler take their anchor from.
        arcAnchorPx: arcAnchorY(band.top, band.height, band.down),
      })
      this.hal.writeUniforms(this.uArc)

      this.hal.setViewport(geom.vpX, 0, geom.vpW, bufH)
      this.hal.setScissor(geom.vpX, scissor.top, geom.vpW, scissor.height)
      // In ARC_PASSES order, which is the paint order and says why.
      for (const pass of ARC_PASSES) {
        this.hal.drawPass(pass.id, regionKey)
      }
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

  override dispose() {
    for (const key of this.regions.keys()) {
      this.hal.deleteRegion(key)
    }
    this.regions.clear()
    this.uploaded.clear()
    super.dispose()
  }
}
