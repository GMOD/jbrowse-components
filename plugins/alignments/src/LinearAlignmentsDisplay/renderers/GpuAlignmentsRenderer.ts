import { normalizedRgbToABGR } from '@jbrowse/core/util/colorBits'
import { clipBlock } from '@jbrowse/render-core/blockClipUtils'
import { devicePxBand, getDpr } from '@jbrowse/render-core/canvas2dUtils'
import {
  COVERAGE_BAND_UNIFORMS_SIZE_BYTES,
  COVERAGE_BAR_PASS,
} from '@jbrowse/render-core/coverageBand'
import { uploadPass } from '@jbrowse/render-core/instancePass'
import { drawMarks, uploadMarks } from '@jbrowse/render-core/marks/backend'
import { GpuRenderingBackendBase } from '@jbrowse/render-core/renderingBackendBase'
import { slangPass } from '@jbrowse/render-core/slangPass'

import { emptyArcsUploadData } from '../../features/arcs/types.ts'
import { CLIP_PASS } from '../../features/clip/packGpu.ts'
import { CONN_LINE_PASS } from '../../features/connectingLines/packGpu.ts'
import { DELETION_PASS, SKIP_PASS } from '../../features/gap/packGpu.ts'
import { INSERTION_PASS } from '../../features/insertion/packGpu.ts'
import { LINKED_READ_LINE_PASS } from '../../features/linkedReads/packGpu.ts'
import { effectiveBaseColors } from '../../features/mismatch/baseColors.ts'
import { MISMATCH_PASS } from '../../features/mismatch/packGpu.ts'
import { MODIFICATION_PASS } from '../../features/modification/packGpu.ts'
import { OVERLAP_PASS } from '../../features/overlap/packGpu.ts'
import { PER_BASE_LETTER_PASS } from '../../features/perBaseLetter/packGpu.ts'
import { PER_BASE_QUALITY_PASS } from '../../features/perBaseQuality/packGpu.ts'
import { READ_PASS } from '../../features/read/packGpu.ts'
import { SOFTCLIP_BASES_PASS } from '../../features/softclipBases/packGpu.ts'
import { LINKED_READ_SLOT_KEYS } from '../../shaders/palettes.ts'
import * as flatQuadShader from '../../shaders/slang/flatQuad.generated.ts'
import * as readShader from '../../shaders/slang/read.generated.ts'
import { READ_COLOR_CATEGORY, readCategoryPaletteKeys } from '../colorUtils.ts'
import {
  getSelectionBounds,
  toClipRect,
} from '../components/chainOverlayUtils.ts'
import { ARC_BAND_UNIFORMS_SIZE_BYTES } from './arcBandUniforms.ts'
import { ARC_BAND_MARKS } from './arcMarks.ts'
import {
  ALIGNMENTS_COVERAGE_MARKS,
  type AlignmentsCoverageRegion,
} from './coverageMarks.ts'
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
import type { CoverageRegionFields } from '../../features/coverage/types.ts'
import type { ReadColorCategory } from '../colorUtils.ts'
import type { ChainBoundsRegion } from '../components/chainOverlayUtils.ts'
import type { PileupLayerId } from './pileupLayers.ts'
import type {
  AlignmentsRenderingBackend,
  AlignmentsSources,
  ArcBand,
  ColorPalette,
  RGBColor,
  RenderBlock,
  RenderState,
} from './rendererTypes.ts'
import type { BlockClipResult } from '@jbrowse/render-core/blockClipUtils'
import type { GpuHal, PipelineDescriptor } from '@jbrowse/render-core/hal'
import type { InstancePass } from '@jbrowse/render-core/instancePass'
import type { StagedUniforms } from '@jbrowse/render-core/marks'

// Shader strides — every pileup pass shares the same Uniforms struct (see
// shaders/slang/alignmentsUniforms.slang) so we use any module's offsets.
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
  // Set on every frame, not just the arc passes: a zero here would divide by
  // zero in strokeCoverage for anything else that antialiases a stroke.
  f[U.devicePixelRatio] = getDpr()
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
  // The coverage band's own slots are NOT here: its marks write render-core's
  // `CoverageBandUniforms` into their own buffer before each of their passes.
  i[UI.filterMismatchesByFrequency] = state.filterMismatchesByFrequency ? 1 : 0
  i[UI.mismatchAlpha] = state.mismatchAlpha ? 1 : 0
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
// floats per slot, through the generated setter: std140 pads an array element to
// 16 bytes whatever it holds, so one packed colour per element would occupy the
// same space. Four to a `uint4` element would not, and compiles — measured and
// declined, see colorPack.slang.
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
  // the two lengths equal. `LINKED_READ_SLOT_KEYS` is the slot table's own
  // resolution through `swatchPaletteKeys`, which is what
  // `buildLinkedReadColorPalette` (the Canvas2D, SVG and overlay path) also
  // reads — so this writes the same colours without materializing the array
  // that function returns. Resolved against `c`, the themed palette: these used
  // to be module constants, which is how a dark-mode pileup ended up with
  // dimmed reads under undimmed arcs. The arc palette is the arc band's, and
  // travels in `ArcBandUniforms`.
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

// Pure LocalRegion constructor — the shape a region with no pileup feed gets
// (arcs whose mate is off-screen bring their own region key).
function emptyRegion(): RegionMeta {
  return {
    readIdToIndex: lazyReadIdToIndex({
      readKeys: [],
      readIdPrefix: undefined,
    }),
    readPositions: new Uint32Array(0),
    readYs: new Uint16Array(0),
    coveragePackedBuffer: EMPTY_BUFFER,
    coverageMaxDepth: 0,
    coverageBinSize: 1,
    snpPackedBuffer: EMPTY_BUFFER,
    modCovPackedBuffer: EMPTY_BUFFER,
    interbasePackedBuffer: EMPTY_BUFFER,
    interbaseMaxCount: 0,
    indicatorPackedBuffer: EMPTY_BUFFER,
  }
}

const EMPTY_BUFFER = new ArrayBuffer(0)

// Pure: the per-region metadata `renderBlocks` reads each frame, derived from
// the same payload the uploads pack. Deliberately separate from the uploads, so
// a region whose data is unchanged can rebuild this (a handful of field reads)
// while skipping the pack — see `syncRegion`. The conditional mirrors the
// uploads' own guard: a region with no coverage bars keeps `emptyRegion`'s
// neutral scaling values rather than a stale peak.
function regionMeta(data: PileupDataResult): RegionMeta {
  const hasCoverage = data.coverageGpuBinCount > 0
  return {
    readIdToIndex: lazyReadIdToIndex(data),
    readPositions: data.readPositions,
    readYs: data.readYs,
    coveragePackedBuffer: data.coveragePackedBuffer,
    coverageMaxDepth: hasCoverage ? data.coverageMaxDepth : 0,
    coverageBinSize: hasCoverage ? data.coverageBinSize : 1,
    snpPackedBuffer: data.snpPackedBuffer,
    modCovPackedBuffer: data.modCovPackedBuffer,
    interbasePackedBuffer: data.interbasePackedBuffer,
    // No conditional twin of the two above: `computeInterbaseCoverage` already
    // reports 0 for a region with no interbase events, which is the same "keep
    // the neutral scaling value rather than a stale peak" answer.
    interbaseMaxCount: data.interbaseMaxCount,
    indicatorPackedBuffer: data.indicatorPackedBuffer,
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
  // The density tier's packed bins, when this key is a density region rather
  // than a pileup one. Also what tells the two apart in the memo, so a swap
  // either way rebuilds rather than trusting matching `undefined` layouts.
  density: ArrayBuffer | undefined
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
// `getChainBounds` accepts it directly, and the band region so the coverage
// marks' params read the peaks off it; the buffers themselves are references
// the model already holds.
interface RegionMeta extends ChainBoundsRegion, AlignmentsCoverageRegion {}

// What `renderBlocks` reads per region: the pileup metadata plus the band's own
// feed, which the arc marks take as their region the way the coverage marks take
// the pileup payload.
interface LocalRegion extends RegionMeta {
  arcPack: ArcsPackData
}

const OVERLAY_REGION = 999999

// A device-px vertical span: scissor/viewport top + height in backing-store px,
// as `devicePxBand` returns it. Named locally because three method signatures
// below take one.
type DevBand = ReturnType<typeof devicePxBand>

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

// The arc band's four passes, in the paint order `ARC_BAND_MARKS` states — and
// stated there rather than here because each pass's Canvas2D twin and uniform
// write are declared beside it, the way the coverage band's are.
export const ARC_PASSES: InstancePass<ArcsPackData>[] = ARC_BAND_MARKS.map(
  m => m.pass,
)

// The feed an arc pass packs zero instances from, which is how the band's
// buffers are released without a whole-region wipe (see `syncRegion`). Shared
// rather than rebuilt per call: the packers only read it.
const EMPTY_ARCS = emptyArcsUploadData()

// The band feed a region with no arcs draws from: every pass packs zero
// instances off it, and `paintsBlock` never sees a band it should skip that this
// would have drawn.
const EMPTY_ARC_PACK: ArcsPackData = { arcs: EMPTY_ARCS, baseWidth: 0 }

// Everything the HAL compiles, derived from the three registries above plus the
// packer-less overlay pass, so that registering a pass is not a fourth wiring
// point a new layer can be missed from. `drawPass` on an unregistered id draws
// nothing and throws nothing.
export const ALIGNMENTS_PASSES: PipelineDescriptor[] = [
  ...Object.values(GPU_PILEUP_PASS),
  ...ALIGNMENTS_COVERAGE_MARKS.map(m => m.pass),
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
// to `out`. Each edge straddles the rect boundary by 1 CSS px either side,
// matching Canvas2D's strokeRect(lineWidth=2), whose stroke is centered on the
// edge — quads built wholly inside the rect drew the box a pixel smaller and
// half as thick on the GPU. tx/ty are 1 CSS px in clip space. Each quad is
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
    c.sx1 - tx,
    c.syTop + ty,
    c.sx2 + tx,
    c.syTop - ty,
    r,
    g,
    b,
    a,
    c.sx1 - tx,
    c.syBot + ty,
    c.sx2 + tx,
    c.syBot - ty,
    r,
    g,
    b,
    a,
    c.sx1 - tx,
    c.syTop,
    c.sx1 + tx,
    c.syBot,
    r,
    g,
    b,
    a,
    c.sx2 - tx,
    c.syTop,
    c.sx2 + tx,
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
  // The arc band's UBO, its own `ArcBandUniforms` struct rather than a patched
  // copy of this one. It was the copy: a memcpy of the whole pileup block with
  // the band-sensitive slots poked on top, so a slot the poke forgot redrew with
  // the pileup's value and nothing said so.
  private uArc = new ArrayBuffer(ARC_BAND_UNIFORMS_SIZE_BYTES)
  // The coverage band's UBO, likewise its own struct: its five passes are
  // render-core's, shared with the MAF display, and they read
  // `CoverageBandUniforms`. Sized from that struct, so the write covers exactly
  // it — the HAL's ring slot is aligned to the largest struct any pass here
  // declares, which is still this plugin's `Uniforms`.
  private uCoverage = new ArrayBuffer(COVERAGE_BAND_UNIFORMS_SIZE_BYTES)
  private regions = new Map<number, LocalRegion>()
  // Upload memo, written only by `sync`. Lives on the renderer rather than in a
  // model-side `createRegionUploadSync` because this backend is whole-map synced
  // (one `upload('sources', …)` call owns every section), and because the renderer is
  // rebuilt with its HAL on a context loss — so the memo drops exactly when the
  // GPU buffers do, which is the part a hand-rolled model-side memo forgets.
  private uploaded = new Map<number, UploadedRegion>()

  constructor(hal: GpuHal) {
    // The base owns `hal`, the reusable uniform scratch, `dispose`, and the
    // `setErrorHandler` that routes a HAL over-limit allocation to renderError.
    super(hal)
    this.uData = this.uniformData
    this.uF32 = new Float32Array(this.uData)
    this.uU32 = new Uint32Array(this.uData)
    this.uI32 = new Int32Array(this.uData)
  }

  release() {}

  upload(_key: 'sources', sources: AlignmentsSources) {
    // Stale-buffer hygiene is two deleteRegion calls, not a HAL transaction: a
    // key absent this sync is swept in the loop below, and a key whose payload
    // changed is wiped whole at the head of syncRegion's rebuild branch — cost-
    // neutral, since uploadBuffer destroys-and-recreates each pass's buffer
    // anyway. The renderer-side metadata map is rebuilt unconditionally:
    // cleared up front and repopulated only for regions present this sync, so
    // it can never hold a stale entry. Each (section, region) pair is
    // namespaced via sectionRegionKey; section 0 keys equal the raw region
    // index, so the ungrouped path is byte-identical to pre-grouping.
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
    // The density tier's bins go to section 0's keys, and only the depth-bar
    // pass has anything to upload for them.
    for (const [regionIdx, coverage] of sources.densityRegions) {
      const idx = sectionRegionKey(0, regionIdx)
      seen.add(idx)
      this.syncDensityRegion(idx, coverage)
    }
    // Sweep keys that went away — the HAL's buffers, and the memo entry, so a
    // region that later returns with a reference-identical payload re-uploads
    // instead of trusting buffers this sweep destroyed.
    for (const key of this.uploaded.keys()) {
      if (!seen.has(key)) {
        this.hal.deleteRegion(key)
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
   * The gate is whole-region on purpose, and so is the wipe that opens the
   * rebuild branch: a new layout run deletes and rebuilds all of it, which is
   * what preserves "a pass whose data went empty leaves no stale buffer" — a
   * pileup that vanished uploads nothing, so only the wipe releases its
   * buffers.
   *
   * An unchanged `readYs` is what lets the two narrow paths skip that wipe: it
   * means the payload is the *same layout run*, so every array feeding every
   * pileup and coverage pass is the object the GPU already holds, and only what
   * spreads over it can differ. Two things do, and each rewrites its own passes:
   *
   * - the two per-read color arrays the color tier rebakes
   *   (`overlayReadTagColors` / `overlayReadColorCategories`) → the read pass.
   *   Same shape as `syntenyInstanceCache`'s geometry/color split.
   * - the arc feed and its stroke width → `ARC_PASSES`. `arcsByGroup` allocates
   *   fresh maps for every arc-tier setting (`minInterchromSupport` is a live
   *   slider), so without this each tick repacked all eighteen pileup and
   *   coverage passes for a change confined to the band.
   *
   * They can land together, and then both narrow uploads run.
   */
  private syncRegion(
    idx: number,
    data: PileupDataResult | undefined,
    arcs: ArcsUploadData | undefined,
    arcLineWidth: number,
  ) {
    const arcPack = arcs ? { arcs, baseWidth: arcLineWidth } : EMPTY_ARC_PACK
    this.regions.set(idx, {
      ...(data ? regionMeta(data) : emptyRegion()),
      arcPack,
    })
    const prev = this.uploaded.get(idx)
    this.uploaded.set(idx, {
      layout: data?.readYs,
      tagColors: data?.readTagColors,
      colorCategories: data?.readColorCategories,
      arcs,
      density: undefined,
      arcLineWidth,
    })

    const sameLayoutRun =
      prev !== undefined &&
      prev.density === undefined &&
      prev.layout === data?.readYs

    if (sameLayoutRun) {
      if (
        data &&
        (prev.tagColors !== data.readTagColors ||
          prev.colorCategories !== data.readColorCategories)
      ) {
        uploadPass(this.hal, idx, GPU_PILEUP_PASS.read, data)
      }
      if (prev.arcs !== arcs || prev.arcLineWidth !== arcLineWidth) {
        // A band switched off uploads the empty feed rather than skipping the
        // pass: `uploadBuffer` releases the prior buffer before it looks at the
        // count, so a zero-instance upload IS the per-pass delete this path
        // needs in place of the whole-region wipe.
        this.uploadArcPasses(idx, arcs ?? EMPTY_ARCS, arcLineWidth)
      }
    } else {
      this.hal.deleteRegion(idx)
      if (data) {
        // Every pileup layer and every coverage-band mark, by construction — the
        // registry is exhaustive over its key set and each pass carries its own
        // packer. Uploads are unconditional: a layer's gate belongs to the DRAW.
        for (const pass of Object.values(GPU_PILEUP_PASS)) {
          uploadPass(this.hal, idx, pass, data)
        }
        uploadMarks(this.hal, idx, ALIGNMENTS_COVERAGE_MARKS, data)
      }
      // The arc band packs from its own input — a separate RPC result, absent
      // whenever the band is off, plus the configured line width. The wipe above
      // already released its buffers, so nothing is uploaded when it is absent.
      if (arcs) {
        this.uploadArcPasses(idx, arcs, arcLineWidth)
      }
    }
  }

  private uploadArcPasses(
    idx: number,
    arcs: ArcsUploadData,
    arcLineWidth: number,
  ) {
    for (const mark of ARC_BAND_MARKS) {
      uploadPass(this.hal, idx, mark.pass, { arcs, baseWidth: arcLineWidth })
    }
  }

  /**
   * Upload one density-tier region: the depth-bar pass alone, off the buffer
   * the model packed from the density bins. Every other pass is left with no
   * buffer for this key, which is how the arcs-only region above draws no
   * pileup either.
   */
  private syncDensityRegion(idx: number, coverage: CoverageRegionFields) {
    this.regions.set(idx, {
      ...emptyRegion(),
      ...coverage,
      arcPack: EMPTY_ARC_PACK,
    })
    const prev = this.uploaded.get(idx)
    this.uploaded.set(idx, {
      layout: undefined,
      tagColors: undefined,
      colorCategories: undefined,
      arcs: undefined,
      density: coverage.coveragePackedBuffer,
      arcLineWidth: 0,
    })
    if (prev?.density !== coverage.coveragePackedBuffer) {
      this.hal.deleteRegion(idx)
      uploadPass(this.hal, idx, COVERAGE_BAR_PASS, coverage)
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
    // Every rect below is device px, so it is derived from the scale the canvas
    // actually got and never from `getDpr()`: the two agree until the backing
    // store clamps at `MAX_CANVAS_DIM_PX`, and past that a viewport built from
    // the true dpr is taller than the target — WebGPU rejects the pass and the
    // whole track goes blank. The `dpr` UNIFORM stays the true one: it scales
    // stroke widths, which want screen density rather than target extent.
    const scale = this.hal.resize(canvasWidth, canvasHeight)
    const bufH = Math.round(canvasHeight * scale.y)
    this.hal.beginFrame(0, 0, 0, 0)

    // Once, ahead of the loop. Nothing below rewrites these slots.
    this.writePalette(state)

    let hasDrawn = false
    for (const block of blocks) {
      const clip = clipBlock(block, canvasWidth, canvasHeight, scale)
      if (clip) {
        // Each stacked section sets its own vertical offsets and clip bands.
        // Section 0's region key equals the raw region index, so the ungrouped
        // (single-section) case reproduces the prior draw exactly.
        for (let s = 0; s < state.sections.length; s++) {
          if (this.drawSection(block, clip, state, s, scale.y, bufH)) {
            hasDrawn = true
          }
        }
      }
    }

    this.hal.clearScissor()
    this.hal.clearViewport()
    this.hal.endFrame()
    this.hal.deleteRegion(OVERLAY_REGION)
    // No second clearing bracket for the nothing-drawn case: `beginFrame`
    // already cleared the canvas, and a frame with no draws submits that clear.
    return hasDrawn
  }

  // Draw one stacked section of one block. Returns whether the section had data
  // to paint from, so the caller can flip `canvasDrawn`.
  //
  // **The test is the region, not the pixels.** A section whose fetch has landed
  // paints the frame it should paint — including the blank one an empty region
  // deserves — and a display that never paints anything else is finished, not
  // loading. Gating this on a band having non-zero height instead is what left a
  // SyntenyTrack lane in a plain LGV stuck at "Loading" forever on any window its
  // file has no records for: `LGVSyntenyDisplay` turns the coverage band off, so
  // with no reads there is no band of any kind, `canvasDrawn` never flipped and
  // the scrim never came down. Read-cloud had the same bug one band earlier
  // (coverage- and arcs-only sections were the exceptions carved out then); this
  // is that rule taken to its end rather than a third exception.
  private drawSection(
    block: RenderBlock,
    clip: BlockClipResult,
    state: RenderState,
    sectionIdx: number,
    // The canvas's ACTUAL vertical scale, not `getDpr()` — every band offset
    // below is a device-px rect inside `bufH`, and the two part company once
    // the backing store clamps.
    scaleY: number,
    bufH: number,
  ) {
    const sec = state.sections[sectionIdx]!
    const regionKey = sectionRegionKey(sectionIdx, block.displayedRegionIndex)
    const region = this.regions.get(regionKey)
    if (!region) {
      return false
    }

    const clippedBpStart = clip.bpStartHi + clip.bpStartLo
    const frame: BlockFrame = {
      region,
      bpHi: clip.bpStartHi,
      bpLo: clip.bpStartLo,
      clippedBpStart,
      clippedBpEnd: clippedBpStart + clip.clippedLengthBp,
      canvasW: clip.scissorW,
      reversed: block.reversed,
    }
    const sectionState = sectionRenderState(state, sec)
    this.hal.setViewport(clip.pxX, 0, clip.pxW, bufH)

    // The coverage band goes FIRST, and that ordering is load-bearing: the band
    // writes its own uniform struct, so the pileup's write has to be the later
    // one. `hal.writeUniforms` stages one ring slot and every `drawPass` after
    // it reads that slot, which is exactly the handoff the arc band below
    // relies on as well — and, within the band, what lets its five marks share
    // one write per section (`StagedUniforms`).
    const cov = devicePxBand(sec.covClipTop, sec.covClipHeight, scaleY, bufH)
    if (state.coverageHeight > 0 && cov.height > 0) {
      this.hal.setScissor(clip.pxX, cov.top, clip.pxW, cov.height)
      drawMarks(
        this.hal,
        this.uCoverage,
        ALIGNMENTS_COVERAGE_MARKS,
        block,
        clip,
        region,
        sectionState,
        regionKey,
      )
    }

    this.writeUniforms(sectionState, frame)

    // Pileup passes are skipped when the band collapses to zero height
    // (read-cloud draws no stacked pileup); the arc band below is
    // decoupled and still draws.
    const pileup = devicePxBand(
      sec.pileupClipTop,
      sec.pileupClipHeight,
      scaleY,
      bufH,
    )
    if (pileup.height > 0) {
      this.hal.setScissor(clip.pxX, pileup.top, clip.pxW, pileup.height)
      for (const layer of PILEUP_LAYERS) {
        if (layer.enabled(state)) {
          this.hal.drawPass(GPU_PILEUP_PASS[layer.id].id, regionKey)
        }
      }
      this.renderFeatureOverlays(block, sectionState, frame, clip, pileup, bufH)
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
        region,
        regionKey,
        clip,
        sec.arcBand,
        scaleY,
        bufH,
      )
    }

    return true
  }

  private drawArcsPass(
    block: RenderBlock,
    state: RenderState,
    region: LocalRegion,
    regionKey: number,
    clip: BlockClipResult,
    band: ArcBand,
    dpr: number,
    bufH: number,
  ) {
    // Arcs render in the full-canvas viewport and place Y in absolute canvas px,
    // so a grouped section's band can scroll partly off-screen without an
    // out-of-bounds viewport (WebGPU rejects those pre-Chrome-135); the devicePxBand
    // scissor does the real band clip. Ungrouped bands sit on-screen, so the
    // scissored output is byte-identical to the pre-grouping single pass.
    const scissor = devicePxBand(band.top, band.height, dpr, bufH)
    if (scissor.height > 0) {
      this.hal.setViewport(clip.pxX, 0, clip.pxW, bufH)
      this.hal.setScissor(clip.pxX, scissor.top, clip.pxW, scissor.height)
      // In ARC_BAND_MARKS order, which is the paint order and says why. The
      // first mark writes `ArcBandUniforms` into the band's own scratch and the
      // rest draw off it, so `uData` still holds what every other pass needs.
      const arcState = { ...state, arcBand: band, screenWidthPx: clip.scissorW }
      const staged: StagedUniforms = { writer: undefined, params: undefined }
      for (const mark of ARC_BAND_MARKS) {
        mark.drawRegion(
          this.hal,
          this.uArc,
          block,
          clip,
          region.arcPack,
          arcState,
          regionKey,
          staged,
        )
      }
    }
  }

  private renderFeatureOverlays(
    block: RenderBlock,
    state: RenderState,
    frame: BlockFrame,
    clip: BlockClipResult,
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
        clip.scissorW,
        state.canvasHeight,
      )
      this.drawOverlayQuads(
        new Float32Array(quads),
        quads.length / 8,
        clip,
        pileup,
        bufH,
      )
    }
  }

  private drawOverlayQuads(
    quads: Float32Array,
    count: number,
    clip: BlockClipResult,
    pileup: DevBand,
    bufH: number,
  ) {
    this.hal.uploadBuffer(
      OVERLAY_REGION,
      PASS_FLAT_QUAD,
      quads.buffer as ArrayBuffer,
      count,
    )
    this.hal.setViewport(clip.pxX, 0, clip.pxW, bufH)
    this.hal.setScissor(clip.pxX, pileup.top, clip.pxW, pileup.height)
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
