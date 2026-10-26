import { clipBlock } from '@jbrowse/render-core/blockClipUtils'
import { devicePxBand } from '@jbrowse/render-core/canvas2dUtils'
import { uploadPass } from '@jbrowse/render-core/instancePass'
import { planMarks } from '@jbrowse/render-core/marks'
import {
  MarkTextureBinder,
  drawMarks,
  drawPlannedPasses,
  uploadMarks,
} from '@jbrowse/render-core/marks/backend'
import { canvasWideBlock } from '@jbrowse/render-core/renderBlock'
import { GpuRenderingBackendBase } from '@jbrowse/render-core/renderingBackendBase'

import { EMPTY_ARC_BAND_FEED } from '../../features/arcs/bandFeed.ts'
import { LINKED_READ_LINE_MARK } from '../../features/linkedReads/mark.ts'
import { READ_MARK } from '../../features/read/mark.ts'
import { EMPTY_SASHIMI_BAND_FEED } from '../../features/sashimi/bandFeed.ts'
import { ARC_BAND_MARKS } from './arcMarks.ts'
import { forEachBandPass } from './bandPasses.ts'
import { CONNECTOR_MARK, EMPTY_CONNECTOR_FEED } from './connectorMarks.ts'
import {
  ALIGNMENTS_COVERAGE_MARKS,
  type AlignmentsCoverageRegion,
  coverageRegionOf,
  emptyCoverageRegion,
} from './coverageMarks.ts'
import { PILEUP_MARKS } from './pileupMarks.ts'
import {
  PILEUP_UNIFORMS_SIZE_BYTES,
  pileupUniformViews,
  writePileupFrame,
  writePileupPalette,
} from './pileupUniforms.ts'
import { sectionRegionKey, sectionRenderState } from './rendererTypes.ts'
import { SASHIMI_MARKS } from './sashimiMarks.ts'

import type { PileupDataResult } from '../../RenderAlignmentDataRPC/types.ts'
import type { ArcBandFeed } from '../../features/arcs/bandFeed.ts'
import type { ConnectorFeed } from '../../features/linkedReads/connectorFeed.ts'
import type { SashimiBandFeed } from '../../features/sashimi/bandFeed.ts'
import type { PileupUniformViews } from './pileupUniforms.ts'
import type {
  AlignmentsRenderingBackend,
  AlignmentsSources,
  RenderBlock,
  RenderState,
  SectionSource,
} from './rendererTypes.ts'
import type { BlockClipResult } from '@jbrowse/render-core/blockClipUtils'
import type { CanvasScale } from '@jbrowse/render-core/canvas2dUtils'
import type { GpuHal, PipelineDescriptor } from '@jbrowse/render-core/hal'
import type { MarkPlan } from '@jbrowse/render-core/marks'

export { PALETTE_UNIFORM_FIELDS } from './pileupUniforms.ts'

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
  // The two per-read arrays the color tier rebakes (`overlayReadFillColors` /
  // `overlayReadColorCategories`). Only the read pass carries them.
  fillColors: Uint32Array | undefined
  colorCategories: Uint8Array | undefined
  // The straight-line pass's records, which spread over the laid-out data
  // after the color bake (`attachLinkedReadLinesByGroup`), so a
  // curved-connector toggle changes them within one layout run.
  lines: Uint32Array | undefined
  arcs: ArcBandFeed | undefined
  sashimi: SashimiBandFeed | undefined
  connectors: ConnectorFeed | undefined
}

// Everything the HAL compiles, derived from the four mark lists, so that
// registering a pass is not a fourth wiring point a new mark can be missed
// from. `drawPass` on an unregistered id draws nothing and throws nothing.
export const ALIGNMENTS_PASSES: PipelineDescriptor[] = [
  ...PILEUP_MARKS.map(m => m.pass),
  ...ALIGNMENTS_COVERAGE_MARKS.map(m => m.pass),
  ...ARC_BAND_MARKS.map(m => m.pass),
  ...SASHIMI_MARKS.map(m => m.pass),
  CONNECTOR_MARK.pass,
]

export class GpuAlignmentsRenderer
  extends GpuRenderingBackendBase
  implements AlignmentsRenderingBackend
{
  private uData: ArrayBuffer
  private uViews: PileupUniformViews
  private uBand: ArrayBuffer
  // The coverage band's scratch: its layers are render-core's, shared with
  // the MAF display, and write `CoverageBandUniforms` or, for the indicator
  // triangles, the point shader's larger struct, so it is sized as `uBand` is.
  private uCoverage: ArrayBuffer
  private regions = new Map<number, AlignmentsCoverageRegion>()
  // Upload memo, written only by `upload`. Lives on the renderer rather than in a
  // model-side `createRegionUploadSync` because this backend is whole-map synced
  // (one `upload('sources', …)` call owns every section), and because the renderer is
  // rebuilt with its HAL on a context loss — so the memo drops exactly when the
  // GPU buffers do, which is the part a hand-rolled model-side memo forgets.
  private uploaded = new Map<number, UploadedRegion>()
  private sections: readonly SectionSource[] = []
  private textures: MarkTextureBinder

  constructor(hal: GpuHal) {
    // The base owns `hal`, `dispose`, and the `setErrorHandler` that routes a
    // HAL over-limit allocation to renderError.
    super(hal)
    this.uData = new ArrayBuffer(PILEUP_UNIFORMS_SIZE_BYTES)
    this.uViews = pileupUniformViews(this.uData)
    this.uBand = new ArrayBuffer(hal.uniformByteSize)
    this.uCoverage = new ArrayBuffer(hal.uniformByteSize)
    this.textures = new MarkTextureBinder(hal)
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
    this.sections = sources.sections
    const seen = new Set<number>()
    sources.sections.forEach((section, s) => {
      const { laidOutPileupMap, arcFeeds, sashimiFeeds, connectorFeeds } =
        section
      // A region with connections or junctions and no pileup (a far foot's
      // region) gets its own key.
      for (const regionIdx of new Set([
        ...laidOutPileupMap.keys(),
        ...arcFeeds.keys(),
        ...sashimiFeeds.keys(),
        ...connectorFeeds.keys(),
      ])) {
        const idx = sectionRegionKey(s, regionIdx)
        seen.add(idx)
        this.syncRegion(
          idx,
          laidOutPileupMap.get(regionIdx),
          arcFeeds.get(regionIdx),
          sashimiFeeds.get(regionIdx),
          connectorFeeds.get(regionIdx),
        )
      }
    })
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
   *   (`overlayReadFillColors` / `overlayReadColorCategories`) → the read pass.
   *   Same shape as `syntenyInstanceCache`'s geometry/color split.
   * - the band's feed → `ARC_BAND_MARKS`' passes. The feeds are rebuilt for every
   *   arc-tier setting (`minInterchromSupport` is a live slider), so without
   *   this each tick repacked all eighteen pileup and coverage passes for a
   *   change confined to the band.
   *
   * They can land together, and then both narrow uploads run.
   */
  private syncRegion(
    idx: number,
    data: PileupDataResult | undefined,
    arcs: ArcBandFeed | undefined,
    sashimi: SashimiBandFeed | undefined,
    connectors: ConnectorFeed | undefined,
  ) {
    this.regions.set(idx, data ? coverageRegionOf(data) : emptyCoverageRegion())
    const prev = this.uploaded.get(idx)
    this.uploaded.set(idx, {
      layout: data?.readYs,
      fillColors: data?.readFillColors,
      colorCategories: data?.readColorCategories,
      lines: data?.linkedReadLinePositions,
      arcs,
      sashimi,
      connectors,
    })

    const sameLayoutRun = prev !== undefined && prev.layout === data?.readYs

    if (sameLayoutRun) {
      if (
        data &&
        (prev.fillColors !== data.readFillColors ||
          prev.colorCategories !== data.readColorCategories)
      ) {
        uploadPass(this.hal, idx, READ_MARK.pass, data)
      }
      if (data && prev.lines !== data.linkedReadLinePositions) {
        uploadPass(this.hal, idx, LINKED_READ_LINE_MARK.pass, data)
      }
      if (prev.arcs !== arcs) {
        // An empty feed rather than a skip: a zero-instance upload IS the
        // per-pass delete this path needs in place of the whole-region wipe.
        uploadMarks(this.hal, idx, ARC_BAND_MARKS, arcs ?? EMPTY_ARC_BAND_FEED)
      }
      if (prev.sashimi !== sashimi) {
        uploadMarks(
          this.hal,
          idx,
          SASHIMI_MARKS,
          sashimi ?? EMPTY_SASHIMI_BAND_FEED,
        )
      }
      if (prev.connectors !== connectors) {
        uploadMarks(
          this.hal,
          idx,
          [CONNECTOR_MARK],
          connectors ?? EMPTY_CONNECTOR_FEED,
        )
      }
    } else {
      this.hal.deleteRegion(idx)
      if (data) {
        // Every pileup mark and every coverage-band mark. Uploads are
        // unconditional: a mark's gate belongs to the DRAW.
        uploadMarks(this.hal, idx, PILEUP_MARKS, data)
        uploadMarks(this.hal, idx, ALIGNMENTS_COVERAGE_MARKS, data)
      }
      if (arcs) {
        uploadMarks(this.hal, idx, ARC_BAND_MARKS, arcs)
      }
      if (sashimi) {
        uploadMarks(this.hal, idx, SASHIMI_MARKS, sashimi)
      }
      if (connectors) {
        uploadMarks(this.hal, idx, [CONNECTOR_MARK], connectors)
      }
    }
  }

  // The color half of the UBO is frame-constant — every input is display-wide
  // (`sectionRenderState` overrides two Y offsets and nothing else) — so it is
  // written once ahead of the block loop rather than up to 120 times a frame
  // at MAX_GROUPS. The palette slots and the per-section ones are disjoint by
  // construction, each one field of the generated struct; `uData` persists
  // between the writes and the arc band writes its own struct.
  private writeUniforms(
    state: RenderState,
    clip: BlockClipResult,
    block: RenderBlock,
  ) {
    writePileupFrame(this.uViews, clip, block, state)
    this.hal.writeUniforms(this.uData)
  }

  renderBlocks(blocks: RenderBlock[], state: RenderState) {
    const { canvasWidth, canvasHeight } = state
    // Every rect below is device px, so it derives from the scale the canvas
    // actually got, never from `getDpr()`: a capped backing store or a
    // browser-shrunk WebGL drawing buffer falls below it, and a viewport built
    // from the true dpr then overruns the target. The `dpr` UNIFORM stays the
    // true one: it scales stroke widths, which want screen density.
    const scale = this.hal.resize(canvasWidth, canvasHeight)
    const bufH = Math.round(canvasHeight * scale.y)
    this.hal.beginFrame(0, 0, 0, 0)

    // Once, ahead of the loop. Nothing below rewrites these slots.
    writePileupPalette(this.uViews, state)
    // Which pileup marks draw this frame, asked once: the gates read the
    // display-wide state, and per section block the walk is the plan's
    // `drawPass` list against the section's own write.
    const pileup = planMarks(PILEUP_MARKS, state)

    let hasDrawn = false
    for (const block of blocks) {
      const clip = clipBlock(block, canvasWidth, canvasHeight, scale)
      if (clip) {
        // Each stacked section sets its own vertical offsets and clip bands.
        // Section 0's region key equals the raw region index, so the ungrouped
        // (single-section) case reproduces the prior draw exactly.
        for (let s = 0; s < state.sections.length; s++) {
          if (this.drawSection(block, clip, state, pileup, s, scale.y, bufH)) {
            hasDrawn = true
          }
        }
      }
    }

    this.drawBands(blocks, state, scale, bufH)

    this.hal.clearScissor()
    this.hal.clearViewport()
    this.hal.endFrame()
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
    pileup: MarkPlan<PileupDataResult, RenderState>,
    sectionIdx: number,
    // The canvas's ACTUAL vertical scale, not `getDpr()`: every band offset
    // below is a device-px rect inside `bufH`.
    scaleY: number,
    bufH: number,
  ) {
    const sec = state.sections[sectionIdx]!
    const regionKey = sectionRegionKey(sectionIdx, block.displayedRegionIndex)
    const region = this.regions.get(regionKey)
    if (!region) {
      return false
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
    if (state.coverage.height > 0 && cov.height > 0) {
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
        this.textures,
      )
    }

    this.writeUniforms(sectionState, clip, block)

    // Pileup passes are skipped when the band collapses to zero height
    // (read-cloud draws no stacked pileup); the arc band below is
    // decoupled and still draws.
    const band = devicePxBand(
      sec.pileupClipTop,
      sec.pileupClipHeight,
      scaleY,
      bufH,
    )
    if (band.height > 0) {
      this.hal.setScissor(clip.pxX, band.top, clip.pxW, band.height)
      drawPlannedPasses(this.hal, pileup, regionKey)
    }

    return true
  }

  // The bands over the blocks, in `forEachBandPass`' order, which the Canvas2D
  // painter draws too, each scissored to its strip.
  private drawBands(
    blocks: RenderBlock[],
    state: RenderState,
    scale: CanvasScale,
    bufH: number,
  ) {
    const { hal, uBand, textures } = this
    const { canvasWidth, canvasHeight } = state
    forEachBandPass(this.sections, state, {
      visit(pass) {
        const strip = devicePxBand(pass.top, pass.height, scale.y, bufH)
        if (strip.height <= 0) {
          return
        }
        for (const mark of pass.spanning) {
          for (const [regionIdx, feed] of pass.feeds) {
            const block = canvasWideBlock(regionIdx, canvasWidth)
            const clip = clipBlock(block, canvasWidth, canvasHeight, scale)
            if (clip) {
              hal.setScissor(clip.pxX, strip.top, clip.pxW, strip.height)
              drawMarks(
                hal,
                uBand,
                [mark],
                block,
                clip,
                feed,
                pass.state,
                sectionRegionKey(pass.section, regionIdx),
                textures,
              )
            }
          }
        }
        const { perBlock } = pass
        if (perBlock) {
          for (const block of blocks) {
            const feed = pass.feeds.get(block.displayedRegionIndex)
            const clip = clipBlock(block, canvasWidth, canvasHeight, scale)
            if (feed && clip) {
              const key = sectionRegionKey(
                pass.section,
                block.displayedRegionIndex,
              )
              hal.setScissor(clip.pxX, strip.top, clip.pxW, strip.height)
              const wide = canvasWideBlock(
                block.displayedRegionIndex,
                canvasWidth,
              )
              const wideClip = clipBlock(wide, canvasWidth, canvasHeight, scale)
              if (wideClip) {
                drawMarks(
                  hal,
                  uBand,
                  perBlock.wide,
                  wide,
                  wideClip,
                  feed,
                  pass.state,
                  key,
                  textures,
                )
              }
              drawMarks(
                hal,
                uBand,
                perBlock.own,
                block,
                clip,
                feed,
                pass.state,
                key,
                textures,
              )
            }
          }
        }
      },
    })
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
