/**
 * What the MAF rows draw over their cells, positioned for the visible
 * regions: the bridge lines, the inversion markers, the base letters, the
 * deletion runs, the summary bars, the CDS frame strip, and the codon layer's
 * switches and letters.
 */
import { computeVisibleCodonGlyphs } from './codons.ts'
import { computeVisibleDeletions } from './components/computeVisibleDeletions.ts'
import { computeVisibleEmptyLines } from './components/computeVisibleEmptyLines.ts'
import { computeVisibleFrames } from './components/computeVisibleFrames.ts'
import {
  computeVisibleInversions,
  consensusStrandByRowRefName,
} from './components/computeVisibleInversions.ts'
import { computeVisibleLabels } from './components/computeVisibleLabels.ts'
import { basePaintsOf } from './rowPlan.ts'

import type {
  MafRegionData,
  MafUploadPayload,
} from '../LinearMafRenderer/mafRenderingBackendTypes.ts'
import type {
  MafFrameRecord,
  MafRegionPayload,
  MafSummaryRecord,
} from '../types.ts'
import type { CodonGlyph } from './codons.ts'
import type { FrameMarker } from './components/computeVisibleFrames.ts'
import type { StrandConsensus } from './components/computeVisibleInversions.ts'
import type {
  MafRowGeometryParams,
  VisibleRegionsView,
} from './components/visibleRegionGeometry.ts'
import type { ConservationUnit } from './conservationUnits.ts'
import type { RowPlan } from './rowPlan.ts'

/** What {@link mafOverlayViews} reads: the view, the row geometry, the plan and both tiers. */
export interface MafOverlayHost {
  view: VisibleRegionsView & { initialized: boolean }
  rowsVisible: boolean
  resizing: boolean
  rowGeometry(): MafRowGeometryParams
  rowPlan: RowPlan
  showInversions: boolean
  rpcDataMap: ReadonlyMap<number, MafRegionData>
  detailOnScreen: ReadonlyMap<number, MafRegionData>
  coarseTier: ReadonlyMap<number, MafRegionPayload<MafSummaryRecord[]>>
  coarseTierActive: boolean
  framesActive: boolean
  framesDataMap: ReadonlyMap<number, MafFrameRecord[]>
  framesAdapterConfig: Record<string, unknown> | undefined
  rowIndexBySrc: Map<string, number>
  defaultCodonSpecies: string | undefined
  conservationBandActive: boolean
  conservationUnit: ConservationUnit
}

/** The overlays over the rows, and whether the codon layer draws. */
export function mafOverlayViews(self: MafOverlayHost) {
  const overlayParams = () => ({
    view: self.view,
    rpcDataMap: self.detailOnScreen,
    ...self.rowGeometry(),
  })
  return {
    /**
     * #getter
     * The orientation each (row, source chromosome) is measured against for
     * the inversion indicator (`consensusStrandByRowRefName`). Memoized because
     * it walks every block and row of every loaded region while its
     * consumer runs on every pan and zoom. Empty when the indicator is off.
     */
    get inversionConsensus(): StrandConsensus {
      return self.showInversions
        ? consensusStrandByRowRefName(self.rpcDataMap)
        : new Map<number, Map<string, number>>()
    },
    /**
     * #getter
     * Positioned bridge-line segments for `e`-line (empty/bridged) rows.
     */
    get visibleEmptyLines() {
      return self.rowsVisible ? computeVisibleEmptyLines(overlayParams()) : []
    },
    /**
     * #getter
     * Positioned strand-flip (inversion) markers for the visible aligned rows.
     * Empty unless the indicator is toggled on.
     */
    get visibleInversions() {
      return self.rowsVisible && self.showInversions
        ? computeVisibleInversions({
            ...overlayParams(),
            consensus: this.inversionConsensus,
          })
        : []
    },
    /**
     * #getter
     * Positioned per-base letters, over the bases only.
     */
    get visibleLabels() {
      return self.rowsVisible && !self.resizing && self.rowPlan.perBase
        ? computeVisibleLabels({
            view: self.view,
            rpcDataMap: self.detailOnScreen,
            ...self.rowGeometry(),
            paints: basePaintsOf(self.rowPlan),
          })
        : []
    },
    /**
     * #getter
     * Positioned deletion runs, labelled with their length where it fits.
     * Only the bases paint the gap cells the count is colored against.
     */
    get visibleDeletions() {
      return self.rowsVisible && self.rowPlan.perBase
        ? computeVisibleDeletions({
            view: self.view,
            rpcDataMap: self.detailOnScreen,
            ...self.rowGeometry(),
          })
        : []
    },
    /**
     * #getter
     * The summary records each region's rows draw as per-species presence
     * bars, keyed by displayedRegionIndex.
     *
     * Drawn on the summary tier and as the stand-in for a region whose
     * detail tier has not landed, so zooming in past the floor does not
     * blank the track. Suppressed per region, since tiers arrive per
     * region; `coarseTierActive` short-circuits it because both maps hold a
     * region side by side.
     */
    get summaryDataMap(): ReadonlyMap<number, MafSummaryRecord[]> {
      const shown = new Map<number, MafSummaryRecord[]>()
      if (self.rowsVisible) {
        for (const [i, entry] of self.coarseTier) {
          if (self.coarseTierActive || !self.rpcDataMap.has(i)) {
            shown.set(i, entry.data)
          }
        }
      }
      return shown
    },
    /**
     * #getter
     * Positioned per-species CDS frame boxes for the frames strip. Empty
     * unless a frames adapter is configured and the strip is on. Reuses the `src`-to-row mapping of the summary bars.
     */
    get visibleFrames(): FrameMarker[] {
      return self.rowsVisible && self.framesActive
        ? computeVisibleFrames({
            view: self.view,
            framesDataMap: self.framesDataMap,
            rowIndexBySrc: self.rowIndexBySrc,
            ...self.rowGeometry(),
          })
        : []
    },
    /**
     * #getter
     * Some CDS frame box is on screen: what the legend asks of
     * `visibleFrames`, whose boxes move every pan frame, so a pan along
     * the strip rebuilds no key.
     */
    get framesOnScreen() {
      return this.visibleFrames.length > 0
    },
    /**
     * #getter
     * The rows area paints the codon overlay.
     */
    get codonCellsActive() {
      return (
        self.rowsVisible &&
        self.rowPlan.bases === 'codon' &&
        !!self.defaultCodonSpecies
      )
    },
    /**
     * #getter
     * The conservation band is in per-codon (amino-acid identity) mode, with
     * frames to define codons and per-base blocks to translate — the cheap
     * summary path ships neither.
     */
    get codonConservationActive() {
      return (
        self.view.initialized &&
        self.conservationBandActive &&
        self.conservationUnit === 'codon' &&
        !!self.framesAdapterConfig &&
        !!self.defaultCodonSpecies
      )
    },
  }
}

/** What {@link mafCodonGlyphViews} reads: the codons each region's cells were encoded from. */
export interface MafCodonGlyphHost {
  view: VisibleRegionsView
  rowGeometry(): MafRowGeometryParams
  codonCellsActive: boolean
  encodedUpload: ReadonlyMap<number, MafUploadPayload>
}

/** The amino-acid letters the codon layer draws. */
export function mafCodonGlyphViews(self: MafCodonGlyphHost) {
  return {
    /**
     * #getter
     * The amino-acid letters over the codon view's cells.
     */
    get visibleCodonGlyphs(): CodonGlyph[] {
      return self.codonCellsActive
        ? computeVisibleCodonGlyphs(
            self.view,
            {
              get: (i: number) => self.encodedUpload.get(i)?.codons,
            },
            self.rowGeometry(),
          )
        : []
    },
  }
}
