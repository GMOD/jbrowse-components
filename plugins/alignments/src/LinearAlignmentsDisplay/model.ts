import { lazy } from 'react'

import {
  coverageAutoscaleViews,
  coverageDomainViews,
  coverageStatsViews,
  coverageTicksViews,
} from '@jbrowse/alignments-core'
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
  getSession,
  isFeature,
  notifyFeatureDetailsMiss,
  openFeatureWidget,
  SimpleFeature,
  withFeatureDetails,
} from '@jbrowse/core/util'
import { basePaintedAt } from '@jbrowse/core/util/Base1DUtils'
import { predicatesOf } from '@jbrowse/core/util/fieldPredicate'
import { bandChipsShown } from '@jbrowse/display-kit/BandChips'
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
import { bandChipRowWidth } from '@jbrowse/display-kit/groupLabelStyle'
import { keyWindowsOf } from '@jbrowse/display-kit/keyWindows'
import {
  editPlotMenuItems,
  openPlotDialog as queuePlotDialog,
} from '@jbrowse/display-kit/plotMenu'
import { sectionsMenuItems } from '@jbrowse/display-kit/sectionsMenu'
import { stableIdentityComputed } from '@jbrowse/display-kit/stableIdentityComputed'
import { subPixelBinBp } from '@jbrowse/display-kit/subPixelBinBp'
import { viewRegionTable } from '@jbrowse/display-kit/viewRegionTable'
import { addDisposer, types } from '@jbrowse/mobx-state-tree'
import { containingLgv } from '@jbrowse/plugin-linear-genome-view'
import { installUpload, oneCell } from '@jbrowse/render-core/installUpload'
import { ScoreScaleMixin } from '@jbrowse/wiggle-core'
import { autorun, observable } from 'mobx'

import { withBasesFields } from '../shared/basesFilter.ts'
import { paintsEveryBase } from '../shared/colorFieldDefs.ts'
import {
  facetValueNotices,
  overflowSplitNotices,
  sectionOrder,
} from '../shared/groupFeatures.ts'
import {
  LEGEND_MAX_WIDTH,
  arcColorCategoryLabel,
  readCategoryLabelOverrides,
  readColorCategoryLabel,
} from '../shared/legendUtils.ts'
import {
  alignmentsColorViews,
  detectedModificationsOf,
  readPaletteViews,
} from './alignmentsColorViews.ts'
import { sortOf } from './alignmentsSortConfigSchema.ts'
import { bandChipLabel } from './bandChips.ts'
import {
  bandStackViews,
  dragStripHeight,
  junctionsStripViews,
} from './bandStackViews.ts'
import { buildReadIdsByChainName } from './chainFields.ts'
import { rgb255 } from './colorUtils.ts'
import { computeVisibleLabels } from './components/computeVisibleLabels.ts'
import { nonReferenceAt } from './components/positionStats.ts'
import { bandScreenTop } from './components/sectionScreen.ts'
import {
  alignmentsConfigProblems,
  configSlotActions,
  configSlotViews,
  requireReadsConf,
} from './configSlotViews.ts'
import { connectionKeyViews } from './connectionKeyViews.ts'
import { bandPlotViews, shownGroupCoverage } from './coverageScaleViews.ts'
import { filterFieldInEffect, layersInEffect } from './dialogs/layerFilters.ts'
import { fetchExportedReads } from './exportedReads.ts'
import { fitViews } from './fitViews.ts'
import { fittedReadPitch } from './groupLayout.ts'
import {
  buildReadIdIndex,
  eachGroup,
  orderedGroups,
  splitOverflowKeys,
} from './groupedDataMaps.ts'
import { highlightViews } from './highlightViews.ts'
import { nextHover } from './hoverState.ts'
import { computeInsertSizeTicks } from './insertSizeTicks.ts'
import { junctionViews } from './junctionViews.ts'
import {
  drawnLaneViews,
  laneViews,
  linkedReadLinesViews,
  rowlessLaneViews,
  sectionViews,
} from './laneViews.ts'
import {
  featureSpacingForHeight,
  featureSpacingForPitch,
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
  getJunctionsPlacementItems,
  getSortMenuItem,
  getTrackSizingItems,
  sectionOrderResetItems,
} from './menus/index.ts'
import {
  arcViews,
  connectorSettingViews,
  connectorViews,
  facetLayoutViews,
  groupLayoutViews,
  pileupLayoutViews,
} from './pileupLayoutViews.ts'
import { findRead, readInfo } from './readLookup.ts'
import { readCloudDomainBp } from './renderers/arcMarks.ts'
import { junctionLabels } from './renderers/junctionMarks.ts'
import { fetchFeatureDetails, fetchFeaturesForRegion } from './rpcCalls.ts'
import { rpcPropsViews, sortTagViews } from './rpcPropsViews.ts'
import {
  buildSectionRenders,
  coverageBandTop,
  dragLaneBand,
  pileupHiddenHeight,
  sectionDipFloor,
} from './sectionLayout.ts'
import { themedViews } from './themedViews.ts'

import type {
  GroupedAlignmentsResult,
  WorkerPileupData,
} from '../RenderAlignmentDataRPC/types'
import type { ArcCategory } from '../shaders/palettes.ts'
import type {
  BasesPatch,
  ColumnSortField,
  SortColumn,
  SortSetting,
} from '../shared/types'
import type { BandChipKey } from './bandChips.ts'
import type {
  BaseLinearAlignmentsDisplayConfigModel,
  BaseLinearAlignmentsDisplayConfigSchema,
} from './baseConfigSchema.ts'
import type { ReadColorCategory } from './colorUtils.ts'
import type { ContextMenuHit } from './components/hitTestPipeline.ts'
import type { ScrollModel } from './components/sectionScreen.ts'
import type { AlignmentsUnit } from './constants.ts'
import type { GroupSize } from './groupLayout.ts'
import type { AlignmentsHover } from './hoverState.ts'
import type { AlignmentLane } from './lanes.ts'
import type { JunctionLabel } from './renderers/junctionMarks.ts'
import type { AlignmentsRenderingBackend } from './renderers/rendererTypes.ts'
import type { VariantAllele, VariantSortColumn } from '@jbrowse/alignments-core'
import type { AnyConfigurationModel, Plot } from '@jbrowse/core/configuration'
import type { LodTier } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { ExportedFeaturesRequest } from '@jbrowse/core/pluggableElementTypes/models'
import type { ContextMenuAnchor, MenuItem } from '@jbrowse/core/ui'
import type { AdapterRefName, Feature, Region } from '@jbrowse/core/util'
import type { HeightMode } from '@jbrowse/display-kit/heightMode'
import type { IndexedRegion } from '@jbrowse/display-kit/planRegionFetch'
import type { ExportSvgDisplayOptions } from '@jbrowse/display-kit/types'
import type { IModelType, Instance } from '@jbrowse/mobx-state-tree'
import type { LinkRegion } from '@jbrowse/render-core/marks'
import type { ValueScale } from '@jbrowse/wiggle-core'

// Lazy so the eager state model keeps @floating-ui off the startup path.
const AlignmentsTooltip = lazy(
  () => import('./components/AlignmentsTooltip.tsx'),
)

export type { AlignmentLane }

// One frozen empty array, so the common no-arcs frame invalidates no observer.
// Frozen so no caller's in-place `.sort()` corrupts the singleton.
const NO_JUNCTION_LABELS = Object.freeze([]) as readonly JunctionLabel[]
const NO_LINK_REGIONS: readonly LinkRegion[] = []

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
function stateModelFactory(
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
        }
      })
      .volatile((): { hoverState: AlignmentsHover | undefined } => ({
        /**
         * #volatile
         * Everything the cursor is over, as one value, so a clear is one
         * write that cannot miss a field. `setHoverState` writes it whole.
         */
        hoverState: undefined,
      }))
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
      .views(self => coverageStatsViews(self, shownGroupCoverage(self)))
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
           * Derived, never stored: 2px from a Normal read up, 1px past
           * Compact, else flush. In fit mode it comes from the pitch, ramping
           * across the pitches no fixed height produces so the body never
           * shrinks as the track grows.
           */
          get featureSpacing(): number {
            return this.isFitting
              ? featureSpacingForPitch(self.fittedHeightPx)
              : featureSpacingForHeight(self.markHeight)
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
      .views(self => ({
        /**
         * #getter
         * The fetched regions as `{refName,start,end,displayedRegionIndex}`,
         * the shape every per-read region scan takes (`collectArcs`).
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
      }))
      .views(self => arcViews(self))
      .views(self => junctionsStripViews(self))
      .views(self => bandStackViews(self))
      .views(self => fitViews(self))
      .views(self => {
        const superConfigProblemsOf = self.configProblemsOf
        return {
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
           * which consumers resolve through `readIdIndexMap`
           * (hence `hoverChainReadIds`, `selectedChainReadIds`).
           */
          get readIdsByChainName(): ReadonlyMap<string, string[]> {
            const chained = self.chainAttachment
            return chained ? buildReadIdsByChainName(chained) : new Map()
          },

          /**
           * #getter
           * Each group's arcs and ticks by loaded region, every arc filed
           * under the one region holding a foot.
           */
          get arcsByGroup() {
            return self.arcsResult.byGroup
          },

          /**
           * #getter
           * Arcs whose two feet are in different displayed regions, per group.
           * Empty in a single-region view.
           */
          get crossRegionArcsByGroup() {
            return self.arcsResult.crossRegionByGroup
          },
        }
      })
      .views(self => pileupLayoutViews(self))
      .views(self => connectorViews(self))
      .views(self =>
        coverageTicksViews(self, () => self.bandHeights.coverageHeight),
      )
      .views(self => rowlessLaneViews(self))
      .views(self => alignmentsColorViews(self))
      .views(self => connectionKeyViews(self))
      .views(self => linkedReadLinesViews(self))
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
      .views(self => laneViews(self))
      .views(self => drawnLaneViews(self))
      .views(self => sectionViews(self))
      .views(self => ({
        /**
         * #getter
         * Every lane with its band geometry in stacking order: the list the
         * overlays, the hit-test pipeline and both renderers walk.
         */
        get renderSections() {
          return self.sections.sections
        },

        /**
         * #getter
         * The pairs the connector mark draws, placed on each drawn section's
         * pileup band, their dips sized to its rows (`rowsHeight`) and ending
         * by `dipFloor`, the bottom of the display measured from that band's
         * top with the display scrolled to its end.
         */
        get connectorPairSections() {
          return this.renderSections.flatMap(sec => {
            const pairs = self.connectorsByGroup.get(sec.groupKey)?.overlayPairs
            return pairs?.length
              ? [
                  {
                    groupKey: sec.groupKey,
                    pileupTop: sec.pileupTop,
                    pileupHeight: sec.rowsHeight,
                    dipFloor: sectionDipFloor(self.sections, sec, self.height),
                    pairs,
                  },
                ]
              : []
          })
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
          return self.lanes.length > 1
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
          return this.isGrouped ? 0 : self.sections.sections[0]!.pileupTop
        },

        /**
         * #getter
         * The px the coverage band reserves, the same in every section: 0
         * while it is off or the plot leaves it no room. What paints it, its
         * axis and its rules all read this.
         */
        get coverageBandHeight() {
          return self.sections.sections[0]!.bands.reserved.coverage
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
            self.sections.contentHeight - this.stickyBandHeight,
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
         * current height. With the pileup hidden the track fits its slot, as
         * in fixed and fit: the lanes fill it, and never size it.
         */
        get growTargetHeight() {
          return self.showPileup
            ? self.layoutReady
              ? self.sections.contentHeight
              : self.fitTargetHeight
            : pileupHiddenHeight(self)
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
      .views(self => junctionViews(self))
      .views(self => readPaletteViews(self))
      .views(self => themedViews(self))
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
         */
        get renderState() {
          const palette = self.themed.colors
          return {
            scrollTop: self.scrollTop,
            featureHeight: self.featureHeight,
            featureSpacing: self.featureSpacing,
            coverage: {
              height: self.coverageBandHeight,
              ...self.coverageScaleState,
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
            !self.drawsJunctions &&
            self.connectorPairSections.length === 0) ||
            !self.view.initialized
            ? NO_LINK_REGIONS
            : viewRegionTable(self.view)
        },

        /**
         * #getter
         * The junction read counts, each at its arc's apex (`junctionLabels`).
         * The one part of junctions that reads the pan, and only while the
         * labels are shown; the same empty array otherwise, so the overlay's
         * observer stops.
         */
        get junctionLabels(): readonly JunctionLabel[] {
          return self.showJunctionLabels && self.drawsJunctions
            ? junctionLabels(
                this.renderState,
                self.themed.sourceSections.map(sec => sec.junctionFeeds),
              )
            : NO_JUNCTION_LABELS
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
         * left edge; a left-side axis stands past its band's chips. The read cloud's insert-size scale rules each section's arc band,
         * captioned TLEN, with a line at each end of the insert-size band the
         * pairs are classed by (pinned, else the one the arcs pool). Each band
         * projects through its section's own scroll;
         * the chrome drops the off-screen ones.
         */
        get valueScales(): ValueScale[] {
          const { scrollModel: scroll, renderSections } = self
          const chipRows = bandChipsShown(self) ? self.bandChips.rows : []
          const chipsLeft = (band: BandChipKey) => {
            const row = chipRows.find(r => r.band === band)
            return row
              ? bandChipRowWidth(
                  row.chips.map(key =>
                    bandChipLabel(key, self.readConnectionsMark),
                  ),
                )
              : 0
          }
          const scales: ValueScale[] = []
          if (self.coverageBandHeight > 0 && self.coverageDepthDomain) {
            scales.push({
              domain: self.coverageDepthDomain,
              scaleType: self.scaleType,
              height: self.coverageBandHeight,
              ticks: self.coverageTicks,
              side: self.showsGroupLabels ? 'right' : 'left',
              left: chipsLeft('coverage'),
              symlogConstant: self.symlogConstant,
              ...self.axisGuide,
              bandTops: renderSections.map(section =>
                bandScreenTop(coverageBandTop(section), scroll),
              ),
            })
          }
          const arcsYDomainBp = this.arcsYDomainBp
          const banded = renderSections.flatMap(s =>
            s.arcBand && s.arcBand.height > 0 ? [s.arcBand] : [],
          )
          const band = banded[0]
          if (arcsYDomainBp !== undefined && band) {
            const ticks = computeInsertSizeTicks({
              band: { ...band, top: 0 },
              arcsYDomainBp,
            })
            if (ticks) {
              const normalBand = self.arcCollection.scale.stats
              scales.push({
                domain: [1, arcsYDomainBp],
                scaleType: 'log',
                height: band.height,
                ticks,
                side:
                  self.readConnectionsPlacement === 'overlay'
                    ? 'right'
                    : 'left',
                left: chipsLeft('readConnections'),
                caption: 'TLEN',
                rules: normalBand
                  ? [{ value: normalBand.lower }, { value: normalBand.upper }]
                  : [],
                bandTops: banded.map(arcBand =>
                  bandScreenTop(arcBand.top, scroll),
                ),
              })
            }
          }
          return scales
        },
      }))
      .views(self => highlightViews(self))
      .views(self => sortTagViews(self))
      .views(self => rpcPropsViews(self))
      .views(self => ({
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
          self.hoverState = undefined
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
           * `colorByField`'s and stays as it is. Turning a hidden layer back
           * on clears `show`, since a named field draws unless it is false.
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
            const shown = readConfObject(bases, 'show') !== false
            if (show !== undefined && show !== shown) {
              setConf(
                conf,
                ['pileup', 'bases', 'show'],
                show ? undefined : false,
              )
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
           * rows fall short (`computeStackedSections`), so the band follows a drag in
           * both directions, past its content too.
           */
          setGroupHeight(key: string, height: number) {
            const section = self.renderSections.find(s => s.groupKey === key)
            if (section) {
              const bandsAbove = section.pileupTop - section.sectionTop
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
              dragLaneBand(
                self.laneBandsInput,
                'coverage',
                self.bandPlot,
                height,
              ),
            )
          },

          /**
           * #action
           * With the pileup hidden, clamped to the room that leaves each
           * lane's coverage its floor (`dragPileupHiddenStrip`).
           */
          setReadConnectionsHeight(height: number) {
            setConf(
              self,
              ['readConnections', 'height'],
              dragStripHeight(self, 'readConnections', height),
            )
          },

          /**
           * #action
           * Clamped as `setReadConnectionsHeight` is.
           */
          setJunctionsHeight(height: number) {
            setConf(
              requireReadsConf(self),
              ['junctions', 'height'],
              dragStripHeight(self, 'junctions', height),
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
          setHoverState(state: AlignmentsHover) {
            if (!self.contextMenuInfo) {
              self.hoverState = nextHover(self.hoverState, state)
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
            self.hoverState = {
              overCigarItem: false,
              featureIdUnderMouse: info.featureId,
              mouseoverExtraInformation: undefined,
            }
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
        trackMenuItems(): MenuItem[] {
          const pileupGate = {
            disabled: !self.showPileup,
            disabledHelpText: 'Turn on "Show pileup" to change read height',
          }
          // Where the band switches live is settled (Coverage, Pileup and
          // Junction arcs in "Show...", the connection band in "Read
          // connections"), so a menu review leaves them there.
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
            ...sectionsMenuItems(self),
            ...sectionOrderResetItems(self),
            ...getReadsMenuItems(self),
            getFeatureHeightMenuItem(self, self.featureNoun, pileupGate),
            getReadConnectionsMenuItem(self),
            getPresetsMenuItem(self),
            ...editPlotMenuItems(self, [
              ...getCoverageMenuItems(self),
              ...getTrackSizingItems(self, pileupGate),
              ...getReadConnectionsBandItems(self),
              ...getJunctionsPlacementItems(self),
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
          return renderSvg(self, opts)
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

type ModelParts<M> =
  M extends IModelType<infer P, infer O> ? { props: P; others: O } : never
type InferredParts = ModelParts<ReturnType<typeof stateModelFactory>>
type InferredOthers = InferredParts['others']

export type LinearAlignmentsDisplayProps = InferredParts['props']
// An interface, so a package composing this model names it in its emitted
// declaration rather than spelling out every member's type.
export interface LinearAlignmentsDisplayOthers extends InferredOthers {}

export type LinearAlignmentsDisplayStateModel = IModelType<
  LinearAlignmentsDisplayProps,
  LinearAlignmentsDisplayOthers
>

const linearAlignmentsDisplayStateModelFactory: (
  configSchema: BaseLinearAlignmentsDisplayConfigSchema,
) => LinearAlignmentsDisplayStateModel = stateModelFactory
export default linearAlignmentsDisplayStateModelFactory

// interface (not type alias) breaks the circular reference TypeScript would
// encounter through React.lazy → PileupComponent → useAlignmentsBase → model
export interface LinearAlignmentsDisplayModel extends Instance<LinearAlignmentsDisplayStateModel> {}

declare module '@jbrowse/core/PluginManager' {
  interface DisplayTypeRegistry {
    LinearAlignmentsDisplay: LinearAlignmentsDisplayStateModel
  }
}
