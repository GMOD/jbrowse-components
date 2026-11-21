/**
 * What the MAF rows draw and how it is encoded: the row plan and the render
 * state, the refName ranks, the legend, and each region's encode inputs,
 * sources and upload payload. The model composes these in order, each block
 * reading the ones before it.
 */
import { coverageLayerProblems } from '@jbrowse/alignments-core/coverageBandConfigSchema'
import { getPaletteHost } from '@jbrowse/core/util'
import { sameAsLast } from '@jbrowse/display-kit/stableIdentityComputed'
import { createEncodeMemo } from '@jbrowse/render-core/encodeMemo'

import { mafColorScales } from './colorScales.ts'
import { perRowRefNameRanks } from './components/refNameRanks.ts'
import { basesFieldOf } from './configSlotViews.ts'
import {
  EMPTY_MAF_COVERAGE,
  createRowsSourceJoin,
  encodeMafRows,
} from './encodeMafRows.ts'
import { resolveRowPlan } from './rowPlan.ts'

import type {
  MafGPURenderState,
  MafRegionData,
  MafUploadPayload,
} from '../LinearMafRenderer/mafRenderingBackendTypes.ts'
import type { MafColorPalette } from '../LinearMafRenderer/util.ts'
import type { MafFrameRecord, MafSummaryRecord } from '../types.ts'
import type { configSlotViews } from './configSlotViews.ts'
import type { MafRowsEncodeProps, MafRowsSource } from './encodeMafRows.ts'
import type { MafTopBands } from './mafTopBands.ts'
import type { RowPlan } from './rowPlan.ts'
import type { CoverageBandState } from '@jbrowse/alignments-core'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { ColorScale } from '@jbrowse/core/ui/colorScale'
import type { JBrowsePalette } from '@jbrowse/core/ui/palette'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

type ConfigSlots = ReturnType<typeof configSlotViews>

type RefNameRanks = ReturnType<typeof perRowRefNameRanks>

/** A stacked band's title, at the y its band starts. */
export interface MafBandLabel {
  band: 'coverage' | 'conservation'
  text: string
  top: number
}

/** What {@link mafRowPlanViews} reads: the color and bases settings, the tier and the canvas. */
export interface MafRowPlanHost extends Pick<
  ConfigSlots,
  'colorField' | 'yField' | 'showMismatches' | 'basesField' | 'rowProportion'
> {
  view: { initialized: boolean; coarseBpPerPx: number }
  configProblemsOf(conf: AnyConfigurationModel): string[]
  framesAdapterConfig: Record<string, unknown> | undefined
  coarseTierActive: boolean
  canvasWidthPx: number
  height: number
  rowsTopOffset: number
  rowsHeight: number
  effectiveRowHeight: number
  topBands: MafTopBands
  coverageBandState: CoverageBandState
  colorPalette: MafColorPalette
}

/** What the rows draw now, and the state the backend draws it with. */
export function mafRowPlanViews(self: MafRowPlanHost) {
  const superConfigProblemsOf = self.configProblemsOf
  const keepPlan = sameAsLast<RowPlan>()
  return {
    /**
     * #getter
     * At base level each reference base spans at least a pixel (UCSC's
     * `zoomedToBaseLevel`). Reads the throttled `coarseBpPerPx` so the
     * rendering swap does not thrash mid-zoom. False until the view is
     * initialized.
     */
    get zoomedToBaseLevel() {
      const view = self.view
      return view.initialized && view.coarseBpPerPx <= 1
    },
    /**
     * #method
     * The schema's rules, then what the rows cannot paint as written: a
     * coverage layer filter test its layer does not make, a codon color
     * with no reading frames, and a range on a field that paints the
     * theme's colors.
     */
    configProblemsOf(conf: AnyConfigurationModel): string[] {
      return [
        ...superConfigProblemsOf(conf),
        ...coverageLayerProblems(conf.coverage),
        ...(basesFieldOf(conf) === 'codon' && !self.framesAdapterConfig
          ? [
              'alignments.bases.encoding.color.field: codon needs a framesAdapter on the MAF adapter to define reading frames, so the layer draws nothing',
            ]
          : []),
      ]
    },
    /**
     * #getter
     * What the rows draw now (`resolveRowPlan`). The same object while
     * its members are, since every region's encode keys on it: crossing
     * base level with nothing to redraw re-encodes nothing.
     */
    get rowPlan(): RowPlan {
      const next = resolveRowPlan({
        field: self.colorField,
        y: self.yField,
        mismatches: self.showMismatches,
        bases: self.basesField,
        summaryTier: self.coarseTierActive,
        baseLevel: this.zoomedToBaseLevel,
        hasFrames: !!self.framesAdapterConfig,
      })
      return keepPlan(next)
    },
    /**
     * #getter
     * Render state passed to the GPU/Canvas2D backend each frame.
     *
     * `canvasHeight` is the whole canvas, stacked bands plus rows viewport,
     * because the coverage band draws on the same canvas as the rows.
     * `rowsTop` and `rowsHeight` are the rows band inside it.
     */
    get renderState(): MafGPURenderState {
      // Never undefined: zero rows over a region with no blocks is valid
      // state, and withholding it leaves the loading overlay spinning. The
      // first-paint gate is `hasFetched`.
      return {
        canvasWidth: self.canvasWidthPx,
        canvasHeight: self.height,
        rowsTop: self.rowsTopOffset,
        rowsHeight: self.rowsHeight,
        coverage: self.coverageBandState,
        conservation: self.topBands.rects.conservation,
        rowHeight: self.effectiveRowHeight,
        rowProportion: self.rowProportion,
        cellsFill: this.rowPlan.color === undefined,
        palette: self.colorPalette,
      }
    },
  }
}

/** What {@link mafRefNameRankViews} reads: the plan and the placed rows. */
export interface MafRefNameRankHost {
  rowPlan: RowPlan
  rpcDataMap: ReadonlyMap<number, MafRegionData>
}

/** Each row's source sequences ranked, for the `refNameRank` fill. */
export function mafRefNameRankViews(self: MafRefNameRankHost) {
  const keepRanks = sameAsLast<ReturnType<typeof perRowRefNameRanks>>()
  return {
    /**
     * #getter
     * Each row's source sequences ranked by aligned bp over the loaded
     * regions, so a pan within loaded data keeps every block's color.
     * Empty unless `refNameRank` fills the rows. The same object while
     * the ranks are, so a fetch that ranks nothing new re-encodes only
     * its own region.
     */
    get refNameRanks(): ReturnType<typeof perRowRefNameRanks> {
      const next =
        self.rowPlan.color === 'refNameRank'
          ? perRowRefNameRanks(self.rpcDataMap.values())
          : { ranks: new Map<number, Map<string, number>>(), maxRank: 0 }
      return keepRanks(next)
    },
  }
}

/** What {@link mafLegendViews} reads: the plan, the band stack, the frames and the row colors. */
export interface MafLegendHost
  extends
    IStateTreeNode,
    Pick<
      ConfigSlots,
      'colorField' | 'yField' | 'basesField' | 'colorEncoding' | 'colorKeyTitle'
    > {
  view: { initialized: boolean }
  topBands: MafTopBands
  rowPlan: RowPlan
  encodeBinBp: number
  refNameRanks: RefNameRanks
  framesActive: boolean
  framesOnScreen: boolean
  framesAdapterConfig: Record<string, unknown> | undefined
  codonConservationActive: boolean
  rowColorScales: ColorScale[]
}

/** The band titles and the color key. */
export function mafLegendViews(self: MafLegendHost) {
  return {
    /**
     * #getter
     * Titles for the stacked bands, with the y they sit at; empty unless
     * both bands reserve px, so a band's chip never hides the last band.
     * The on-screen chips and the SVG export both read it.
     *
     * The conservation title names what the band draws
     * (`codonConservationActive`), not the mode asked for.
     */
    get bandLabels(): MafBandLabel[] {
      const { coverage, conservation } = self.topBands.rects
      return coverage.height > 0 && conservation.height > 0
        ? [
            { band: 'coverage', text: 'Coverage', top: coverage.top },
            {
              band: 'conservation',
              text: self.codonConservationActive
                ? 'Conservation (aa identity)'
                : 'Conservation (% identity)',
              top: conservation.top,
            },
          ]
        : []
    },
    /**
     * #getter
     * `LegendMixin`'s hook: the key for the fill `rowPlan` paints, the
     * codon layer's, then the CDS frame key while the strip draws, then
     * the row color key. Each key is built by the module that paints it,
     * so the swatches match the screen.
     */
    get colorScales(): ColorScale[] {
      return this.colorScalesIn(getPaletteHost(self).palette)
    },
    /**
     * #method
     * `colorScales` in another theme: the SVG export's, whose codon and
     * CDS-frame swatches follow it.
     */
    colorScalesIn(palette: JBrowsePalette): ColorScale[] {
      return self.view.initialized
        ? mafColorScales({
            palette,
            plan: self.rowPlan,
            colorEncoding: self.colorEncoding,
            colorKeyTitle: self.colorKeyTitle,
            oneBaseCells: self.encodeBinBp === 1,
            maxRefNameRank: self.refNameRanks.maxRank,
            showsFrames: self.framesOnScreen,
            rowColorScales: self.rowColorScales,
          })
        : []
    },
    /**
     * #getter
     * Whether this display has a color key, as opposed to whether one is
     * drawn now: the question "Show legend" is offered on. A constant fill
     * and the bases key nothing; a field, the bars' height, the codon
     * layer and the frame strip key what they paint. Read off the
     * settings rather than `rowPlan` or the frames on screen, so the row
     * stays put through zoom and pan.
     *
     * Overrides `LegendMixin`'s, whose scale reads decline on an
     * uninitialized view and would drop the row while a track loads.
     */
    get hasLegendKey(): boolean {
      return (
        self.colorField !== undefined ||
        self.yField !== undefined ||
        (self.basesField === 'codon' && !!self.framesAdapterConfig) ||
        self.framesActive ||
        self.rowColorScales.length > 0
      )
    },
  }
}

/** What {@link mafRowsEncodeViews} reads: everything a region's rows encode beyond the region. */
export interface MafRowsEncodeHost extends Pick<
  ConfigSlots,
  'colorValue' | 'identityColors' | 'refNameRankPalette'
> {
  rowPlan: RowPlan
  encodeBinBp: number
  colorPalette: MafColorPalette
  refNameRanks: RefNameRanks
  rowIndexBySrc: Map<string, number>
  referenceRowIndex: number
  defaultCodonSpecies: string | undefined
  codonCellsActive: boolean
  codonConservationActive: boolean
  conservationBandActive: boolean
  detailOnScreen: ReadonlyMap<number, MafRegionData>
  summaryDataMap: ReadonlyMap<number, MafSummaryRecord[]>
  framesDataMap: ReadonlyMap<number, MafFrameRecord[]>
}

/** A region's encode inputs, and the tiers its rows draw from. */
export function mafRowsEncodeViews(self: MafRowsEncodeHost) {
  const join = createRowsSourceJoin()
  return {
    /**
     * #method
     * What a region's rows encode reads beyond the region, in a given
     * palette, since the SVG export's theme need not be the session's. A
     * mode flip lives here so it re-encodes every region as a declared
     * input.
     */
    rowsEncodePropsIn(colorPalette: MafColorPalette): MafRowsEncodeProps {
      return {
        plan: self.rowPlan,
        value: self.colorValue,
        identityColors: self.identityColors,
        gpu: {
          palette: colorPalette,
          binBp: self.encodeBinBp,
        },
        refNameRanks: self.refNameRanks.ranks,
        refNameRankPalette: self.refNameRankPalette,
        rowIndexBySrc: self.rowIndexBySrc,
        codons:
          (self.codonCellsActive || self.codonConservationActive) &&
          self.defaultCodonSpecies !== undefined
            ? {
                anchor: self.defaultCodonSpecies,
                cells: self.codonCellsActive,
                band: self.codonConservationActive,
                refRowIndex: self.referenceRowIndex,
              }
            : undefined,
        conservation:
          self.conservationBandActive && !self.codonConservationActive,
      }
    },
    /**
     * #method
     * `rowsEncodePropsIn` in the session's palette, for the on-screen
     * encode.
     */
    rowsEncodeProps(): MafRowsEncodeProps {
      return this.rowsEncodePropsIn(self.colorPalette)
    },
    /**
     * #getter
     * Each region's detail and summary tiers, paired: what its rows
     * draw from. A pair keeps its identity while neither tier moved.
     */
    get rowsSources(): ReadonlyMap<number, MafRowsSource> {
      return join(self.detailOnScreen, self.summaryDataMap, self.framesDataMap)
    },
  }
}

/** What {@link mafEncodedUploadViews} reads: the sources and the encode inputs. */
export interface MafEncodedUploadHost {
  rowsSources: ReadonlyMap<number, MafRowsSource>
  rowsEncodeProps(): MafRowsEncodeProps
}

/** Every loaded region's upload payload, encoded once per change. */
export function mafEncodedUploadViews(self: MafEncodedUploadHost) {
  const encoded = createEncodeMemo(
    () => self.rowsSources,
    () => self.rowsEncodeProps(),
    (source, props): MafUploadPayload => ({
      ...encodeMafRows(source, props),
      coverage: source.detail?.coverage ?? EMPTY_MAF_COVERAGE,
    }),
  )
  return {
    /**
     * #getter
     * Every loaded region's upload payload, the rows band's `span`
     * channels beside the coverage band's buffers, keyed by
     * displayedRegionIndex. Held here rather than in the upload's setup
     * thunk so a theme or color change re-encodes without an RPC
     * roundtrip and the memo outlives a context-loss recovery.
     */
    get encodedUpload(): ReadonlyMap<number, MafUploadPayload> {
      return encoded()
    },
  }
}
