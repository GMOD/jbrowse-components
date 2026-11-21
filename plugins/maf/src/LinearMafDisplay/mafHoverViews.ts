/**
 * What the pointer reads off the MAF rows and the conservation band: a row's
 * base, insertion, deletion or bridged span, the identity window, the CDS
 * frame, the codon, the conservation bar and the summary record. The coverage
 * band's own hovers are `mafCoverageHoverViews`.
 */
import { drawnRowHeightPx } from '@jbrowse/render-core/shaders/rowRect'

import { identityOver } from '../LinearMafRenderer/identity.ts'
import { findCodonAt } from './codons.ts'
import { findFrameAt } from './components/computeVisibleFrames.ts'
import { conservationBarAt } from './components/conservationBand.ts'
import { findRowHoverAtBp } from './components/findRowHover.ts'
import { summaryAt } from './components/summarySpans.ts'

import type {
  MafGPURenderState,
  MafRegionData,
  MafUploadPayload,
} from '../LinearMafRenderer/mafRenderingBackendTypes.ts'
import type { MafFrameRecord, MafRow } from '../types.ts'
import type { HoverBp } from './components/findRowHover.ts'
import type { RowPlan } from './rowPlan.ts'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'

/** What {@link mafHoverViews} reads: the rows, the plan, both tiers and what was encoded. */
export interface MafHoverHost {
  drawnRows: MafRow[]
  detailOnScreen: ReadonlyMap<number, MafRegionData>
  framesInUse: boolean
  framesDataMap: ReadonlyMap<number, MafFrameRecord[]>
  rowIndexBySrc: Map<string, number>
  rowPlan: RowPlan
  encodeBinBp: number
  effectiveRowHeight: number
  rowProportion: number
  encodedUpload: ReadonlyMap<number, MafUploadPayload>
  codonConservationActive: boolean
  renderBlocks: RenderBlock[]
  renderState: MafGPURenderState
}

/** The hovers over the rows and the conservation band. */
export function mafHoverViews(self: MafHoverHost) {
  return {
    /**
     * #method
     * The CDS frame record covering absolute genomic `bp` (uint32) on
     * display `rowIndex`, or undefined. Gated on `framesInUse`, so the gene
     * name reads on hover in codon view with the strip off.
     *
     * `bp` is a base index (`MafPointer.baseBp`), not a floored `gposFrac`,
     * matching the row hover and coverage tooltip on a reversed region.
     */
    frameHoverInfo(displayedRegionIndex: number, bp: number, rowIndex: number) {
      if (!self.framesInUse) {
        return undefined
      }
      const hit = findFrameAt(
        self.framesDataMap.get(displayedRegionIndex),
        bp,
        rowIndex,
        self.rowIndexBySrc,
      )
      return hit ? { name: hit.name } : undefined
    },
    /**
     * #method
     * The hover on `rowIndex` at the cursor's genomic position: an aligned
     * base, an insertion, a deletion or a bridged region, tagged with the
     * sample label. `bp` holds both readings of the cursor (`HoverBp`),
     * which differ on a reversed region.
     */
    rowHoverInfo(
      displayedRegionIndex: number,
      bp: HoverBp,
      rowIndex: number,
      bpPerPx: number,
    ) {
      const { drawnRows } = self
      const region =
        rowIndex >= 0 && rowIndex < drawnRows.length
          ? self.detailOnScreen.get(displayedRegionIndex)
          : undefined
      const hit = region
        ? findRowHoverAtBp(
            region,
            bp,
            rowIndex,
            bpPerPx,
            self.rowPlan.perBase ? self.encodeBinBp : undefined,
            drawnRowHeightPx(self.effectiveRowHeight, self.rowProportion),
          )
        : undefined
      if (!hit) {
        return undefined
      }
      const row = drawnRows[rowIndex]!
      return {
        ...hit,
        sampleLabel: row.label,
      }
    },
    /**
     * #method
     * The mean identity of the window a heatmap cell or X-Y bar paints at
     * base `bp` on `rowIndex`, and how many bases it averages, while
     * identity draws.
     */
    identityHoverInfo(
      displayedRegionIndex: number,
      bp: number,
      rowIndex: number,
    ) {
      const { color, mark } = self.rowPlan
      const region =
        color === 'identity' || mark === 'bar'
          ? self.detailOnScreen.get(displayedRegionIndex)
          : undefined
      const binBp = self.encodeBinBp
      const start = Math.floor(bp / binBp) * binBp
      return region
        ? identityOver(region.blocks, rowIndex, start, start + binBp)
        : undefined
    },
    /**
     * #method
     * The codon under the cursor on `rowIndex` at base `bp`, while the
     * codon view draws, from the codons its cells were encoded from.
     */
    codonHoverInfo(displayedRegionIndex: number, bp: number, rowIndex: number) {
      return self.rowPlan.bases === 'codon'
        ? findCodonAt(
            self.encodedUpload.get(displayedRegionIndex)?.codons,
            bp,
            rowIndex,
          )
        : undefined
    },
    /**
     * #method
     * The conservation bar painted over base `bp`, read from the bars the
     * band draws, so a binned window or a codon answers as it paints.
     */
    conservationHoverInfo(displayedRegionIndex: number, bp: number) {
      const bars = self.encodedUpload.get(displayedRegionIndex)?.conservation
      const bar = bars ? conservationBarAt(bars, bp) : undefined
      return bar ? { ...bar, codons: self.codonConservationActive } : undefined
    },
    /**
     * #method
     * The summary record whose bar is drawn at canvas x `x` on display row
     * `rowIndex`, or undefined: the hover on the summary tier.
     */
    summaryHoverInfo(rowIndex: number, x: number) {
      return summaryAt(
        self.encodedUpload,
        self.renderBlocks,
        self.renderState,
        rowIndex,
        x,
      )
    },
  }
}
