import { lazy } from 'react'

import { coverageAutoscaleViews } from '@jbrowse/alignments-core'
import {
  COVERAGE_Y_PATHS,
  coverageBandSlotActions,
  coverageBandSlotViews,
} from '@jbrowse/alignments-core/coverageBandConfigSchema'
import { getCoverageMenuItems } from '@jbrowse/alignments-core/coverageMenuItems'
import {
  ConfigurationReference,
  readConfObject,
  setConf,
} from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import {
  canonicalAdapterRefName,
  canonicalizeViewRefName,
  getDialogHost,
  getNotificationSink,
  getPaletteHost,
  getSession,
  isFeature,
  notifyFeatureDetailsMiss,
  openFeatureWidget,
  SimpleFeature,
  sum,
  withFeatureDetails,
} from '@jbrowse/core/util'
import { basePaintedAt } from '@jbrowse/core/util/Base1DUtils'
import { predicatesOf } from '@jbrowse/core/util/fieldPredicate'
import { sameStrings } from '@jbrowse/core/util/sameStrings'
import ColorWritesMixin, {
  writtenColorOf,
} from '@jbrowse/display-kit/ColorWritesMixin'
import { ContextMenuMixin } from '@jbrowse/display-kit/ContextMenuMixin'
import FacetWritesMixin from '@jbrowse/display-kit/FacetWritesMixin'
import HeightModeMixin from '@jbrowse/display-kit/HeightModeMixin'
import HiddenGroupsMixin from '@jbrowse/display-kit/HiddenGroupsMixin'
import LegendMixin from '@jbrowse/display-kit/LegendMixin'
import MultiRegionDisplayMixin from '@jbrowse/display-kit/MultiRegionDisplayMixin'
import SolidColorDialog from '@jbrowse/display-kit/SolidColorDialog'
import { colorForField } from '@jbrowse/display-kit/colorConfigSchema'
import { onDisplayedRegionsChange } from '@jbrowse/display-kit/displayAutoruns'
import { fetchEachRegion } from '@jbrowse/display-kit/fetchEachRegion'
import { groupByPlotOf } from '@jbrowse/display-kit/groupByMenu'
import { GROUP_LABEL_HEIGHT } from '@jbrowse/display-kit/groupLabelStyle'
import { keyWindowsOf } from '@jbrowse/display-kit/keyWindows'
import {
  editPlotMenuItems,
  openPlotDialog as queuePlotDialog,
} from '@jbrowse/display-kit/plotMenu'
import { stableIdentityComputed } from '@jbrowse/display-kit/stableIdentityComputed'
import { subPixelBinBp } from '@jbrowse/display-kit/subPixelBinBp'
import { viewRegionTable } from '@jbrowse/display-kit/viewRegionTable'
import { addDisposer, types } from '@jbrowse/mobx-state-tree'
import { containingLgv } from '@jbrowse/plugin-linear-genome-view'
import { installUpload, oneCell } from '@jbrowse/render-core/installUpload'
import { ScoreScaleMixin, resolveSymlogConstant } from '@jbrowse/wiggle-core'
import { autorun, computed, observable } from 'mobx'

import { buildArcBandFeeds } from '../features/arcs/bandFeed.ts'
import { collectArcs, resolveArcsByGroup } from '../features/arcs/compute.ts'
import { connectorCategories } from '../features/linkedReads/computeOverlay.ts'
import { buildConnectorFeeds } from '../features/linkedReads/connectorFeed.ts'
import { connectorStyler } from '../features/linkedReads/connectorStyle.ts'
import { buildSashimiBandFeeds } from '../features/sashimi/bandFeed.ts'
import { visibleRegionJunctions } from '../features/sashimi/computeOverlay.ts'
import { mergeJunctions } from '../features/sashimi/junctions.ts'
import {
  junctionSupportingReadSlots,
  sameLaneJunction,
} from '../features/sashimi/supportingReads.ts'
import { arcSlotCategory } from '../shaders/palettes.ts'
import { withBasesFields } from '../shared/basesFilter.ts'
import { paintsEveryBase, workerColorField } from '../shared/colorFieldDefs.ts'
import { fieldTag } from '../shared/facetLabels.ts'
import {
  facetValueNotices,
  overflowSplitNotices,
  sectionOrder,
  workerFacet,
  workerInsertSizeBand,
} from '../shared/groupFeatures.ts'
import {
  LEGEND_MAX_WIDTH,
  getAlignmentsColorScales,
  arcColorCategoryLabel,
  arcLegendTitle,
  getArcLegendItems,
  readCategoryLabelOverrides,
  readColorCategoryLabel,
  sashimiLegend,
} from '../shared/legendUtils.ts'
import {
  alignmentsColorViews,
  detectedModificationsOf,
  readPaletteViews,
} from './alignmentsColorViews.ts'
import { sortOf } from './alignmentsSortConfigSchema.ts'
import { buildReadIdsByChainName } from './chainFields.ts'
import { rgb255 } from './colorUtils.ts'
import { firstSectionHighlight } from './components/arcHitTest.ts'
import { computeVisibleLabels } from './components/computeVisibleLabels.ts'
import { selectedConnectorHighlight } from './components/connectorHitTest.ts'
import { nonReferenceAt } from './components/positionStats.ts'
import {
  readHighlightInk,
  readsToLight,
  slotsOfIds,
} from './components/readHighlightInk.ts'
import { SASHIMI_FEATURE_ID_PREFIX } from './components/sashimiArcs.ts'
import { selectedSashimiHighlight } from './components/sashimiHitTest.ts'
import { bandScreenTop } from './components/sectionScreen.ts'
import {
  alignmentsConfigProblems,
  configSlotActions,
  configSlotViews,
  requireReadsConf,
} from './configSlotViews.ts'
import {
  bandPlotViews,
  coverageDomainViews,
  coverageStatsViews,
  coverageTicksViews,
} from './coverageScaleViews.ts'
import { filterFieldInEffect, layersInEffect } from './dialogs/layerFilters.ts'
import { fetchExportedReads } from './exportedReads.ts'
import {
  attachLinkedReadLinesByGroup,
  fitLaneRows,
  fittedReadPitch,
  groupRowCaps,
  maxRowsFor,
  resolveFitDefaultCap,
} from './groupLayout.ts'
import {
  buildReadIdIndex,
  buildSashimiDownKeys,
  eachGroup,
  hasNamedGroups,
  orderedGroups,
  splitOverflowKeys,
} from './groupedDataMaps.ts'
import { computeInsertSizeTicks } from './insertSizeTicks.ts'
import {
  arcSlotsInWindows,
  connectorSlotsInWindows,
  junctionInWindows,
} from './keyWindows.ts'
import { buildLanes, drawnLanesOf, drawsPileupRows } from './lanes.ts'
import {
  featureSpacingForHeight,
  basesFilterNarrowing,
  getContextMenuItems,
  getFeatureHeightMenuItem,
  getFiltersMenuItems,
  getGroupByMenuItem,
  getJunctionFilterItems,
  getReadConnectionsBandItems,
  getReadConnectionsMenuItem,
  getPresetsMenuItem,
  getReadsColorByMenuItem,
  getReadsMenuItems,
  getSashimiPlacementItems,
  getSortMenuItem,
  getTrackSizingItems,
} from './menus/index.ts'
import {
  connectorSettingViews,
  connectorViews,
  facetLayoutViews,
  groupLayoutViews,
  pileupLayoutViews,
} from './pileupLayoutViews.ts'
import { chainReadIdsAt, findRead, readInfo } from './readLookup.ts'
import { readCloudDomainBp } from './renderers/arcMarks.ts'
import { connectorBandState } from './renderers/connectorMarks.ts'
import { sashimiBandState, sashimiLabels } from './renderers/sashimiMarks.ts'
import { fetchFeatureDetails, fetchFeaturesForRegion } from './rpcCalls.ts'
import {
  boundBelowCoverageHeights,
  buildSectionRenders,
  computeStackedSections,
  dragBelowCoverageBand,
  laneBandOverheads,
} from './sectionLayout.ts'

import type {
  GroupedAlignmentsResult,
  RowCap,
  WorkerPileupData,
} from '../RenderAlignmentDataRPC/types'
import type { ArcSplitCategory } from '../features/arcs/arcSplitCategory.ts'
import type { ArcBandFeed } from '../features/arcs/bandFeed.ts'
import type { ArcsByGroupResult } from '../features/arcs/compute.ts'
import type { ConnectorFeed } from '../features/linkedReads/connectorFeed.ts'
import type { ConnectorStyler } from '../features/linkedReads/connectorStyle.ts'
import type { SashimiBandFeed } from '../features/sashimi/bandFeed.ts'
import type { HoveredJunction } from '../features/sashimi/supportingReads.ts'
import type { ColorPalette } from '../shaders/colors.ts'
import type { ArcCategory } from '../shaders/palettes.ts'
import type { ReadSlot } from '../shared/readSlot.ts'
import type {
  BasesPatch,
  ColumnSortField,
  SortColumn,
  SortSetting,
} from '../shared/types'
import type {
  BaseLinearAlignmentsDisplayConfigModel,
  BaseLinearAlignmentsDisplayConfigSchema,
} from './baseConfigSchema.ts'
import type { ReadColorCategory } from './colorUtils.ts'
import type { ArcHighlight } from './components/arcHitTest.ts'
import type { ContextMenuHit } from './components/hitTestPipeline.ts'
import type { ScrollModel } from './components/sectionScreen.ts'
import type { TooltipPayload } from './components/tooltipUtils.ts'
import type { AlignmentsUnit } from './constants.ts'
import type { GroupSize } from './groupLayout.ts'
import type { AlignmentLane } from './lanes.ts'
import type {
  AlignmentsRenderingBackend,
  SectionSource,
} from './renderers/rendererTypes.ts'
import type { SashimiLabel } from './renderers/sashimiMarks.ts'
import type { VariantAllele, VariantSortColumn } from '@jbrowse/alignments-core'
import type { AnyConfigurationModel, Plot } from '@jbrowse/core/configuration'
import type { LodTier } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { ExportedFeaturesRequest } from '@jbrowse/core/pluggableElementTypes/models'
import type { ContextMenuAnchor, MenuItem } from '@jbrowse/core/ui'
import type { ColorScale } from '@jbrowse/core/ui/colorScale'
import type { JBrowsePalette } from '@jbrowse/core/ui/palette'
import type { AdapterRefName, Feature, Region } from '@jbrowse/core/util'
import type { HeightMode } from '@jbrowse/display-kit/heightMode'
import type { HighlightRect } from '@jbrowse/display-kit/highlightHost'
import type { IndexedRegion } from '@jbrowse/display-kit/planRegionFetch'
import type { ExportSvgDisplayOptions } from '@jbrowse/display-kit/types'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type { LinkRegion } from '@jbrowse/render-core/marks'
import type { ValueScale } from '@jbrowse/wiggle-core'
import type { IComputedValue } from 'mobx'

// Lazy so the eager state model keeps @floating-ui off the startup path.
const AlignmentsTooltip = lazy(
  () => import('./components/AlignmentsTooltip.tsx'),
)

export type { AlignmentLane }

export interface HoverCoverageBand {
  topOffset: number
  coverageHeight: number
}

// One identity, so `groupSizesInEffect` hands the layout no fresh map per
// read.
const NO_GROUP_SIZES: ReadonlyMap<string, GroupSize> = new Map()

// One frozen empty array, so the common no-arcs frame invalidates no observer.
// Frozen so no caller's in-place `.sort()` corrupts the singleton.
const NO_SASHIMI_LABELS = Object.freeze([]) as readonly SashimiLabel[]
const NO_SASHIMI_FEEDS_BY_GROUP: ReadonlyMap<
  string,
  ReadonlyMap<number, SashimiBandFeed>
> = new Map()
const NO_SASHIMI_FEEDS: ReadonlyMap<number, SashimiBandFeed> = new Map()
const NO_LINK_REGIONS: readonly LinkRegion[] = []
const NO_ARC_FEEDS: ReadonlyMap<number, ArcBandFeed> = new Map()
const NO_CONNECTOR_FEEDS: ReadonlyMap<number, ConnectorFeed> = new Map()

/**
 * The read palette in one theme and the marks colored from it, by group and
 * displayed region, joined to the laid-out sections in stacking order.
 */
export interface ThemedSources {
  colors: ColorPalette
  arcFeedsByGroup: ReadonlyMap<string, ReadonlyMap<number, ArcBandFeed>>
  sashimiFeedsByGroup: ReadonlyMap<string, ReadonlyMap<number, SashimiBandFeed>>
  connectorFeedsByGroup: ReadonlyMap<string, ReadonlyMap<number, ConnectorFeed>>
  sourceSections: SectionSource[]
}

/**
 * What a right-click on the pileup resolved: the anchor, the hit and the read
 * under it. `contextMenuFeature` stays outside because it arrives an RPC later.
 */
export interface AlignmentsContextMenuInfo extends ContextMenuAnchor {
  hit?: ContextMenuHit
  featureId?: string
}

/**
 * #stateModel LinearAlignmentsDisplay
 * #displayFoundation MultiRegionDisplayMixin
 * #category display
 * State model factory for LinearAlignmentsDisplay
 *
 * #example
 * The display goes in a track's `displays` array; here are three complete
 * `AlignmentsTrack` configs to paste into `tracks`.
 *
 * Basic BAM, opened taller:
 * ```js
 * {
 *   type: 'AlignmentsTrack',
 *   trackId: 'ngs_reads',
 *   name: 'NGS reads',
 *   assemblyNames: ['hg38'],
 *   adapter: { type: 'BamAdapter', uri: 'https://example.com/sample.bam' },
 *   displays: [
 *     {
 *       type: 'LinearAlignmentsDisplay',
 *       displayId: 'ngs_reads-LinearAlignmentsDisplay',
 *       height: 250,
 *     },
 *   ],
 * }
 * ```
 *
 * CRAM colored by CpG methylation (modBAM MM/ML tags):
 * ```js
 * {
 *   type: 'AlignmentsTrack',
 *   trackId: 'methylation',
 *   name: 'Methylation',
 *   assemblyNames: ['hg38'],
 *   adapter: { type: 'CramAdapter', uri: 'https://example.com/sample.cram' },
 *   displays: [
 *     {
 *       type: 'LinearAlignmentsDisplay',
 *       displayId: 'methylation-LinearAlignmentsDisplay',
 *       pileup: {
 *         bases: {
 *           show: true,
 *           encoding: { color: 'modifications' },
 *           unmodified: { show: true },
 *         },
 *       },
 *     },
 *   ],
 * }
 * ```
 *
 * Long reads with split/mate reads connected by arcs:
 * ```js
 * {
 *   type: 'AlignmentsTrack',
 *   trackId: 'long_reads',
 *   name: 'Long reads',
 *   assemblyNames: ['hg38'],
 *   adapter: { type: 'BamAdapter', uri: 'https://example.com/longreads.bam' },
 *   displays: [
 *     {
 *       type: 'LinearAlignmentsDisplay',
 *       displayId: 'long_reads-LinearAlignmentsDisplay',
 *       height: 400,
 *       unit: 'chain',
 *       readConnections: { show: true },
 *     },
 *   ],
 * }
 * ```
 */
export default function stateModelFactory(
  configSchema: BaseLinearAlignmentsDisplayConfigSchema,
) {
  return (
    types
      .compose(
        'LinearAlignmentsDisplay',
        BaseDisplay,
        HeightModeMixin(),
        MultiRegionDisplayMixin(),
        ScoreScaleMixin(COVERAGE_Y_PATHS),
        LegendMixin(),
        ColorWritesMixin(),
        FacetWritesMixin(),
        ContextMenuMixin<AlignmentsContextMenuInfo>(),
        HiddenGroupsMixin(),
        types.model({
          /**
           * #property
           */
          type: types.literal('LinearAlignmentsDisplay'),
          /**
           * #property
           */
          configuration: ConfigurationReference(configSchema),
        }),
      )
      // Config-slot reads and plain writes live in `configSlotViews`.
      .views(coverageBandSlotViews)
      .actions(coverageBandSlotActions)
      .views(configSlotViews)
      .actions(configSlotActions)
      .volatile(() => {
        return {
          /**
           * #volatile
           */
          featureIdUnderMouse: undefined as undefined | string,
          /**
           * #volatile
           */
          mouseoverExtraInformation: undefined as TooltipPayload | undefined,
          /**
           * #volatile
           */
          contextMenuFeature: undefined as Feature | undefined,
          /**
           * #volatile
           * Group keys whose pileup is collapsed to its coverage band, dropped
           * when `groupKeySpace` moves (`dropGroupState`).
           */
          collapsedGroups: observable.set<string>(),
          /**
           * #volatile
           * Per-group pileup sizes a user set (`GroupSize`), keyed by group key
           * and dropped with `collapsedGroups`: a drag's px height, which caps
           * the lane's rows and pads its band, or 'all', the chip's "show
           * all", which lifts the cap and pads nothing.
           */
          groupSizes: observable.map<string, GroupSize>(),
          /**
           * #volatile
           * Fitted read pitch in px, written by the afterAttach autorun while
           * `fitHeightToDisplay` is on; 0 until computed. A volatile rather
           * than a getter because it breaks the cycle between `featureHeight`
           * and the layout.
           */
          fittedHeightPx: 0,
          /**
           * #volatile
           * The two read ids at the ends of the connector under the cursor.
           */
          hoveredConnectorReadIds: [] as string[],
          /**
           * #volatile
           * The sashimi junction or split-read arc under the cursor, whose
           * supporting reads the hover lights.
           */
          hoveredJunction: undefined as HoveredJunction | undefined,

          /**
           * #volatile
           */
          overCigarItem: false,
          /**
           * #volatile
           * Screen-px coverage band of the section under a coverage/indicator
           * hover; the tooltip draws its vertical hover bar on it. `undefined`
           * when not hovering.
           */
          hoverCoverageBand: undefined as HoverCoverageBand | undefined,
          /**
           * #volatile
           * The read-connection arc under the cursor, as the ink
           * `ArcHoverOverlay` draws. A snapshot from the mousemove that found
           * the arc, like its tooltip.
           */
          hoveredArcHighlight: undefined as ArcHighlight | undefined,
        }
      })
      .views(self => ({
        /**
         * #getter
         * Region index → grouped worker result. Ungrouped fetches store one
         * group (key '').
         */
        get rpcDataMap(): ReadonlyMap<number, GroupedAlignmentsResult> {
          return self.regionPayloads as ReadonlyMap<
            number,
            GroupedAlignmentsResult
          >
        },
      }))
      .views(self => ({
        /**
         * #getter
         */
        get view() {
          return containingLgv(self)
        },
      }))
      .views(self => connectorSettingViews(self))
      .views(self => facetLayoutViews(self))
      .views(self => bandPlotViews(self))
      .views(self => coverageStatsViews(self))
      .views(self => coverageAutoscaleViews(self))
      .views(self => coverageDomainViews(self))
      .views(self => {
        const keyWindows = stableIdentityComputed(() =>
          self.view.initialized
            ? keyWindowsOf(self.view.settledDynamicBlocks)
            : [],
        )
        return {
          /**
           * #getter
           * The bp each displayed region shows once a pan settles, which the
           * keys list what is present in. Compared by value, so a pan that
           * settles where it was rebuilds no key.
           */
          get keyWindows() {
            return keyWindows.get()
          },
          /**
           * #getter
           */
          get featureWidgetType() {
            return {
              type: 'AlignmentsFeatureWidget',
              id: 'alignmentFeature',
            }
          },

          /**
           * #getter
           */
          get TooltipComponent() {
            return AlignmentsTooltip
          },

          /**
           * #getter
           * Modification type code -> painted color, for every type the loaded
           * reads declare. Off `rpcDataMap`, not the laid-out map, so a hidden
           * group's types stay offered; the legend asks `presentModifications`
           * instead.
           */
          get detectedModifications(): ReadonlyMap<string, string> {
            return detectedModificationsOf(self.rpcDataMap)
          },

          /**
           * #method
           * The loaded reads differing from the reference at a variant's sort
           * column, or with `allele` only those with it, over the reads
           * spanning it in the lanes not hidden. Undefined until a fetch
           * reaching the column completes.
           */
          nonReferenceAt(column: VariantSortColumn, allele?: VariantAllele) {
            let total: { count: number; depth: number } | undefined
            for (const { data } of eachGroup(
              self.rpcDataMap,
              self.hiddenGroups,
            )) {
              const at = nonReferenceAt(column, data, allele)
              if (at) {
                total = {
                  count: (total?.count ?? 0) + at.count,
                  depth: (total?.depth ?? 0) + at.depth,
                }
              }
            }
            return total
          },

          /**
           * #getter
           * Whether a fetch has completed, so an empty `detectedModifications`
           * means these reads have none. The modifications menu shows "Loading
           * modifications..." until it turns true.
           */
          get modificationsReady() {
            return self.rpcDataMap.size > 0
          },

          /**
           * #getter
           */
          get detectedModificationTypes() {
            return [...this.detectedModifications.keys()]
          },

          /**
           * #getter
           * Fit-to-display mode is on and a pitch has been computed
           * (`fittedHeightPx > 0`). Both size getters read this gate.
           */
          get isFitting(): boolean {
            return self.fitHeightToDisplay && self.fittedHeightPx > 0
          },

          /**
           * #getter
           * The read body height: the fitted pitch minus `featureSpacing` in
           * fit mode, else `markHeight`, which is what editors
           * that write the size read.
           */
          get featureHeight(): number {
            return this.isFitting
              ? self.fittedHeightPx - this.featureSpacing
              : self.markHeight
          },

          /**
           * #getter
           * Derived from the read height, never stored: a 1px gap once there is
           * room (pitch/height > 3), else flush. One rule covers the fixed
           * presets and the fit squeeze.
           */
          get featureSpacing(): number {
            return featureSpacingForHeight(
              this.isFitting ? self.fittedHeightPx : self.markHeight,
            )
          },

          /**
           * #getter
           * The per-row pitch: read body plus derived gap. Every "row N sits at
           * N*pitch" computation reads it.
           */
          get rowHeight(): number {
            return this.featureHeight + this.featureSpacing
          },

          /**
           * #getter
           * The column sort `sort` names, or undefined under a whole-window
           * order. Normalizes the refName, since a spec can write an alias
           * (`chr1` for `1`) that `sortLayout`'s gate would never match. A
           * column type missing `refName` or `pos` reads as no sort.
           */
          get sortColumn(): SortColumn | undefined {
            return sortOf(self.configuration.sort, refName =>
              canonicalizeViewRefName(self, refName),
            ).sortColumn
          },
        }
      })
      .views(self => groupLayoutViews(self))
      .views(self => {
        let rowCaps: IComputedValue<ReadonlyMap<string, RowCap>> | undefined
        let fitCap: IComputedValue<RowCap> | undefined
        const superConfigProblemsOf = self.configProblemsOf
        return {
          /**
           * #getter
           * Why an explicit read ordering cannot take effect, or `undefined`:
           * one value holds both the gate and the message naming the switch that
           * brings it back. Chain layout takes no `sort`; its rows are
           * chains.
           */
          get sortReadsBlockedReason(): string | undefined {
            return self.unit === 'chain'
              ? 'Chain rows are ordered by chain — turn off "View as pairs/link supplementary alignments" to sort reads'
              : !self.showPileup
                ? 'Turn on Show → Show pileup to sort reads'
                : this.collapseSortBlockedReason
          },

          /**
           * #getter
           * Why the collapse leaves no sort to take effect, or `undefined`:
           * every drawn section lays its reads on one row, none opted out by
           * an expand or a drag. A hidden lane or one shown as coverage alone
           * stacks nothing, whatever cap it holds.
           */
          get collapseSortBlockedReason(): string | undefined {
            return self.collapseSections &&
              !self.groupOrder.some(
                g =>
                  this.groupRowCaps.has(g.key) &&
                  !self.collapsedGroups.has(g.key),
              )
              ? `Every group is drawn on one row — turn off Show → "Collapse groups to one row"${self.fitHeightToDisplay ? '' : ', or expand a group from its label,'} to sort`
              : undefined
          },

          /**
           * #getter
           * Whether an explicit read ordering can take effect. The track menu's
           * "Sort by" and the context menu's position-anchored sorts both
           * read it.
           */
          get canSortReads() {
            return this.sortReadsBlockedReason === undefined
          },

          /**
           * #getter
           * Whether a single group's pileup height can be set for that group alone,
           * offered by the label chip's expand/fit button and the per-group
           * drag handles. Fit mode refuses: an override there opts a lane out
           * of the fit and overflows the display.
           */
          get canSizeGroupHeights() {
            return self.showPileup && !self.fitHeightToDisplay
          },

          /**
           * #getter
           * The lane sizes in effect, not the set banked. Fit solves one pitch
           * from every lane's full row count, so fit mode ignores the sizes
           * without dropping them; returning to fixed restores them.
           */
          get groupSizesInEffect(): ReadonlyMap<string, GroupSize> {
            return self.fitHeightToDisplay ? NO_GROUP_SIZES : self.groupSizes
          },

          /**
           * #getter
           * The arc color slots plotted, mapped to legend buckets, for curved
           * arcs and the read cloud alike. Empty unless an overlay is on with
           * the legend shown.
           */
          get arcLegendCategories(): Set<ArcCategory> {
            const present = new Set<ArcCategory>()
            if (self.showLegend && self.drawnReadConnections !== 'off') {
              // Both halves arcs resolve into, `byGroup` and
              // `crossRegionByGroup`; see `ArcsByGroupResult`.
              for (const slot of arcSlotsInWindows(
                this.arcsResult,
                self.keyWindows,
              )) {
                present.add(arcSlotCategory(slot))
              }
            }
            return present
          },

          /**
           * #getter
           * Heading for the connection colors, named after what the reader is
           * looking at: flat read-cloud lines are not arcs, and with the band
           * off the colors are the pileup connectors'.
           */
          get arcLegendTitle() {
            return arcLegendTitle(self.drawnReadConnections)
          },

          /**
           * #getter
           * Per group, which junctions draw in the strip below coverage (by
           * `junctionKey`): the one sashimi side decision, read by
           * `sashimiDownArcLanes` to reserve the strip and `themed`'s sashimi
           * feeds to place each arc. refNames come from `loadedRegions`, keeping this
           * a tier-1 (fetch) derivation. A region not yet loaded gets a unique
           * key, so regions not proven to share a chromosome never pool onto
           * one bp line.
           */
          get sashimiDownKeysByGroup() {
            return buildSashimiDownKeys(self.rpcDataMap, {
              filter: self.junctionFilter,
              placement: self.effectiveSashimiPlacement,
              refNameFor: i => self.loadedRegions.get(i)?.refName ?? `#${i}`,
              hidden: self.hiddenGroups,
            })
          },

          /**
           * #getter
           * Group keys whose junctions draw in the strip below coverage, i.e.
           * the lanes that strip is reserved for.
           */
          get sashimiDownArcLanes() {
            const out = new Set<string>()
            for (const [key, down] of this.sashimiDownKeysByGroup) {
              if (down.size > 0) {
                out.add(key)
              }
            }
            return out
          },

          /**
           * #getter
           * The below-coverage bands as stated: the height slots, the settings
           * and whether any lane has arcs or a sashimi junction bound for its
           * strip.
           */
          get statedBelowCoverageBands() {
            return {
              showCoverage: self.showCoverage,
              coverageHeight: self.coverageHeight,
              drawnReadConnections: self.drawnReadConnections,
              readConnectionsDown: self.readConnectionsPlacement === 'down',
              readConnectionsHeight: self.readConnectionsHeight,
              showSashimi: self.showSashimi,
              sashimiHeight: self.sashimiHeight,
              hasArcs: this.arcsResult.inkGroupKeys.size > 0,
              hasSashimiDownArcs: this.sashimiDownArcLanes.size > 0,
            }
          },

          /**
           * #getter
           * The three band heights as every consumer draws them: the slots
           * bound against `bandPlot` top-down (`boundStackedBands`), since a
           * config or a session snapshot states a height no drag clamped.
           */
          get bandHeights() {
            return boundBelowCoverageHeights(
              this.statedBelowCoverageBands,
              self.bandPlot,
            )
          },

          /**
           * #getter
           * The pooled band stack: the bound heights, the settings, and
           * whether any lane has arcs or a sashimi junction bound for its
           * strip. Each lane's stack reads the settings and answers the data
           * half itself; the drag bounds read the pooled answer, so every
           * lane's handle for a band resizes it.
           */
          get belowCoverageBandsInput() {
            return { ...this.statedBelowCoverageBands, ...this.bandHeights }
          },

          /**
           * #getter
           * Each lane's band stack in px, in stacking order, as
           * `computeStackedSections` reserves it. Fetch-tier inputs only, so
           * the layout reads it without a cycle.
           */
          get laneBandOverheads(): number[] {
            return laneBandOverheads(
              this.belowCoverageBandsInput,
              self.groupOrder.map(g => g.key),
              this.arcsResult.inkGroupKeys,
              this.sashimiDownArcLanes,
            )
          },

          /**
           * #getter
           * The height every lane's band stack takes from the row budget.
           */
          get totalBandOverhead() {
            return sum(this.laneBandOverheads)
          },

          /**
           * #getter
           * The height overrides and "show all" lanes as row caps, keyed by
           * lane — the layout's input. Keeps its identity while the caps
           * compare equal, so a drag frame that moves no cap relays no read and
           * re-bakes no color.
           */
          get groupRowCaps(): ReadonlyMap<string, RowCap> {
            rowCaps ??= stableIdentityComputed(() =>
              groupRowCaps({
                sizes: this.groupSizesInEffect,
                ceilingPx: self.pileupMaxLayoutHeight,
                rowHeight: self.rowHeight,
              }),
            )
            return rowCaps.get()
          },

          /**
           * #getter
           * The cap a lane on the shared fit budget lays out to: its slice of
           * the viewport when grouped outside fit, the display-wide ceiling
           * otherwise, with the policy that set it (a clipped lane reports it
           * as `clippedBy`).
           * Keeps its identity like `groupRowCaps`: its inputs move a px at a
           * time, it moves a row at a time. Grow mode fits to the grow ceiling,
           * fixed/fit to the drag-resizable slot; both read config slots, never
           * the `height` getter, so grow's height → layout chain cannot cycle.
           */
          get fitDefaultCap(): RowCap {
            fitCap ??= stableIdentityComputed(() => this.resolvedFitDefaultCap)
            return fitCap.get()
          },

          /**
           * #getter
           * `fitDefaultCap` recomputed, without the identity it keeps.
           */
          get resolvedFitDefaultCap(): RowCap {
            // A collapsed lane costs band overhead but claims no pileup rows.
            // A fitted pitch splits nothing: it was solved from every lane's
            // full row count, so each lane already has room for all its rows,
            // and an equal slice would hide a deep lane's reads beside a
            // shallow lane's blank ones. Fit with no room for reads has no
            // pitch, and splits like fixed.
            const { order } = self.groupLayoutContext
            return resolveFitDefaultCap({
              splitsViewport: order.length > 1 && !self.isFitting,
              height: self.autoHeight
                ? self.growMaxHeight
                : self.fitTargetHeight,
              visibleGroupCount: order.filter(
                g => !self.collapsedGroups.has(g.key),
              ).length,
              rowHeight: self.rowHeight,
              totalOverhead: this.totalBandOverhead,
              maxRows: this.fitCeilingRows,
            })
          },

          /**
           * #getter
           * How many rows each lane needs, in stacking order, laid out
           * uncapped; 0 for a coverage-only lane. Reads the overlaps and the
           * ceiling only, so a fit drag leaves it alone.
           */
          get fitLaneRows(): number[] {
            return fitLaneRows(
              self.groupLayoutContext,
              self.pileupMaxLayoutHeight,
              self.collapsedGroups,
            )
          },

          /**
           * #getter
           * `fitLaneRows` summed.
           */
          get fitRows(): number {
            return sum(this.fitLaneRows)
          },

          /**
           * #getter
           * The `pileup.maxLayoutHeight` ceiling in rows. While fitting it is clamped to the
           * rows the pileup needs, so the quotient holds steady across drag
           * frames and the layout does not re-place every row.
           */
          get fitCeilingRows(): number {
            const ceiling = maxRowsFor(
              self.pileupMaxLayoutHeight,
              self.rowHeight,
            )
            return self.isFitting ? Math.min(ceiling, this.fitRows) : ceiling
          },

          /**
           * #getter
           * Where a mate's reference sits in this assembly's own chromosome
           * order, for chromosome painting — the same
           * `Assembly.getRefNamePosition` the comparative displays paint by.
           * From the ASSEMBLY, not the reads on screen, so a color never
           * changes with what else is in view. Undefined under every other
           * field and until the assembly initializes.
           */
          get paintedRefNamePosition() {
            const assembly =
              self.colorField === 'mateRefName'
                ? self.loadedAssembly
                : undefined
            return assembly?.getRefNamePosition
          },

          /**
           * #getter
           * A facet field no fetched read answers, and the values whose reads
           * split between their own section and the overflow one.
           */
          get liveNotices(): string[] {
            const facet = self.effectiveFacet
            const compare = sectionOrder(facet?.field ?? '', facet?.sort)
            return [
              ...facetValueNotices(
                facet,
                orderedGroups(self.rpcDataMap, undefined, compare).map(
                  g => g.key,
                ),
              ),
              ...overflowSplitNotices(
                splitOverflowKeys(self.rpcDataMap, compare),
              ),
            ]
          },

          /**
           * #method
           * The schema's rules, then what the reads cannot draw as written
           * (`alignmentsConfigProblems`).
           */
          configProblemsOf(conf: AnyConfigurationModel): string[] {
            return [
              ...superConfigProblemsOf(conf),
              ...alignmentsConfigProblems(
                conf as BaseLinearAlignmentsDisplayConfigModel,
              ),
            ]
          },

          /**
           * #getter
           * Whether the stacked section labels and dividers are drawn. Not
           * `isGrouped`: grouping that yields one section still reserves the
           * label offset (`prefersOffset`) and wants its section named and
           * collapsible. Reads the fetched sections, not `facet` — see
           * `hasNamedGroups`.
           */
          get showsGroupLabels() {
            return hasNamedGroups(self.groupOrder)
          },

          /**
           * #method
           * The text a group's chip shows for its section label
           */
          groupChipLabel(label: string) {
            return label
          },

          /**
           * #getter
           * Chain name → the ids of the READS in it; empty outside chain mode.
           * The key is a chain's own identity and the values are read ids,
           * which consumers resolve through `readIdToIndex` / `readIdIndexMap`
           * (hence `hoverChainReadIds`, `selectedChainReadIds`).
           */
          get readIdsByChainName(): ReadonlyMap<string, string[]> {
            const chained = self.chainAttachment
            return chained ? buildReadIdsByChainName(chained) : new Map()
          },

          /**
           * #getter
           * The fetched regions as `{refName,start,end,displayedRegionIndex}`,
           * the shape every per-read region scan takes (`computeArcsByGroup`).
           * Regions whose fetch has not landed are dropped.
           */
          get loadedRegionInfos() {
            return [...self.loadedRegions.entries()]
              .filter(([idx]) => self.rpcDataMap.has(idx))
              .map(([displayedRegionIndex, r]) => ({
                refName: r.refName,
                start: r.start,
                end: r.end,
                displayedRegionIndex,
              }))
          },

          /**
           * #getter
           * The VIEW's displayed regions in the same shape: not "where did
           * reads come from" but "where can a coordinate be drawn". The arc
           * partition (`CrossRegionArc`) keys on this list, since `view.bpToPx`
           * projects through `displayedRegions` (see `ArcRegions`).
           * `displayedRegions` changes on navigation, not on pan, so
           * `arcsByGroup` keeps its fetch invalidation tier.
           */
          get displayedRegionInfos() {
            const view = self.host
            return view.initialized
              ? view.displayedRegions.map((r, displayedRegionIndex) => ({
                  refName: r.refName,
                  start: r.start,
                  end: r.end,
                  displayedRegionIndex,
                }))
              : []
          },

          /**
           * #getter
           * Normalizer for a refName in the BAM's spelling (an SA tag's or
           * RNEXT's `chr1`) rather than the assembly-canonical one a fetched
           * read has (`1`). Undefined when no assembly is resolved, where
           * consumers fall back to identity. Without it a same-chromosome split
           * junction reads as inter-chromosomal.
           */
          get canonicalRefName() {
            const assembly = self.loadedAssembly
            return assembly
              ? (refName: AdapterRefName) =>
                  canonicalAdapterRefName(assembly, refName)
              : undefined
          },

          /**
           * #getter
           * THE arc resolution: both halves from one pass, read through
           * `arcsByGroup` (arcs inside one region) or `crossRegionArcsByGroup`
           * (arcs joining two). `resolveArcsByGroup` owns the whole fan-out
           * because the pooled arc scale (`poolArcScale`) describes the fetch,
           * not a lane. Hidden lanes must stay out: the cross-group scans
           * (`arcsYDomainBp`, `arcLegendCategories`) walk every entry.
           */
          get arcsResult(): ArcsByGroupResult {
            if (
              self.drawnReadConnections === 'off' ||
              self.rpcDataMap.size === 0
            ) {
              return {
                byGroup: new Map(),
                crossRegionByGroup: new Map(),
                inkGroupKeys: new Set(),
                colorSlots: new Set(),
                maxFlatArcSpanBp: 0,
              }
            }
            return resolveArcsByGroup(
              this.arcCollection,
              {
                loaded: this.loadedRegionInfos,
                displayed: this.displayedRegionInfos,
              },
              {
                cloud: self.drawnReadConnections === 'rule',
                filter: self.connectionFilter,
                showOrdinaryPairs: self.showOrdinaryPairs,
                canonicalRefName: this.canonicalRefName,
              },
            )
          },

          /**
           * #getter
           * The collection half of `arcsResult` (`collectArcs`), which the
           * connectors read for the inter-chromosomal floor with the band
           * off, so both marks drop the same connections.
           */
          get arcCollection() {
            return collectArcs(self.rawDataByGroup, this.loadedRegionInfos, {
              filter: self.connectionFilter,
              canonicalRefName: this.canonicalRefName,
            })
          },

          /**
           * #getter
           * Each group's arcs and ticks by loaded region, every arc filed
           * under the one region holding a foot.
           */
          get arcsByGroup() {
            return this.arcsResult.byGroup
          },

          /**
           * #getter
           * Arcs whose two feet are in different displayed regions, per group.
           * Empty in a single-region view.
           */
          get crossRegionArcsByGroup() {
            return this.arcsResult.crossRegionByGroup
          },
        }
      })
      .views(self => pileupLayoutViews(self))
      .views(self => connectorViews(self))
      .views(self => coverageTicksViews(self))
      .views(self => ({
        /**
         * #getter
         * The drawn lanes that lay out no read rows: every one with Show →
         * Pileup off, else those collapsed to their coverage.
         */
        get rowlessLaneKeys(): ReadonlySet<string> {
          return new Set(
            self.groupOrder
              .map(g => g.key)
              .filter(
                key =>
                  !drawsPileupRows(
                    self.showPileup,
                    self.collapsedGroups.has(key),
                  ),
              ),
          )
        },
      }))
      .views(self => alignmentsColorViews(self))
      .views(self => ({
        /**
         * #getter
         * `laidOutByGroupColored` with the straight-line pass's records
         * spread on, so a curved-connector toggle re-spreads the lines and
         * keeps both the layout and the colors.
         */
        get laidOutByGroup() {
          return attachLinkedReadLinesByGroup(
            self.laidOutByGroupColored,
            self.connectorsByGroup,
          )
        },
      }))
      .views(self => ({
        /**
         * #getter
         * Every read's slot by id, and every slot of a read fetched in more
         * than one displayed region (`buildReadIdIndex`).
         */
        get readIdIndex() {
          return buildReadIdIndex(self.rpcDataMap, self.hiddenGroups)
        },

        /**
         * #getter
         */
        get readIdIndexMap() {
          return this.readIdIndex.byId
        },

        /**
         * #getter
         * Whether a pileup is laid out for an overlay to read — see
         * `readArraysByGroup`.
         */
        get layoutReady() {
          // The too-large term is not redundant: `clearAllRpcData` leaves the
          // gate alone, so a zoom-out into the banner can strand data in
          // `rpcDataMap`.
          return !self.regionTooLarge && self.rpcDataMap.size > 0
        },
      }))
      .views(self => ({
        /**
         * #method
         */
        findFeatureInRpcData(featureId: string) {
          return findRead(self.readIdIndexMap, self.laidOutByGroup, featureId)
        },
      }))
      .views(self => ({
        /**
         * #getter
         * The stacked lanes in stacking order, one `AlignmentLane` per drawn
         * group; ungrouped is the one-lane case. The one place a lane's key
         * resolves to its data.
         */
        get lanes(): AlignmentLane[] {
          return buildLanes({
            order: self.groupOrder,
            rawByGroup: self.rawDataByGroup,
            laidOutByGroup: self.laidOutByGroup,
            arcInkKeys: self.arcsResult.inkGroupKeys,
            sashimiDownKeysByGroup: self.sashimiDownKeysByGroup,
            collapsedKeys: self.collapsedGroups,
            sizes: self.groupSizesInEffect,
            showPileup: self.showPileup,
            fitHeightToDisplay: self.fitHeightToDisplay,
          })
        },

        /**
         * #getter
         * The lanes laid out, or the one SYNTHETIC no-data lane: `sections`
         * must produce a section before any fetch lands, and a grouped fetch
         * over an empty region partitions to zero lanes. Every collection on it
         * is empty.
         */
        get drawnLanes(): AlignmentLane[] {
          return drawnLanesOf(this.lanes)
        },

        /**
         * #method
         * One lane by group key, for the per-key questions a component asks
         * with a `groupKey` in hand. `undefined` for a key that isn't drawn.
         */
        laneFor(key: string) {
          return this.lanes.find(l => l.groupKey === key)
        },

        /**
         * #getter
         * The least height a section takes, so its label chip has room.
         */
        get minSectionHeight() {
          return self.showsGroupLabels ? GROUP_LABEL_HEIGHT : 0
        },

        /**
         * #getter
         * All vertical band geometry, one entry per lane; ungrouped is the
         * one-lane call. Runs over `drawnLanes` so a display with no data still
         * has a section. The sticky-coverage-vs-scroll distinction lives
         * downstream in `buildSectionRenders`.
         */
        get sections() {
          return computeStackedSections(
            this.drawnLanes,
            self.belowCoverageBandsInput,
            {
              rowHeight: self.rowHeight,
              minSectionHeight: this.minSectionHeight,
            },
          )
        },

        /**
         * #getter
         * Every lane with its band geometry in stacking order: the list the
         * overlays, the hit-test pipeline and both renderers walk.
         */
        get renderSections() {
          return this.sections.sections
        },

        /**
         * #getter
         * The pairs the connector mark draws, placed on each drawn section's
         * pileup band, their dips sized to its rows (`rowsHeight`) and ending
         * by `dipFloor`, the bottom of the display measured from that band's
         * top with the display scrolled to its end.
         */
        get connectorPairSections() {
          const bottom = Math.max(this.sections.contentHeight, self.height)
          return this.renderSections.flatMap(sec => {
            const pairs = self.connectorsByGroup.get(sec.groupKey)?.overlayPairs
            return pairs?.length
              ? [
                  {
                    groupKey: sec.groupKey,
                    pileupTop: sec.pileupTop,
                    pileupHeight: sec.rowsHeight,
                    dipFloor: bottom - sec.pileupTop,
                    pairs,
                  },
                ]
              : []
          })
        },

        /**
         * #getter
         * The color types (arc palette slots) drawn in view, by the
         * overlay's curves and by the straight-line pass beside them, so the
         * key lists every connector color on screen. Empty while the legend is
         * hidden so the scan is skipped.
         */
        get connectionColorTypes(): Set<number> {
          return self.showLegend
            ? connectorSlotsInWindows(self.connectorsByGroup, self.keyWindows)
            : new Set<number>()
        },

        /**
         * #method
         * Key for the connection colors drawn: the band's and the pileup
         * connectors', which paint one field through one palette.
         */
        connectionLegendItems(palette: ColorPalette) {
          return getArcLegendItems(
            new Set([
              ...self.arcLegendCategories,
              ...connectorCategories(this.connectionColorTypes),
            ]),
            palette,
            self.keyReadLabels.categories,
          )
        },

        /**
         * #getter
         * `LegendMixin`'s hook: the split-read rows have to name which kind of
         * read they classify, and that is the tree's longest label.
         */
        get legendMaxWidth(): number {
          return LEGEND_MAX_WIDTH
        },

        /**
         * #getter
         * What one row of this pileup is called, for UI text built from the
         * model alone (the group-label chips). Overridable: LGVSyntenyDisplay
         * draws PAF blocks, so its chips must not offer to "show all reads".
         */
        get featureNoun() {
          return 'read'
        },

        /**
         * #getter
         * Everything the right-click's hit test resolved — the block, the
         * clicked column and whichever mark answered. See `ContextMenuHit`.
         */
        get contextMenuHit() {
          return self.contextMenuInfo?.hit
        },

        /**
         * #getter
         * The read id under a right-click, known synchronously unlike
         * `contextMenuFeature`, which lands after an RPC. A menu item that can
         * act from the id alone reads this.
         */
        get contextMenuFeatureId() {
          return self.contextMenuInfo?.featureId
        },

        /**
         * #getter
         * True when reads are stacked into >1 group section. Drives the scroll
         * model: ungrouped keeps coverage sticky; grouped scrolls the whole
         * stack as one.
         */
        get isGrouped() {
          return this.lanes.length > 1
        },

        /**
         * #getter
         * The scroll-projection inputs (`sectionScreen.ts`) every overlay needs
         * to map a content-space Y into screen space.
         */
        get scrollModel(): ScrollModel {
          return {
            isGrouped: this.isGrouped,
            scrollTop: self.scrollTop,
            canvasHeight: self.height,
          }
        },

        /**
         * #getter
         * The band stack held out of the scroll: ungrouped keeps its one
         * lane's bands sticky above the pileup, grouped scrolls the whole
         * stack. Subtracted from both the viewport and the content, and the
         * screen-y a view overlaying this display's reads stops at.
         */
        get stickyBandHeight() {
          return this.isGrouped ? 0 : this.sections.sections[0]!.pileupTop
        },

        /**
         * #getter
         * The px the coverage band reserves, the same in every section: 0
         * while it is off or the plot leaves it no room. What paints it, its
         * axis and its rules all read this.
         */
        get coverageBandHeight() {
          return this.sections.sections[0]!.bands.reserved.coverage
        },

        /**
         * #getter
         * Read `stickyBandHeight`: the pooled band stack this named had no
         * meaning once lanes stack.
         * @deprecated
         */
        get coverageDisplayHeight() {
          return this.stickyBandHeight
        },

        /**
         * #getter
         * Ungrouped excludes the sticky coverage band; grouped scrolls the
         * entire display.
         */
        get scrollViewportHeight() {
          return Math.max(0, self.height - this.stickyBandHeight)
        },

        /**
         * #getter
         * The laid-out `sections` less the sticky band, so a hidden pileup or a
         * collapsed group opens no phantom scroll below the coverage band.
         */
        get scrollContentHeight() {
          return Math.max(
            0,
            this.sections.contentHeight - this.stickyBandHeight,
          )
        },

        /**
         * #getter
         * HeightModeMixin's grow hook: the full laid-out content height
         * (coverage + pileup + arcs), before the `growMaxHeight` cap.
         * Independent of `self.height`: in grow mode `laidOutByGroup` fits to
         * `growMaxHeight` and `featureHeight` is the configured value, so the
         * mixin's `height` can return it without a cycle. With no layout (reads
         * not loaded, or the too-large banner shown) the track keeps its
         * current height.
         */
        get growTargetHeight() {
          return self.layoutReady
            ? this.sections.contentHeight
            : self.fitTargetHeight
        },

        /**
         * #getter
         */
        get visibleLabels() {
          const view = self.host
          if (!view.initialized) {
            return []
          }
          return computeVisibleLabels({
            view,
            sections: this.renderSections,
            height: self.height,
            featureHeight: self.featureHeight,
            featureSpacing: self.featureSpacing,
            showMismatches: self.showMismatches,
            showSoftClips: self.showSoftClips,
            qualityOpacity: self.mismatchQualityOpacity,
            scrollTop: self.scrollTop,
          })
        },

        /**
         * #method
         * Read ids sharing a chain with the named read, its own included. Empty
         * outside chain mode, for a read in no chain, and for an id no fetched
         * region holds. The hover, the right-click pin and the selection all
         * light a chain through it.
         */
        readIdsSharingChainWith(featureId: string) {
          const hit =
            self.unit === 'chain'
              ? self.findFeatureInRpcData(featureId)
              : undefined
          return hit
            ? chainReadIdsAt(hit.rpcData, hit.idx, self.readIdsByChainName)
            : []
        },

        /**
         * #getter
         * Read ids of the selected read's chain, empty outside chain mode.
         */
        get selectedChainReadIds() {
          const id = self.selectedFeatureId
          return id === undefined ? [] : this.readIdsSharingChainWith(id)
        },

        /**
         * #getter
         * Read ids the hover lights as one: the chain of the read or connector
         * under the cursor, else a connector's two ends.
         */
        get hoverChainReadIds() {
          const ends = self.hoveredConnectorReadIds
          const id = self.featureIdUnderMouse ?? ends[0]
          const chain = id === undefined ? [] : this.readIdsSharingChainWith(id)
          return chain.length > 0 ? chain : ends
        },

        /**
         * #method
         */
        getFeatureInfoById(featureId: string) {
          const hit = self.findFeatureInRpcData(featureId)
          const region = hit && self.loadedRegions.get(hit.displayedRegionIndex)
          return hit && region
            ? {
                ...readInfo(hit, region, featureId),
                lodTier: self.rpcDataMap.get(hit.displayedRegionIndex)?.lodTier,
              }
            : undefined
        },

        /**
         * #getter
         * Names one read color bucket for the hover, with the active field's
         * rewording applied — the same `readCategoryLabelOverrides` the legend
         * uses, so the tooltip and its swatch agree.
         */
        get readCategoryLabel() {
          const overrides = readCategoryLabelOverrides(
            self.colorField,
            self.declaredReadLabels.categories,
          )
          return (c: ReadColorCategory) => readColorCategoryLabel(c, overrides)
        },
        /**
         * #getter
         * Names one arc color bucket for the hover in the arc key's wording,
         * so the tooltip and the swatch it sends the reader to agree.
         */
        get arcCategoryLabel() {
          const { categories } = self.declaredReadLabels
          return (c: ArcCategory) => arcColorCategoryLabel(c, categories)
        },
      }))
      .views(self => ({
        /**
         * #getter
         * The reads a view overlaying this display may connect — the
         * BreakpointSplitView's curves — by lane and region index, with hidden
         * lanes dropped. Empty while no pileup is laid out; a lane drawing no
         * rows stays in, and `readLayoutRecord` gives its reads no rect, so an
         * overlay draws no read this display does not.
         */
        get readArraysByGroup(): ReadonlyMap<
          string,
          ReadonlyMap<number, WorkerPileupData>
        > {
          return self.layoutReady ? self.rawDataByGroup : new Map()
        },

        /**
         * #method
         * Layout rect of one read of `readArraysByGroup`, Y in content space:
         * subtract `scrollTop` for the screen. A read past the row cap sits on
         * the cap's overflow row. None while its lane draws no rows (Show →
         * Show pileup off, or a collapsed lane).
         */
        readLayoutRecord(
          groupKey: string,
          displayedRegionIndex: number,
          idx: number,
        ): [number, number, number, number] | undefined {
          const data = self.laidOutByGroup
            .get(groupKey)
            ?.get(displayedRegionIndex)
          const yRow = data?.readYs[idx]
          const start = data?.readPositions[idx * 2]
          const end = data?.readPositions[idx * 2 + 1]
          const section = self.renderSections.find(s => s.groupKey === groupKey)
          const top =
            section && section.rowsHeight > 0 && yRow !== undefined
              ? section.pileupTop + yRow * self.rowHeight
              : undefined
          return top !== undefined && start !== undefined && end !== undefined
            ? [start, top, end, top + self.featureHeight]
            : undefined
        },
      }))
      .views(self => {
        // The regions on screen as a value a pan frame compares equal:
        // `view.visibleRegions` rebuilds fresh objects every frame, and the
        // merge only needs which regions are on screen and what each is called.
        const junctionRegions = stableIdentityComputed(() => {
          const view = self.view
          return view.initialized
            ? view.visibleRegions.map(r => ({
                refName: r.refName,
                displayedRegionIndex: r.displayedRegionIndex,
              }))
            : []
        })
        return {
          /**
           * #getter
           * The junctions each lane draws, merged and filtered, in stacking
           * order. A gesture owes none of it: it reads loaded data, the on-screen
           * region set and the junction filters, and only the count labels
           * (`sashimiLabels`) read the pan. Not a lane
           * field: a lane feeds the LAYOUT, which the on-screen region set must
           * never reach.
           */
          get sashimiJunctionSections() {
            const view = self.view
            if (!self.showSashimi || !view.initialized) {
              return []
            }
            const filter = self.junctionFilter
            const regions = junctionRegions.get()
            return self.renderSections.map(sec => ({
              groupKey: sec.groupKey,
              sashimiDownKeys: sec.sashimiDownKeys,
              junctions: [
                ...mergeJunctions(
                  visibleRegionJunctions(sec.rawPileupMap, regions),
                  filter,
                ).values(),
              ],
            }))
          },

          /**
           * #getter
           * Whether any lane has a junction to draw. What the view's region
           * table and the count labels wait on, so a track of unspliced reads
           * pays for neither.
           */
          get drawsSashimi() {
            return this.sashimiJunctionSections.some(
              sec => sec.junctions.length > 0,
            )
          },

          /**
           * #getter
           * The splice junction strands and split junction classes drawn in
           * `keyWindows`, one key row each. Read off the merged junctions and
           * the settled window rather than the projected arcs, so a pan's
           * frames do not rebuild the legend. A split junction has no
           * transcript strand.
           */
          get sashimiLegendKeys() {
            const strands = new Set<number>()
            const splitClasses = new Set<ArcSplitCategory>()
            if (self.showLegend) {
              const windows = self.keyWindows
              for (const sec of this.sashimiJunctionSections) {
                for (const j of sec.junctions.filter(j =>
                  junctionInWindows(j, windows),
                )) {
                  if (j.split) {
                    splitClasses.add(j.split)
                  } else {
                    strands.add(j.strand)
                  }
                }
              }
            }
            return { strands, splitClasses }
          },

          /**
           * #method
           * The slots of the reads that support the junction, in its lane, or
           * in every drawn lane for a junction naming none.
           */
          sashimiSupportingReadSlots(junction: HoveredJunction) {
            return self.renderSections
              .filter(
                s =>
                  junction.groupKey === undefined ||
                  s.groupKey === junction.groupKey,
              )
              .flatMap(sec =>
                junctionSupportingReadSlots(
                  [...sec.laidOutPileupMap].map(([i, data]) => ({
                    displayedRegionIndex: i,
                    refName: self.loadedRegions.get(i)?.refName,
                    data,
                  })),
                  { ...junction, groupKey: sec.groupKey },
                  self.canonicalRefName,
                ),
              )
          },
        }
      })
      .views(self => readPaletteViews(self))
      .views(self => {
        function themedIn(theme: JBrowsePalette): ThemedSources {
          const colors = computed(() => self.colorsIn(theme))
          const arcFeedsByGroup = computed(() => {
            const { byGroup, crossRegionByGroup } = self.arcsResult
            const displayed = self.displayedRegionInfos
            return new Map(
              [...byGroup].map(([key, byRegion]) => [
                key,
                buildArcBandFeeds({
                  byRegion,
                  crossRegion: crossRegionByGroup.get(key) ?? [],
                  displayed,
                  colors: colors.get(),
                }),
              ]),
            )
          })
          const sashimiFeedsByGroup = computed(() => {
            if (!self.drawsSashimi) {
              return NO_SASHIMI_FEEDS_BY_GROUP
            }
            const displayed = self.displayedRegionInfos
            return new Map(
              self.sashimiJunctionSections.map(sec => [
                sec.groupKey,
                buildSashimiBandFeeds({
                  junctions: sec.junctions,
                  downJunctionKeys: sec.sashimiDownKeys,
                  displayed,
                  colors: colors.get(),
                }),
              ]),
            )
          })
          const connectorFeedsByGroup = computed(() => {
            const { displayedRegions } = self.view
            return new Map(
              self.connectorPairSections.map(sec => [
                sec.groupKey,
                buildConnectorFeeds({
                  pairs: sec.pairs,
                  displayedRegions,
                  featureHeight: self.featureHeight,
                  featureSpacing: self.featureSpacing,
                  pileupHeight: sec.pileupHeight,
                  dipFloorPx: sec.dipFloor,
                  colors: colors.get(),
                  labels: self.declaredReadLabels.categories,
                }),
              ]),
            )
          })
          const sourceSections = computed(() =>
            self.renderSections.map(({ groupKey, laidOutPileupMap }) => ({
              groupKey,
              laidOutPileupMap,
              arcFeeds: arcFeedsByGroup.get().get(groupKey) ?? NO_ARC_FEEDS,
              sashimiFeeds:
                sashimiFeedsByGroup.get().get(groupKey) ?? NO_SASHIMI_FEEDS,
              connectorFeeds:
                connectorFeedsByGroup.get().get(groupKey) ?? NO_CONNECTOR_FEEDS,
            })),
          )
          return {
            get colors() {
              return colors.get()
            },
            get arcFeedsByGroup() {
              return arcFeedsByGroup.get()
            },
            get sashimiFeedsByGroup() {
              return sashimiFeedsByGroup.get()
            },
            get connectorFeedsByGroup() {
              return connectorFeedsByGroup.get()
            },
            get sourceSections() {
              return sourceSections.get()
            },
          }
        }
        return {
          /**
           * #getter
           * The read colors in the session theme and the marks colored from
           * them (`themedIn`).
           */
          get themed(): ThemedSources {
            return themedIn(getPaletteHost(self).palette)
          },

          /**
           * #method
           * The read palette over `theme`, with the category colors `encoding.color`
           * sets, and the read connections and splice junctions colored from
           * it, each joined to its laid-out section. The SVG export passes the
           * theme it renders with. Each member is its own computed, so while
           * `themed` is observed a member rebuilds only when what it reads
           * changes.
           */
          themedIn,

          /**
           * #method
           * How this display's connectors paint a connection between two
           * reads, in `theme`. The breakpoint split view draws its curves
           * between panels through it, so they agree with the arcs and
           * connectors inside each panel.
           */
          connectorStylerIn(theme: JBrowsePalette): ConnectorStyler {
            return connectorStyler({
              colors: self.colorsIn(theme),
              labels: self.declaredReadLabels.categories,
            })
          },

          /**
           * #getter
           * `LegendMixin`'s hook: the read fills, the arc or read-cloud colors,
           * the connection curves and the junction strands, merged and deduped
           * by `getAlignmentsColorScales`. Empty while the legend is hidden,
           * since the category scans are.
           */
          get colorScales(): ColorScale[] {
            return this.colorScalesIn(getPaletteHost(self).palette)
          },

          /**
           * #method
           * `colorScales` in another theme: the SVG export's, whose theme need
           * not be the session's.
           */
          colorScalesIn(theme: JBrowsePalette): ColorScale[] {
            const palette = self.colorsIn(theme)
            return getAlignmentsColorScales({
              ramps: self.colorRamps,
              colorTitle: self.colorKeyTitle,
              legendItems: () => self.legendItems(palette),
              arcLegendTitle: self.arcLegendTitle,
              arcLegendItems: () => self.connectionLegendItems(palette),
              sashimiLegend: sashimiLegend(
                self.sashimiLegendKeys.strands,
                theme.alignmentFill,
                { classes: self.sashimiLegendKeys.splitClasses, palette },
              ),
            })
          },
        }
      })
      .views(self => ({
        /**
         * #getter
         * The read height that makes every lane's reads fill the display
         * without scrolling (`fittedReadPitch`), each lane's section kept at
         * least as tall as its label chip. The uncapped row count uses a fixed
         * `pileup.maxLayoutHeight`-row cap, independent of `featureHeight`, so
         * the fit autorun that writes `featureHeight` cannot feed back into it.
         * Reads `fitTargetHeight`, not the reactive `height` getter — the
         * anti-cycle rule `laidOutByGroup` follows.
         */
        get fittedFeatureHeight() {
          const overheads = self.laneBandOverheads
          return fittedReadPitch({
            lanes: self.fitLaneRows.map((rows, i) => ({
              rows,
              overhead: overheads[i]!,
            })),
            fitTargetHeight: self.fitTargetHeight,
            minLaneHeight: self.minSectionHeight,
          })
        },

        /**
         * #getter
         * The worker receives the tag name alone, so `rpcProps` re-notifies when
         * the tag changes, not when the sort position or a non-tag field flips.
         */
        get sortTag() {
          return fieldTag(self.sortColumn?.field)
        },

        /**
         * #getter
         */
        get renderState() {
          const palette = self.themed.colors
          return {
            scrollTop: self.scrollTop,
            featureHeight: self.featureHeight,
            featureSpacing: self.featureSpacing,
            coverage: {
              height: self.coverageBandHeight,
              domainMin: self.coverageDepthDomain?.[0] ?? 0,
              domainMax: self.coverageDepthDomain?.[1],
              scaleType: self.coverageScaleType,
              // The raw slot means "derive from the domain"; resolved here,
              // where the domain is in hand, so every backend normalizes with
              // one number.
              symlogConstant: resolveSymlogConstant(
                self.coverageDepthDomain?.[0] ?? 0,
                self.coverageDepthDomain?.[1] ?? 0,
                self.symlogConstant,
              ),
              minAlleleFraction: self.coverageMinAlleleFraction,
              showAlleles: self.showCoverageAlleles,
              showInterbase: self.showInterbase,
            },
            showMismatches: self.showMismatches,
            fadeLowFrequency: self.fadeLowFrequency,
            qualityOpacity: self.mismatchQualityOpacity,
            showSoftClips: self.showSoftClips,
            basesField: self.baseLayer?.field,
            sections: buildSectionRenders(self.sections, self.scrollModel),
            // The mixin's resolved canvas box, not `view.width` — see
            // `canvasWidthPx`.
            canvasWidth: self.canvasWidthPx,
            canvasHeight: self.height,
            colors: palette,
            unit: self.unit,
            drawsConnectors: self.drawsConnectors,
            collapseSections: self.collapseSections,
            readConnectionsStrokeScale: self.readConnectionsStrokeScale,
            arcsYDomainBp: this.arcsYDomainBp,
            linkRegions: this.linkRegions,
          }
        },

        /**
         * #getter
         * The view's displayed regions as the band's connections place their
         * feet (`viewRegionTable`), and the splice junctions theirs; empty while
         * the band is off and no lane has a junction, so a pan leaves
         * `renderState` alone on a track that draws neither.
         */
        get linkRegions(): readonly LinkRegion[] {
          return (self.drawnReadConnections === 'off' &&
            !self.drawsSashimi &&
            self.connectorPairSections.length === 0) ||
            !self.view.initialized
            ? NO_LINK_REGIONS
            : viewRegionTable(self.view)
        },

        /**
         * #getter
         * The junction read counts, each at its arc's apex (`sashimiLabels`).
         * The one part of sashimi that reads the pan, and only while the
         * labels are shown; the same empty array otherwise, so the overlay's
         * observer stops.
         */
        get sashimiLabels(): readonly SashimiLabel[] {
          return self.showSashimiLabels && self.drawsSashimi
            ? sashimiLabels(
                this.renderState,
                self.themed.sourceSections.map(sec => sec.sashimiFeeds),
              )
            : NO_SASHIMI_LABELS
        },

        /**
         * #getter
         * The selected splice junction's ink, for the overlay that outlines
         * it. Reads the pan, and only while a junction is selected.
         */
        get selectedSashimiHighlight(): ArcHighlight | undefined {
          const id = self.selectedFeatureId
          return id?.startsWith(SASHIMI_FEATURE_ID_PREFIX)
            ? firstSectionHighlight(
                this.renderState,
                self.renderSections,
                self.themed.sashimiFeedsByGroup,
                (feeds, groupKey, sec, state) =>
                  selectedSashimiHighlight(
                    id,
                    groupKey,
                    feeds,
                    sashimiBandState(state, sec),
                  ),
              )
            : undefined
        },

        /**
         * #getter
         * The connectors of the selected read or chain, for the overlay that
         * outlines them. Reads the pan, and only while one is selected.
         */
        get selectedConnectorHighlight(): ArcHighlight | undefined {
          const id = self.selectedFeatureId
          let highlight: ArcHighlight | undefined
          if (id !== undefined && self.connectorPairSections.length > 0) {
            const selected = new Set([id, ...self.selectedChainReadIds])
            highlight = firstSectionHighlight(
              this.renderState,
              self.renderSections,
              self.themed.connectorFeedsByGroup,
              (feeds, _groupKey, sec, state) =>
                selectedConnectorHighlight(
                  selected,
                  feeds,
                  sec,
                  connectorBandState(state, sec),
                ),
            )
          }
          return highlight
        },

        /**
         * #getter
         * The boxes of the hovered read or chain, for the chrome's highlight.
         * Not in `renderState`: the hovered id changes on nearly every
         * mousemove, and routing it through the canvas would repaint the whole
         * pileup.
         */
        get hoverInk(): HighlightRect[] {
          const junction = self.hoveredJunction
          if (junction) {
            return this.slotInk(
              self.sashimiSupportingReadSlots(junction),
              false,
            )
          }
          const { ids, strong } = this.hoverReads
          return this.readInk(ids, strong)
        },

        /**
         * #getter
         * The reads `hoverInk` boxes, and whether it boxes them as one chain.
         */
        get hoverReads() {
          return readsToLight({
            unit: self.unit,
            chainReadIds: self.hoverChainReadIds,
            readId: self.featureIdUnderMouse,
          })
        },

        /**
         * #getter
         * The boxes of the selected read, or of every read in the selected
         * chain — the same walk as `hoverInk`, so a click repaints the guide's
         * divs, not the canvas. Not in the SVG export, as no display's
         * selection is.
         */
        get selectionInk(): HighlightRect[] {
          const { ids, strong } = readsToLight({
            unit: self.unit,
            chainReadIds: self.selectedChainReadIds,
            readId: self.selectedFeatureId,
          })
          return this.readInk(ids, strong)
        },

        /**
         * #method
         * The boxes the named reads painted, every region's copy, clipped to
         * their sections. Reading `readIdIndex` builds over the whole fetched
         * dataset, so it waits until something is hovered or selected.
         */
        readInk(ids: readonly string[], strong: boolean): HighlightRect[] {
          return ids.length > 0
            ? this.slotInk(slotsOfIds(ids, self.readIdIndex), strong)
            : []
        },

        /**
         * #method
         * The boxes the reads in these slots painted, clipped to their
         * sections.
         */
        slotInk(slots: readonly ReadSlot[], strong: boolean): HighlightRect[] {
          return self.host.initialized && slots.length > 0
            ? readHighlightInk({
                blocks: self.renderBlocks,
                sections: self.renderSections,
                slots,
                state: this.renderState,
                scroll: self.scrollModel,
                strong,
              })
            : []
        },

        /**
         * #getter
         * Floored at 1000bp, so an all-concordant set never divides by near
         * zero.
         */
        get arcsYDomainBp() {
          if (self.drawnReadConnections !== 'rule') {
            return undefined
          }
          // Maxed across every group and both halves by `resolveArcsByGroup`,
          // so all sections share one Y-domain. The largest INSERT SIZE, not
          // the largest drawn Y: the insert-size scale in `valueScales` labels
          // its top tick with this number, and the cloud's ±8% jitter would
          // print a template length no read has.
          return readCloudDomainBp(self.arcsResult.maxFlatArcSpanBp)
        },

        /**
         * #getter
         * Overrides `ScoreScaleMixin`'s: `coverage.encoding.y.rules` are depths, so they
         * draw on the coverage band, while it reserves px.
         */
        get scoreRulesDrawn(): boolean {
          return self.coverageBandHeight > 0
        },

        /**
         * #getter
         * The scales the chrome places the axes from. Coverage rules one band
         * per section, on the right wherever the group label chips take the
         * left edge. The read cloud's insert-size scale rules each section's arc band,
         * captioned TLEN. Each band projects through its section's own scroll;
         * the chrome drops the off-screen ones.
         */
        get valueScales(): ValueScale[] {
          const { scrollModel: scroll, renderSections } = self
          const scales: ValueScale[] = []
          if (self.coverageBandHeight > 0 && self.coverageDepthDomain) {
            scales.push({
              domain: self.coverageDepthDomain,
              scaleType: self.scaleType,
              height: self.coverageBandHeight,
              ticks: self.coverageTicks,
              side: self.showsGroupLabels ? 'right' : 'left',
              symlogConstant: self.symlogConstant,
              ...self.axisGuide,
              bandTops: renderSections.map(section =>
                bandScreenTop(section.coverageTop, scroll),
              ),
            })
          }
          const arcsYDomainBp = this.arcsYDomainBp
          const banded = renderSections.flatMap(s =>
            s.arcBand && s.arcBand.height > 0 ? [s.arcBand] : [],
          )
          const band = banded[0]
          if (arcsYDomainBp !== undefined && band) {
            const down = self.readConnectionsPlacement === 'down'
            const ticks = computeInsertSizeTicks({
              band: { top: 0, height: band.height, down },
              arcsYDomainBp,
            })
            if (ticks) {
              scales.push({
                domain: [1, arcsYDomainBp],
                scaleType: 'log',
                height: band.height,
                ticks,
                side: down ? 'left' : 'right',
                caption: 'TLEN',
                bandTops: banded.map(arcBand =>
                  bandScreenTop(arcBand.top, scroll),
                ),
              })
            }
          }
          return scales
        },
      }))
      .views(self => ({
        /**
         * #method
         * Fields that invalidate the fetched data, every one worker-bound.
         * Arc-only fields (`readConnections` and the connection filter) are
         * not here: `arcsResult` reads them and they need no refetch. Non-tag
         * sort changes and tag coloring (`readFillColors`, baked in
         * `laidOutByGroup`) stay main-thread. It is defined in a separate views
         * block, after every field it reads, so it reads them off `self`: a subclass override
         * captures the base as a bare function, which would lose a `this`.
         */
        rpcProps() {
          return {
            filter: self.readPredicates,
            // Only a field the worker reads, so switching between
            // shader-decided fields leaves these props identical and repaints
            // without a refetch.
            colorField: workerColorField(self.colorField),
            tooltipField: self.tooltipField,
            baseLayer: self.baseLayer,
            // Chain layout reads neither the sort tag nor soft-clipped bases,
            // so chain mode sends neither and "Show soft clipping" stays live
            // there.
            sortTag: self.unit === 'chain' ? undefined : self.sortTag,
            facet: workerFacet(self.effectiveFacet, self.unit),
            pinnedInsertSizeBand: workerInsertSizeBand(
              self.effectiveFacet,
              self.readPredicates,
              self.pinnedInsertSizeBand,
            ),
            showSoftClips: self.unit === 'chain' ? false : self.showSoftClips,
            // The worker skips the whole coverage-band pipeline, including the
            // per-bp GPU depth buffer that overflows the device limit at
            // chromosome scale, when the band is off.
            showCoverage: self.showCoverage,
            interbaseIndicators: self.interbaseIndicatorRule,
            // The junctions ride with coverage, so a sashimi toggle with the
            // band shown refetches nothing; without it they ride with the arcs.
            // A display without the sashimi band fetches none.
            junctions:
              self.hasSashimi && (self.showCoverage || self.showSashimi),
            // `readConnections` is not here: the SA tag walk it could gate also
            // feeds linked reads and the curved connectors (see
            // `extractFeatureArrays`).
          }
        },

        /**
         * #getter
         * Overridable hook (default undefined: whatever the adapter picks): the
         * detail tier a fetch issued now asks a tiered adapter for, off the
         * settled zoom. `LGVSyntenyDisplay` resolves it for tiered PIF
         * adapters. In `zoomFetchArgs`, not `rpcProps`, like `perBaseBinBp`.
         */
        get lodTier(): LodTier | undefined {
          return undefined
        },

        /**
         * #getter
         * Overridable hook: the same tier off the LIVE zoom, read by
         * `dataSuperseded` alone — see `livePerBaseBinBp` for the window it
         * covers.
         */
        get liveLodTier(): LodTier | undefined {
          return undefined
        },

        /**
         * #getter
         * Genomic bp one per-base cell stands for in the worker's extract: the
         * foundation's `settledSubPixelBinBp`, and `1` in every color mode that
         * does not paint a wall of them. Per-base quality and lettering emit an
         * entry per aligned base of every read, so sampling one base per
         * sub-pixel window bounds the extract by the viewport, not the region.
         * Not an `rpcProps` field — see `zoomFetchArgs`.
         */
        get perBaseBinBp() {
          return paintsEveryBase(self.baseLayer) ? self.settledSubPixelBinBp : 1
        },

        /**
         * #getter
         * The same bin off the LIVE zoom, read by `dataSuperseded` alone. The
         * debounced bin is the one the held data was fetched under, so it cannot
         * show whether that data is sampled finely enough. Kept out of
         * `zoomFetchArgs` because `FetchVisibleRegions` runs on the leading
         * edge: a live key would refetch at every octave a fast gesture passes.
         */
        get livePerBaseBinBp() {
          const view = self.view
          return paintsEveryBase(self.baseLayer) && view.initialized
            ? subPixelBinBp(view.bpPerPx)
            : 1
        },

        /**
         * #getter
         */
        get hoveredFeature() {
          const featId = self.featureIdUnderMouse
          if (!featId) {
            return undefined
          }
          const info = self.getFeatureInfoById(featId)
          if (!info) {
            return undefined
          }
          return new SimpleFeature({
            uniqueId: info.id,
            name: info.name === '' ? info.id : info.name,
            start: info.start,
            end: info.end,
            refName: info.refName,
            strand: info.strand,
            flags: info.flags,
            score: info.mapq,
            MAPQ: info.mapq,
          })
        },
      }))
      .views(self => ({
        /**
         * #method
         * `MultiRegionDisplayMixin`'s per-region content axis: the zoom-derived
         * worker arguments, which the fetch spreads into its RPC and the
         * foundation stamps beside every region it loads. Only the per-base bin
         * and the detail tier move it, so a zoom refetches the regions on
         * screen only when one flips; neither is in `rpcProps`. Its own views
         * block, after the getters it reads, like `rpcProps`.
         */
        zoomFetchArgs() {
          return { perBaseBinBp: self.perBaseBinBp, lodTier: self.lodTier }
        },
        /**
         * #method
         * Save track data's reads, outside the lanes the user hid: every read
         * the coverage counts for a depth, the drawn ones for a read format.
         * The worker samples, lanes and filters them as it does to render, so
         * the file agrees with the bands and the pileup. After `rpcProps`,
         * whose filter and facet it sends.
         */
        fetchExportedFeatures(request: ExportedFeaturesRequest) {
          return fetchExportedReads(self, request)
        },
      }))
      .views(self => ({
        /**
         * #getter
         * `MultiRegionDisplayMixin`'s supersession hook: the settled per-base
         * bin or detail tier has not moved yet, but the live zoom has left it,
         * so the clear is inevitable and not yet committed. Only the debounce
         * half is here: once the settled bin moves, the stamp stops matching
         * `fetchInputs` and the foundation's `isCacheValid` covers it. A value
         * compare, never a second derivation of `zoomFetchArgs`: restated args
         * would latch this true the day they grow a field, and a latched
         * supersession hangs an export until `awaitSvgReady` times out.
         */
        get dataSuperseded(): boolean {
          return (
            self.perBaseBinBp !== self.livePerBaseBinBp ||
            self.lodTier !== self.liveLodTier
          )
        },
      }))
      .views(self => ({
        /**
         * #getter
         * The mixin's hook: the collapses and per-group height overrides
         * `dropGroupState` clears below.
         */
        get ownGroupState() {
          return [
            [...self.collapsedGroups].sort((a, b) => a.localeCompare(b)),
            Object.fromEntries(self.groupSizes),
          ]
        },
      }))
      .views(self => ({
        /**
         * #method
         * The color the Group by dialog's choice of field writes: a color by
         * the field when ticked, left alone while it already paints; and,
         * unticked, the plain fill only where the reads paint the field
         * chosen, or for None the field it leaves, so regrouping keeps a
         * color by another field. The feature display's rule too. Undefined
         * where the color stays as it is.
         */
        groupByColor(field: string | undefined, colorByGroup: boolean) {
          const grouping = field ?? self.facet?.field
          return colorByGroup && field !== undefined
            ? field === self.colorField
              ? undefined
              : colorForField(self.writtenColor, field, self.parkedColor)
            : grouping !== undefined && grouping === self.colorField
              ? colorForField(self.writtenColor, undefined)
              : undefined
        },
        /**
         * #method
         * The Group by dialog's choice of field as plot settings, which its
         * Apply writes and its Edit plot button shows.
         */
        groupByPlot(field: string | undefined, colorByGroup: boolean): Plot {
          return groupByPlotOf(
            self.writtenFacet,
            field,
            this.groupByColor(field, colorByGroup),
          )
        },
      }))
      .actions(self => ({
        /**
         * #action
         * What the Group by dialog applies: `groupByPlot`, the draft its Edit
         * plot button shows, as one write.
         */
        applyGroupBy(field: string | undefined, colorByGroup: boolean) {
          const color = self.groupByColor(field, colorByGroup)
          if (color) {
            self.parkColor('color', self.writtenColor, color)
          }
          self.applyPlot(self.groupByPlot(field, colorByGroup))
        },
        /**
         * #action
         * "Edit plot...", seeded with a draft a dialog has not applied.
         */
        openPlotDialog(seed?: Plot) {
          queuePlotDialog(self, seed)
        },
      }))
      .actions(self => ({
        /**
         * #action
         * Collapse/expand a stacked group's pileup (coverage stays visible).
         */
        toggleGroupCollapsed(key: string) {
          if (self.collapsedGroups.has(key)) {
            self.collapsedGroups.delete(key)
          } else {
            self.collapsedGroups.add(key)
          }
        },

        /**
         * #action
         * The mixin's hook: the collapses and per-group height overrides,
         * both of which use group keys.
         */
        dropGroupState() {
          self.collapsedGroups.clear()
          self.groupSizes.clear()
          self.scrollTop = 0
        },
      }))
      .actions(self => {
        const superSetError = self.setError
        const superSetHeightMode = self.setHeightMode
        const superCloseContextMenu = self.closeContextMenu
        function clearMouseoverState() {
          self.featureIdUnderMouse = undefined
          self.mouseoverExtraInformation = undefined
          self.overCigarItem = false
          self.hoverCoverageBand = undefined
          self.hoveredArcHighlight = undefined
          self.hoveredJunction = undefined
          if (self.hoveredConnectorReadIds.length > 0) {
            self.hoveredConnectorReadIds = []
          }
        }
        function writeSort(sort: SortSetting) {
          setConf(
            self,
            'sort',
            typeof sort === 'string' ? { field: sort } : sort,
          )
        }
        return {
          /**
           * #action
           */
          clearMouseoverState,

          /**
           * #action
           * What a cursor leaving a read or connector calls. `setHoverState`
           * refuses writes while the right-click menu pins the hover, so the
           * leave refuses them too. `clearMouseoverState` is the unconditional
           * form, for `closeContextMenu`.
           */
          clearHoverUnlessPinned() {
            if (!self.contextMenuInfo) {
              clearMouseoverState()
            }
          },

          /**
           * #action
           */
          setError(error?: unknown) {
            superSetError(error)
            if (error) {
              clearMouseoverState()
            }
          },

          /**
           * #action
           * Stage a region as fetched, with this display's payload shape — so
           * a test stands up a loaded display in one call. Production goes
           * through `ctx.commitRegion`.
           */
          setRpcData(
            displayedRegionIndex: number,
            data: GroupedAlignmentsResult,
            region: Region,
          ) {
            self.setLoadedRegion(displayedRegionIndex, region, data)
          },

          /**
           * #action
           */
          clearSelection() {
            const session = getSession(self)
            if (isFeature(session.selection)) {
              session.clearSelection()
            }
          },

          /**
           * #action
           * The picker Color by's Solid color... opens, on the theme's plain
           * read fill until a constant is written.
           */
          openSolidColorDialog() {
            const written = self.colorSetting.value
            getDialogHost(self).queueDialog(handleClose => [
              SolidColorDialog,
              {
                label: 'Read color',
                color: written ?? rgb255(self.themed.colors.colorPairLR),
                written,
                onChange: (color: string) => {
                  self.setColorValue(color)
                },
                onReset: () => {
                  self.setColorValue(undefined)
                },
                handleClose,
              },
            ])
          },

          /**
           * #action
           * Writes the `pileup.bases` members the patch names, as one
           * action so a layer and its filter refetch once. The read fill is
           * `colorByField`'s and stays as it is.
           */
          setBases({ show, field, unmodified, filter }: BasesPatch) {
            const conf = requireReadsConf(self)
            const { bases } = conf.pileup
            const color = bases.encoding.color
            if (
              field !== undefined &&
              field !== readConfObject(color, 'field')
            ) {
              setConf(
                conf,
                ['pileup', 'bases', 'encoding', 'color'],
                colorForField(writtenColorOf(color), field),
              )
            }
            if (show !== undefined) {
              setConf(conf, ['pileup', 'bases', 'show'], show)
            }
            if (unmodified !== undefined) {
              setConf(
                conf,
                ['pileup', 'bases', 'unmodified', 'show'],
                unmodified,
              )
            }
            if (filter) {
              setConf(
                conf,
                ['pileup', 'bases', 'filter'],
                withBasesFields(predicatesOf(bases.filter), filter),
              )
            }
          },

          /**
           * #action
           */
          sortAtCenterLine(field: ColumnSortField) {
            const view = self.view
            const { centerLineInfo } = view
            // Every column sort ranks by membership at `pos`
            // (`partitionBySort`), so reveal the center line either way.
            view.setShowCenterLine(true)
            if (centerLineInfo && !centerLineInfo.oob) {
              writeSort({
                field,
                // `offset` counts bp INTO the region, the worker compares
                // absolute `readPositions`, and a reversed region mirrors the
                // base drawn here: go through `basePaintedAt`, as the
                // context-menu sort does.
                pos: basePaintedAt(centerLineInfo, centerLineInfo.offset),
                refName: centerLineInfo.refName,
              })
            } else {
              getNotificationSink(self).notify(
                'Cannot sort: the view center line is not over a valid position. Scroll so the center line is within a region and try again.',
                'warning',
              )
            }
          },

          /**
           * #action
           * The one writer of `sort`: a whole-window order, or a column sort.
           */
          setSort: writeSort,

          /**
           * #action
           * Draw each group as one row, overlap depth shown as tint. Clears the
           * per-group height overrides: an override opts a lane out of the
           * collapse, which means nothing once every lane is a stack again.
           */
          setCollapseSections(flag: boolean) {
            setConf(self, ['pileup', 'collapsed'], flag)
            self.groupSizes.clear()
            self.scrollTop = 0
          },

          /**
           * #action
           * Lift a group's cap to `pileup.maxLayoutHeight` without padding its
           * band, or, if a drag or an earlier expand already sized it, return
           * the group to the fit budget. Expanding overflows the viewport,
           * which engages the pileup scroll.
           */
          toggleGroupExpanded(key: string) {
            if (self.groupSizes.has(key)) {
              self.groupSizes.delete(key)
            } else {
              self.groupSizes.set(key, 'all')
            }
          },

          /**
           * #action
           * A stacked group's pileup band height, whole, and floored at one row
           * and at what keeps the section as tall as its label chip: below
           * that the section's bottom edge, where its drag handle sits, stops.
           * It caps the group's rows (`maxRowsFor`) and pads the band where the
           * rows fall short (`minPileupHeight`), so the band follows a drag in
           * both directions, past its content too.
           */
          setGroupHeight(key: string, height: number) {
            const section = self.renderSections.find(s => s.groupKey === key)
            if (section) {
              const bandsAbove = section.pileupTop - section.coverageTop
              self.groupSizes.set(
                key,
                Math.max(
                  self.rowHeight,
                  self.minSectionHeight - bandsAbove,
                  Math.round(height),
                ),
              )
            }
          },

          /**
           * #action
           * Set the per-read pixel size. Grow keeps growing at the new size.
           * Fit derives the size, so a chosen size would be dormant: picking
           * one drops back to fixed.
           */
          setMarkHeight(height?: number) {
            if (self.fitHeightToDisplay) {
              self.setHeightMode('fixed')
            }
            setConf(self, ['pileup', 'mark', 'height'], height)
            self.scrollTop = 0
          },

          /**
           * #action
           */
          setPileupMaxLayoutHeight(height?: number) {
            setConf(self, ['pileup', 'maxLayoutHeight'], height)
            self.scrollTop = 0
          },

          /**
           * #action
           * The two pieces of transient state a uniform fit/grow contradicts
           * that HeightModeMixin can't know about. The slot write and the
           * scroll reset are its `setHeightMode`, captured as super above.
           */
          setHeightMode(mode: HeightMode) {
            superSetHeightMode(mode)
            if (mode !== 'fixed') {
              self.groupSizes.clear()
            }
            // Seed the fitted pitch in the same transaction, so the first
            // render draws reads at the fit height instead of snapping from the
            // configured one when the autorun ticks.
            if (mode === 'fit') {
              self.fittedHeightPx = self.fittedFeatureHeight
            }
          },

          /**
           * #action
           * Caches the fitted read height; `featureHeight`/`featureSpacing`
           * split it into a body and a derived gap. Written only by the driving
           * autorun.
           */
          setFittedHeightPx(px: number) {
            self.fittedHeightPx = px
          },

          /**
           * #action
           */
          setCoverageHeight(height: number) {
            setConf(
              self,
              ['coverage', 'height'],
              dragBelowCoverageBand(
                self.belowCoverageBandsInput,
                'coverage',
                self.bandPlot,
                height,
              ),
            )
          },

          /**
           * #action
           */
          setReadConnectionsHeight(height: number) {
            setConf(
              self,
              ['readConnections', 'height'],
              dragBelowCoverageBand(
                self.belowCoverageBandsInput,
                'readConnections',
                self.bandPlot,
                height,
              ),
            )
          },

          /**
           * #action
           */
          setSashimiHeight(height: number) {
            setConf(
              requireReadsConf(self),
              ['sashimi', 'height'],
              dragBelowCoverageBand(
                self.belowCoverageBandsInput,
                'sashimi',
                self.bandPlot,
                height,
              ),
            )
          },

          /**
           * #action
           * A new unit restacks the whole pileup, so the scroll resets: the
           * `scrollableHeight` clamp catches only a shorter stack.
           */
          setUnit(unit: AlignmentsUnit) {
            const prev = self.unit
            setConf(self, 'unit', unit)
            if (prev === unit) {
              return
            }
            self.scrollTop = 0
            clearMouseoverState()
            // The toggle swaps the plain fill and the SV-signal fill only: a
            // first-of-pair strand picked for RNA-seq survives a trip through
            // pairs. A solid color is the plain fill here, so pairs paint over
            // it and it comes back on leaving (kept by Colin, 2026-11-08).
            // Under a per-base layer the plain fill is the backdrop its marks
            // read against, so neither direction swaps.
            const [from, to] =
              unit === 'read'
                ? (['insertSizeAndOrientation', undefined] as const)
                : ([undefined, 'insertSizeAndOrientation'] as const)
            if (self.colorField === from && !self.baseLayer) {
              self.colorByField(to)
            }
            // No refetch: chain identity is joined on the main thread
            // (`chainAttachment`). A facet in effect refetches, since it
            // changes the unit the worker keeps whole (`workerFacet`).
          },

          /**
           * #action
           * The whole hover state in one action, so no branch of the mousemove
           * handler leaves a field stale. Refused while the right-click menu is
           * open, since `openContextMenu` pins the hover to the read the menu
           * acts on.
           */
          setHoverState(state: {
            overCigarItem: boolean
            featureIdUnderMouse: string | undefined
            mouseoverExtraInformation: TooltipPayload | undefined
            hoverCoverageBand?: HoverCoverageBand
            // Optional and ALWAYS assigned, like `hoverCoverageBand`: a branch
            // with no arc clears the highlight by not mentioning one.
            hoveredArcHighlight?: ArcHighlight
            hoveredJunction?: HoveredJunction
            hoveredConnectorReadIds?: string[]
          }) {
            if (self.contextMenuInfo) {
              return
            }
            self.overCigarItem = state.overCigarItem
            self.featureIdUnderMouse = state.featureIdUnderMouse
            self.mouseoverExtraInformation = state.mouseoverExtraInformation
            self.hoverCoverageBand = state.hoverCoverageBand
            self.hoveredArcHighlight = state.hoveredArcHighlight
            // Write only on a real change: a fresh junction or an equal array
            // invalidates `hoverInk`, an O(reads) rebuild per mousemove.
            if (
              !sameLaneJunction(self.hoveredJunction, state.hoveredJunction)
            ) {
              self.hoveredJunction = state.hoveredJunction
            }
            const ends = state.hoveredConnectorReadIds ?? []
            if (!sameStrings(self.hoveredConnectorReadIds, ends)) {
              self.hoveredConnectorReadIds = ends
            }
          },

          /**
           * #action
           */
          setContextMenuFeature(feature?: Feature) {
            self.contextMenuFeature = feature
          },

          /**
           * #action
           * Close the right-click menu and release the hover it pinned.
           * `setHoverState` refuses writes while the menu is up, so this is the
           * only place the pin comes off.
           */
          closeContextMenu() {
            superCloseContextMenu()
            self.contextMenuFeature = undefined
            clearMouseoverState()
          },

          /**
           * #action
           */
          selectFeature(feature: Feature) {
            openFeatureWidget(self, feature.toJSON(), {
              widget: self.featureWidgetType,
            })
          },
        }
      })
      .actions(self => ({
        /**
         * #action
         */
        startRenderingBackend(backend: AlignmentsRenderingBackend) {
          installUpload(self, backend, {
            // A fresh object every run, so every run reaches the renderer,
            // which holds the memo of what it last sent
            // (GPU_DISPLAY_LIFECYCLE.md, the whole-map sync).
            cells: () =>
              oneCell('sources', {
                sections: self.themed.sourceSections,
              }),
            // `hasRegionData` is the per-REGION store, not a group's laid-out
            // map: a grouped fetch over a region with no reads partitions to
            // zero groups, and gating on the map would leave the loading
            // overlay up forever.
            render: b =>
              self.hasRegionData
                ? b.renderBlocks(self.renderBlocks, self.renderState)
                : false,
          })
        },
      }))
      .actions(self => {
        const superOpenContextMenu = self.openContextMenu
        // The one place a feature is resolved from an id: menu items are
        // offered from the id alone and land here on click, and opening the
        // menu pre-warms `contextMenuFeature` through the same call. `onMiss`
        // is passed at every call because a user-initiated item must say the
        // lookup failed, while the speculative pre-warm stays quiet.
        async function withFeature(
          featureId: string,
          onFeat: (feat: Feature) => void,
          onMiss: () => void,
        ) {
          await withFeatureDetails(
            self,
            () => fetchFeatureDetails(self, featureId),
            onFeat,
            onMiss,
          )
        }
        function notifyMiss() {
          notifyFeatureDetailsMiss(self)
        }
        return {
          /**
           * #action
           * Fetch the feature behind `featureId` and hand it to `onFeat`. For a
           * menu item that needs the whole feature but is offered before one is
           * in hand.
           */
          async withFeatureById(
            featureId: string,
            onFeat: (feat: Feature) => void,
          ) {
            await withFeature(featureId, onFeat, notifyMiss)
          },
          /**
           * #action
           */
          async selectFeatureById(featureId: string) {
            await withFeature(
              featureId,
              feat => {
                self.selectFeature(feat)
              },
              notifyMiss,
            )
          },
          /**
           * #action
           * Open the right-click menu over a hit. The block, the clicked column
           * and the mark hit arrive as one `ContextMenuHit`, so a consumer
           * cannot read a block without its hit. Resets the read feature and,
           * when the hit has one, fills it by async RPC, so a repositioned
           * menu cannot inherit the prior read's items. Also clears the hover,
           * then re-pins the highlight box on the menu's read, in that order.
           */
          openContextMenu(info: AlignmentsContextMenuInfo) {
            self.clearMouseoverState()
            superOpenContextMenu(info)
            self.contextMenuFeature = undefined
            // Pin the hover to the menu's target read so its highlight box
            // (`hoverInk`) stays on while the menu is open; undefined for
            // coverage/indicator hits.
            self.featureIdUnderMouse = info.featureId
            const { featureId } = info
            if (featureId !== undefined) {
              void withFeature(
                featureId,
                feat => {
                  // Only if the menu is still open over this read: a second
                  // right-click repositions the menu without closing it, and a
                  // first lookup resolving last would publish the previous
                  // read's feature.
                  if (self.contextMenuFeatureId === featureId) {
                    self.setContextMenuFeature(feat)
                  }
                },
                // Speculative: the menu is already open and usable without it.
                () => {},
              )
            }
          },
        }
      })
      .actions(self => {
        return {
          /**
           * #action
           */
          async fetchNeeded(needed: IndexedRegion[]) {
            await fetchEachRegion(self, needed, {
              call: (region, ctx) => fetchFeaturesForRegion(self, region, ctx),
              onResult: (_displayedRegionIndex, result) => result,
            })
          },
        }
      })
      .views(() => ({
        // #region byteGate
        /**
         * #getter
         * Opt into RegionTooLargeMixin's byte gate: `fetchNeeded` passes
         * `resolvedByteLimit()` to `RenderAlignmentData`, whose first await is
         * the index estimate, so an over-budget region is refused before a read
         * downloads.
         */
        get gateEnabled() {
          return true
        },
        // #endregion
      }))
      .views(self => ({
        /**
         * #method
         * Track menu items
         */
        trackMenuItems() {
          const pileupGate = {
            disabled: !self.showPileup,
            disabledHelpText:
              'Turn on Show → Show pileup to change read height',
          }
          // Where the band switches live is settled (Coverage, Pileup and
          // Sashimi arcs in "Show...", the pair band in "Read connections"),
          // so a menu review leaves them there.
          return [
            getReadsColorByMenuItem(self),
            getSortMenuItem(self, {
              disabledHelpText: self.sortReadsBlockedReason,
            }),
            ...getFiltersMenuItems(self, {
              readCategories: true,
              more: getJunctionFilterItems(self),
              counts: field => filterFieldInEffect(field, layersInEffect(self)),
              narrowings: { bases: basesFilterNarrowing(self) },
            }),
            getGroupByMenuItem(self),
            ...getReadsMenuItems(self),
            getFeatureHeightMenuItem(self, self.featureNoun, pileupGate),
            getReadConnectionsMenuItem(self),
            getPresetsMenuItem(self),
            ...editPlotMenuItems(self, [
              ...getCoverageMenuItems(self),
              ...getTrackSizingItems(self, pileupGate),
              ...getReadConnectionsBandItems(self),
              ...getSashimiPlacementItems(self),
            ]),
          ] satisfies MenuItem[]
        },

        /**
         * #method
         */
        contextMenuItems() {
          // Same gate as the track menu's "Sort by": these write the same
          // slot.
          return getContextMenuItems(self, { sort: self.canSortReads })
        },
      }))
      .actions(self => ({
        /**
         * #action
         */
        async renderSvg(opts?: ExportSvgDisplayOptions) {
          const { renderSvg } = await import('./renderSvg.tsx')
          return renderSvg(self as LinearAlignmentsDisplayModel, opts)
        },

        /**
         * #action
         * Fills `BaseDisplay`'s hover-clear hook, which the fetch foundation's
         * reaction calls on every viewport change. A pan, zoom or internal
         * scroll under a stationary cursor fires no mousemove or mouseleave, so
         * the highlight and tooltip would keep naming the read that was there.
         */
        clearHoveredFeature() {
          // A pinned hover goes too: no route was found where a pan under an
          // open menu needs the pin kept (declined 2026-11-08).
          self.clearMouseoverState()
        },

        afterAttach() {
          // Fills `fittedHeightPx` while fitting. An autorun, not a getter:
          // `fittedFeatureHeight` reads late layout getters that the EARLY
          // `featureHeight` cannot reference, and the volatile bridges that
          // ordering. `fittedFeatureHeight` ignores `featureHeight`, so the
          // write cannot loop.
          addDisposer(
            self,
            autorun(
              () => {
                if (self.fitHeightToDisplay) {
                  self.setFittedHeightPx(self.fittedFeatureHeight)
                }
              },
              { name: 'AlignmentsFitHeight' },
            ),
          )

          // Scroll to the top on a real region-list change (chromosome
          // navigation), not on the same-region refetch a zoom or settings
          // write issues.
          onDisplayedRegionsChange(
            self,
            () => {
              self.setScrollTop(0)
            },
            'AlignmentsResetScrollOnDisplayedRegions',
          )
        },
      }))
  )
}

// Re-exported so LGVSyntenyDisplay's emitted .d.ts can name every type the
// inferred model mentions; without it the ESM build reports TS2883.
export type { ArcCategory } from '../shaders/palettes.ts'
export type { InsertSizeBand } from '../shared/insertSizeStats.ts'
export type { OverlapLegendRow } from '../shared/legendUtils.ts'
export type { DeclaredFilters } from './dialogs/layerFilters.ts'
export type { GroupLayoutContext, GroupSize } from './groupLayout.ts'

export type LinearAlignmentsDisplayStateModel = ReturnType<
  typeof stateModelFactory
>
// interface (not type alias) breaks the circular reference TypeScript would
// encounter through React.lazy → PileupComponent → useAlignmentsBase → model
export interface LinearAlignmentsDisplayModel extends Instance<LinearAlignmentsDisplayStateModel> {}

declare module '@jbrowse/core/PluginManager' {
  interface DisplayTypeRegistry {
    LinearAlignmentsDisplay: LinearAlignmentsDisplayStateModel
  }
}
