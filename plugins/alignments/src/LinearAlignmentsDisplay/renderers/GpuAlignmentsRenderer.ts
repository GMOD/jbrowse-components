import { coverageLayout } from '@jbrowse/alignments-core'
import { normalizedRgbToABGR } from '@jbrowse/core/util/colorBits'
import { splitPositionWithFrac } from '@jbrowse/render-core/blockClipUtils'
import { getDpr } from '@jbrowse/render-core/canvas2dUtils'
import { slangPass } from '@jbrowse/render-core/slangPass'

import {
  buildReadIdToIndex,
  ensureRegion,
  sectionRegionKey,
  shouldDrawOverlaps,
} from './rendererTypes.ts'
import {
  ARC_LINE_PASS,
  ARC_PASS,
  PASS_ARC,
  PASS_ARC_LINE,
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
import { getChainBounds, toClipRect } from '../components/chainOverlayUtils.ts'
import {
  ARC_HEIGHT_MARGIN,
  arcColorPalette,
  linkedReadColorPalette,
} from '../shaders/palettes.ts'
import * as flatQuadShader from '../shaders/slang/flatQuad.generated.ts'
import * as readShader from '../shaders/slang/read.generated.ts'

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
import type { ChainBoundsRegion } from '../components/chainOverlayUtils.ts'
import type { GpuHal, PassDescriptor } from '@jbrowse/render-core/hal'

// Shader strides — every pass shares the same Uniforms struct (see
// shaders/slang/alignmentsUniforms.slang) so we use any module's
// UNIFORMS_SIZE_BYTES. Keep one shared ArrayBuffer for the UBO.
const UNIFORMS_SIZE_BYTES = readShader.UNIFORMS_SIZE_BYTES
const U = readShader.UNIFORM_OFFSET_F32
const USLOTS = readShader.UNIFORM_SLOT_ARRAYS

// Pass IDs not yet hosted by a feature folder. Per-feature PASS_* constants
// are imported from features/X/packGpu.ts.
const PASS_FLAT_QUAD = 'flatQuad'

// Fill the per-frame UBO slots. Pure — mutates only the given typed-array
// views. Every field here corresponds to a `u.fieldName` in
// alignmentsUniforms.slang; adding a new field means updating both.
function fillFrameUniforms(
  f: Float32Array,
  u: Uint32Array,
  i: Int32Array,
  state: RenderState,
  frame: BlockFrame,
) {
  const { region } = frame
  f[U.bpHi] = frame.bpHi
  f[U.bpLo] = frame.bpLo
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
  i[U.coverageScaleType] = state.coverageIsLog ? 1 : 0
  i[U.filterMismatchesByFrequency] = state.filterMismatchesByFrequency ? 1 : 0
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
  f[U.insertUpper] = region.insertSizeStats?.upper ?? 999999
  f[U.insertLower] = region.insertSizeStats?.lower ?? 0
  i[U.colorScheme] = state.colorScheme
  // Chain layout drives read-coloring (supplementary colors, strand flipping,
  // mate-unmapped coloring, chevrons). The bezier connection overlay is
  // orthogonal and does not switch coloring into chain mode.
  i[U.chainMode] = state.linkedReads === 'normal' ? 1 : 0
  i[U.showStroke] = state.showOutline && state.featureHeight >= 4 ? 1 : 0
  i[U.flipStrandLongRead] = state.flipStrandLongReadChains !== false ? 1 : 0
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

// Arc-pass UBO patch. The arc shader reads the same UBO as the read pass
// but in a different viewport (above/below pileup), so we overwrite the
// viewport-sensitive slots before the draw. Pure — mutates only the views.
interface ArcFrame {
  region: LocalRegion
  block: RenderBlock
  state: RenderState
  scissorX: number
  scissorW: number
  arcViewportH: number
  dpr: number
  covOffset: number
}
function fillArcUniforms(f: Float32Array, u: Uint32Array, a: ArcFrame) {
  const { block, state, scissorX, scissorW, arcViewportH, dpr, covOffset } = a
  const blockW = block.screenEndPx - block.screenStartPx
  const [hi, lo] = splitPositionWithFrac(block.start)
  f[U.covOffset] = covOffset
  f[U.canvasH] = arcViewportH / dpr
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
  f[U.lineWidthPx] = Math.max(state.readConnectionsLineWidth ?? 1, 1.5 / dpr)
  f[U.pairedArcsDown] = state.readConnectionsDown ? 1 : 0
  // Samplot picks its own domain (autoscaled |tlen|); arc mode defaults to
  // the bp-span that fits availH at the current zoom, reproducing the prior
  // `yBp * pxPerBp` math.
  const availH = a.arcViewportH / dpr - ARC_HEIGHT_MARGIN
  const pxPerBp = blockW / (block.end - block.start)
  f[U.pxPerBp] = pxPerBp
  f[U.arcsYDomainBp] =
    state.arcsYDomainBp ?? (pxPerBp > 0 ? availH / pxPerBp : 1)
  // Samplot (read cloud) is the only mode that sets arcsYDomainBp; it maps
  // yBp=|tlen| with a base-2 log scale. Arc mode stays linear.
  f[U.arcsYLog] = state.arcsYDomainBp !== undefined ? 1 : 0
}

// Pack every palette color into the UBO as u32 ABGR. Pure — writes through
// the given u32 view only, no rendering side effects.
function writePaletteToUbo(u: Uint32Array, c: ColorPalette) {
  const pack = (rgb: RGBColor) => normalizedRgbToABGR(rgb[0], rgb[1], rgb[2])
  u[U.colorFwd] = pack(c.colorFwdStrand)
  u[U.colorRev] = pack(c.colorRevStrand)
  u[U.colorNostrand] = pack(c.colorNostrand)
  u[U.colorPairLR] = pack(c.colorPairLR)
  u[U.colorPairRL] = pack(c.colorPairRL)
  u[U.colorPairRR] = pack(c.colorPairRR)
  u[U.colorPairLL] = pack(c.colorPairLL)
  u[U.colorBaseA] = pack(c.colorBaseA)
  u[U.colorBaseC] = pack(c.colorBaseC)
  u[U.colorBaseG] = pack(c.colorBaseG)
  u[U.colorBaseT] = pack(c.colorBaseT)
  u[U.colorBaseN] = pack(c.colorBaseN)
  u[U.colorInsertion] = pack(c.colorInsertion)
  u[U.colorDeletion] = pack(c.colorDeletion)
  u[U.colorSkip] = pack(c.colorSkip)
  u[U.colorSoftclip] = pack(c.colorSoftclip)
  u[U.colorHardclip] = pack(c.colorHardclip)
  u[U.colorCoverage] = pack(c.colorCoverage)
  u[U.colorModFwd] = pack(c.colorModificationFwd)
  u[U.colorModRev] = pack(c.colorModificationRev)
  u[U.colorLongInsert] = pack(c.colorLongInsert)
  u[U.colorShortInsert] = pack(c.colorShortInsert)
  u[U.colorSupplementary] = pack(c.colorSupplementary)
  u[U.colorUnmappedMate] = pack(c.colorUnmappedMate)
  u[U.colorInterchrom] = pack(c.colorInterchrom)
  u[U.colorMutedSnpBase] = pack(c.colorMutedSnpBase)
  for (let i = 0; i < arcColorPalette.length; i++) {
    u[USLOTS.arcColor[i]!] = pack(arcColorPalette[i]!)
  }
  for (let i = 0; i < linkedReadColorPalette.length; i++) {
    u[USLOTS.linkedReadColor[i]!] = pack(linkedReadColorPalette[i]!)
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

// Pure LocalRegion constructor — empty placeholders for typed arrays the
// read/coverage uploads later overwrite.
function emptyRegion(): LocalRegion {
  return {
    readIdToIndex: new Map(),
    readPositions: new Uint32Array(0),
    readYs: new Uint16Array(0),
    maxDepth: 0,
    binSize: 1,
    interbaseMaxCount: 0,
  }
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
  insertSizeStats?: { upper: number; lower: number }
  maxDepth: number
  binSize: number
  interbaseMaxCount: number
}

const OVERLAY_REGION = 999999

// Convert a CSS-px vertical band [top, top+height] to a device-px scissor band,
// clamped to the backing store. Rounding the top and bottom edges separately
// (rather than top + round(height)) keeps the single-section case bit-exact
// with the prior `bufH - round(top*dpr)` math.
function devBand(top: number, height: number, dpr: number, bufH: number) {
  const t = Math.max(0, Math.round(top * dpr))
  const b = Math.min(bufH, Math.round((top + height) * dpr))
  return { top: t, height: Math.max(0, b - t) }
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
    // Bracket every upload in one rebuild transaction: endUpload() destroys any
    // pass buffer not rewritten below, so a pass whose data went empty (and was
    // therefore skipped by its `if (n > 0)` guard) can't leave a stale buffer —
    // no per-region pre-wipe needed, and the guards stay safe by construction.
    this.hal.beginUpload()
    // `active` must union every section's keys plus arcs before the metadata
    // prune: arcs can arrive for a region whose pileup hasn't loaded yet, and
    // pruning by pileup-only would drop the arc region's renderer-side
    // metadata. Each (section, region) pair is namespaced via sectionRegionKey;
    // section 0 keys equal the raw region index, so the ungrouped path is
    // byte-identical to pre-grouping.
    const active: number[] = []
    sources.sections.forEach((section, s) => {
      for (const [regionIdx, data] of section.laidOutPileupMap) {
        const idx = sectionRegionKey(s, regionIdx)
        active.push(idx)
        this.uploadReads(idx, data)
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
        // uploadReads above already populated this.regions[idx], so the
        // connecting-line and linked-read uploads don't need their own
        // ensureRegion call. (The arcs-only loop below does — arcs can arrive
        // for a region with no pileup data.)
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
      // Each section draws its own arcs. A region with arcs but no pileup
      // (mate off-screen) still needs its renderer-side metadata + active slot.
      for (const [regionIdx, data] of section.arcsRpcDataMap) {
        const idx = sectionRegionKey(s, regionIdx)
        if (!section.laidOutPileupMap.has(regionIdx)) {
          active.push(idx)
          ensureRegion(this.regions, idx, emptyRegion)
        }
        uploadArcs(this.hal, idx, data)
      }
    })
    // Sweeps every HAL buffer not rewritten above — stale passes in active
    // regions and every pass of regions that dropped out this sync.
    this.hal.endUpload()
    // Prune the renderer-side metadata map for regions endUpload just cleared.
    const activeSet = new Set(active)
    for (const idx of this.regions.keys()) {
      if (!activeSet.has(idx)) {
        this.regions.delete(idx)
      }
    }
  }

  uploadReads(displayedRegionIndex: number, data: ReadUploadData) {
    const r = emptyRegion()
    r.insertSizeStats = data.insertSizeStats
    r.readPositions = data.readPositions
    r.readYs = data.readYs
    r.readIdToIndex = buildReadIdToIndex(data.readIds, data.readIds.length)
    this.regions.set(displayedRegionIndex, r)
    uploadReadSegments(this.hal, displayedRegionIndex, data)
  }

  uploadCoverage(displayedRegionIndex: number, data: CoverageUploadData) {
    const r = this.regions.get(displayedRegionIndex)
    if (!r) {
      return
    }

    const numCoverageBins = data.coverageDepths.length
    if (numCoverageBins > 0) {
      uploadCoverageBins(
        this.hal,
        displayedRegionIndex,
        data.coveragePackedBuffer,
        numCoverageBins,
      )
      r.maxDepth = data.coverageMaxDepth
      r.binSize = 1
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
    if (data.interbaseCovPositions.length > 0) {
      r.interbaseMaxCount = data.interbaseMaxCount
    }

    uploadIndicators(
      this.hal,
      displayedRegionIndex,
      data.indicatorPackedBuffer,
      data.indicatorPositions.length,
    )
  }

  private writeUniforms(state: RenderState, frame: BlockFrame) {
    fillFrameUniforms(this.uF32, this.uU32, this.uI32, state, frame)
    writePaletteToUbo(this.uU32, state.colors)
    if (state.showModifications) {
      // Canvas equivalent: buildBaseColorTupleMap / buildCigarOpDrawColors in
      // features/mismatch/baseColors.ts — keep in sync when changing this.
      const m = state.colors.colorMutedSnpBase
      const grey = normalizedRgbToABGR(m[0], m[1], m[2])
      this.uU32[U.colorBaseA] = grey
      this.uU32[U.colorBaseC] = grey
      this.uU32[U.colorBaseG] = grey
      this.uU32[U.colorBaseT] = grey
      this.uU32[U.colorBaseN] = grey
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
      const scissorX = Math.max(0, Math.floor(block.screenStartPx))
      const scissorEnd = Math.min(canvasWidth, Math.ceil(block.screenEndPx))
      const scissorW = scissorEnd - scissorX
      if (scissorW <= 0) {
        continue
      }

      const fullBlockWidth = block.screenEndPx - block.screenStartPx
      const bpPerPx =
        fullBlockWidth > 0 ? (block.end - block.start) / fullBlockWidth : 1

      const pxFromEdge = block.reversed
        ? block.screenEndPx - scissorEnd
        : scissorX - block.screenStartPx
      const clippedBpStart = block.start + pxFromEdge * bpPerPx
      const clippedBpEnd = clippedBpStart + scissorW * bpPerPx
      const [bpHi, bpLo] = splitPositionWithFrac(clippedBpStart)

      const vpX = Math.round(scissorX * dpr)
      const vpW = Math.round(scissorW * dpr)

      // Each stacked section sets its own coverage/pileup vertical offsets and
      // clip bands. Section 0's region key equals the raw region index, so the
      // ungrouped (single-section) case reproduces the prior draw exactly.
      for (let s = 0; s < state.sections.length; s++) {
        const sec = state.sections[s]!
        const regionKey = sectionRegionKey(s, block.displayedRegionIndex)
        const region = this.regions.get(regionKey)
        if (!region) {
          continue
        }
        const frame: BlockFrame = {
          region,
          bpHi,
          bpLo,
          clippedBpStart,
          clippedBpEnd,
          canvasW: scissorW,
          reversed: block.reversed,
        }
        const sectionState: RenderState = {
          ...state,
          pileupTopOffset: sec.pileupTopOffset,
          coverageTopOffset: sec.coverageTopOffset,
        }
        this.writeUniforms(sectionState, frame)

        const cov = devBand(sec.covClipTop, sec.covClipHeight, dpr, bufH)
        const pileup = devBand(
          sec.pileupClipTop,
          sec.pileupClipHeight,
          dpr,
          bufH,
        )

        this.hal.setViewport(vpX, 0, vpW, bufH)

        const drewCoverage = state.showCoverage && cov.height > 0
        if (drewCoverage) {
          this.hal.setScissor(vpX, cov.top, vpW, cov.height)
          this.hal.drawPass(PASS_COVERAGE, regionKey)
          this.hal.drawPass(PASS_SNP_COV, regionKey)
          this.hal.drawPass(PASS_MOD_COV, regionKey)
          this.hal.drawPass(PASS_INTERBASE, regionKey)
          this.hal.drawPass(PASS_INDICATOR, regionKey)
        }

        // Pileup passes are skipped when the band collapses to zero height
        // (read-cloud/samplot mode draws no stacked pileup), but the arc band
        // and `hasDrawn` below must NOT be — see the comment on the arc draw.
        if (pileup.height > 0) {
          this.hal.setScissor(vpX, pileup.top, vpW, pileup.height)

          if (state.linkedReads === 'normal') {
            this.hal.drawPass(PASS_CONN_LINE, regionKey)
          }
          if (state.showLinkedReadLines) {
            this.hal.drawPass(PASS_LINKED_READ_LINE, regionKey)
          }
          this.hal.drawPass(PASS_READ, regionKey)
          if (shouldDrawOverlaps(state)) {
            this.hal.drawPass(PASS_OVERLAP, regionKey)
          }

          if (state.showModifications) {
            this.hal.drawPass(PASS_MOD, regionKey)
          }

          if (state.showPerBaseQuality) {
            this.hal.drawPass(PASS_PER_BASE_QUAL, regionKey)
          }

          if (state.showMismatches) {
            this.hal.drawPass(PASS_GAP, regionKey)
            this.hal.drawPass(PASS_MISMATCH, regionKey)
            this.hal.drawPass(PASS_INSERTION, regionKey)
          }

          this.hal.drawPass(PASS_CLIP, regionKey)
          if (state.showSoftClipping) {
            this.hal.drawPass(PASS_SOFTCLIP_BASES, regionKey)
          }

          if (state.showPerBaseLetter) {
            this.hal.drawPass(PASS_PER_BASE_LETTER, regionKey)
          }

          this.renderFeatureOverlays(
            block,
            sectionState,
            frame,
            scissorX,
            scissorW,
            bufH,
            pileup.top,
            pileup.height,
            dpr,
          )
        }

        // Up- and down-mode arcs both draw here, after the pileup, in their own
        // band: the arc band never overlaps the pileup region, so a single pass
        // suffices and up-mode arcs still land in front of the coverage
        // histogram (drawn earlier). The band is decoupled from the pileup, so
        // it must draw even when the pileup band is empty (read-cloud/samplot,
        // where the cloud IS the whole visualization). Each section carries its
        // own (scrolled) band; undefined when arcs are off or this section
        // reserves none.
        if (sec.arcBand) {
          this.drawArcsPass(
            block,
            region,
            sectionState,
            regionKey,
            scissorX,
            scissorW,
            sec.arcBand,
            dpr,
            bufH,
          )
        }

        // The region exists and at least one band issued draws; report a paint
        // so `canvasDrawn` flips (a coverage- or arcs-only section with an empty
        // pileup band still painted real content — gating this on the pileup
        // band left read-cloud stuck on "Loading").
        if (drewCoverage || pileup.height > 0 || sec.arcBand) {
          hasDrawn = true
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

  private drawArcsPass(
    block: RenderBlock,
    region: LocalRegion,
    state: RenderState,
    regionKey: number,
    scissorX: number,
    scissorW: number,
    band: ArcBand,
    dpr: number,
    bufH: number,
  ) {
    // The viewport keeps the band's FULL height (it sets the arc Y-scale), even
    // when a grouped section's band scrolls partly off-screen; the scissor clips
    // to the visible slice. Ungrouped bands sit on-screen, so viewport == scissor
    // and this is byte-identical to the pre-grouping single pass.
    const viewportTop = Math.round(band.top * dpr)
    const viewportH = Math.round(band.height * dpr)
    const scissor = devBand(band.top, band.height, dpr, bufH)
    if (scissor.height <= 0 || viewportH <= 0) {
      return
    }
    this.saveUBO()
    fillArcUniforms(this.uF32, this.uU32, {
      region,
      block,
      state,
      scissorX,
      scissorW,
      arcViewportH: viewportH,
      dpr,
      // Up mode anchors at the band bottom (offset down by its full height);
      // down mode anchors at the top (no offset).
      covOffset: band.down ? 0 : viewportH / dpr,
    })
    this.hal.writeUniforms(this.uData)

    const vpX = Math.round(scissorX * dpr)
    const vpW = Math.round(scissorW * dpr)
    this.hal.setViewport(vpX, viewportTop, vpW, viewportH)
    this.hal.setScissor(vpX, scissor.top, vpW, scissor.height)

    this.hal.drawPass(PASS_ARC, regionKey)
    this.hal.drawPass(PASS_ARC_LINE, regionKey)

    this.restoreUBO()
    this.hal.setViewport(vpX, 0, vpW, bufH)
    this.hal.writeUniforms(this.uData)
  }

  private renderFeatureOverlays(
    block: RenderBlock,
    state: RenderState,
    frame: BlockFrame,
    scissorX: number,
    scissorW: number,
    bufH: number,
    pileupTop: number,
    pileupH: number,
    dpr: number,
  ) {
    const { region, clippedBpStart, clippedBpEnd } = frame
    const bpLen = clippedBpEnd - clippedBpStart
    const regionSelectIdx = state.selectedFeatureId
      ? (region.readIdToIndex.get(state.selectedFeatureId) ?? -1)
      : -1

    // Nothing selected in this block — skip all allocs below.
    if (regionSelectIdx < 0 && state.selectedChainIds.length === 0) {
      return
    }

    // After the guard: if no chains are selected then regionSelectIdx >= 0 (implied).
    const needsFeatureSelection = state.selectedChainIds.length === 0

    const covOff = state.pileupTopOffset
    // Capture per-block transforms so the toClipRect call sites below
    // don't each have to repeat the same 7 uniform-derived args.
    const clipFor = (absStart: number, absEnd: number, y: number) =>
      toClipRect(
        absStart,
        absEnd,
        y,
        state,
        clippedBpStart,
        bpLen,
        covOff,
        state.canvasHeight,
        block.reversed,
      )
    // 2 CSS pixels matches Canvas2D's strokeRect(..., lineWidth=2) so the
    // selection box looks the same when the GPU fallback fires.
    const tx = 2 / scissorW
    const ty = 2 / state.canvasHeight
    // JBrowse brand blue (#00B8FF approx) in normalized linear RGB.
    const [SR, SG, SB, SA] = [0, 0.722, 1, 1]
    // 4 quads forming a 2px-wide selection frame (top + bottom + two sides).
    const pushSelectionFrame = (
      out: number[],
      c: { sx1: number; sx2: number; syTop: number; syBot: number },
    ) => {
      out.push(
        c.sx1,
        c.syTop,
        c.sx2,
        c.syTop - ty,
        SR,
        SG,
        SB,
        SA,
        c.sx1,
        c.syBot + ty,
        c.sx2,
        c.syBot,
        SR,
        SG,
        SB,
        SA,
        c.sx1,
        c.syTop,
        c.sx1 + tx,
        c.syBot,
        SR,
        SG,
        SB,
        SA,
        c.sx2 - tx,
        c.syTop,
        c.sx2,
        c.syBot,
        SR,
        SG,
        SB,
        SA,
      )
    }

    // Selection frames (single read + chain) accumulate into one quad buffer
    // and draw together — the hover highlight moved to the HighlightOverlay div.
    const quads: number[] = []

    if (needsFeatureSelection) {
      const idx = regionSelectIdx
      pushSelectionFrame(
        quads,
        clipFor(
          region.readPositions[idx * 2]!,
          region.readPositions[idx * 2 + 1]!,
          region.readYs[idx]!,
        ),
      )
    }

    if (state.selectedChainIds.length > 0) {
      const bounds = getChainBounds(state.selectedChainIds, region)
      if (bounds) {
        pushSelectionFrame(
          quads,
          clipFor(bounds.startBp, bounds.endBp, bounds.yRow),
        )
      }
    }

    if (quads.length > 0) {
      this.drawOverlayQuads(
        new Float32Array(quads),
        quads.length / 8,
        scissorX,
        scissorW,
        pileupTop,
        pileupH,
        bufH,
        dpr,
      )
    }
  }

  private drawOverlayQuads(
    quads: Float32Array,
    count: number,
    scissorX: number,
    scissorW: number,
    pileupTop: number,
    pileupH: number,
    bufH: number,
    dpr: number,
  ) {
    this.hal.uploadBuffer(
      OVERLAY_REGION,
      PASS_FLAT_QUAD,
      quads.buffer as ArrayBuffer,
      count,
    )
    const vpX = Math.round(scissorX * dpr)
    const vpW = Math.round(scissorW * dpr)
    this.hal.setViewport(vpX, 0, vpW, bufH)
    this.hal.setScissor(vpX, pileupTop, vpW, pileupH)
    this.hal.drawPass(PASS_FLAT_QUAD, OVERLAY_REGION)
  }

  dispose() {
    for (const key of this.regions.keys()) {
      this.hal.deleteRegion(key)
    }
    this.regions.clear()
    this.hal.dispose()
  }
}
