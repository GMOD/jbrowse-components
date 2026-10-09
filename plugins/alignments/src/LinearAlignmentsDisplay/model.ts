import { lazy } from 'react'

import {
  computeCoverageTicks,
  coverageDepthDomain,
  computeVisibleCoverageDomain,
  computeVisibleCoverageStats,
  densityBinSize,
} from '@jbrowse/alignments-core'
import {
  ConfigurationReference,
  getConf,
  setConf,
} from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import {
  canonicalizeViewRefName,
  getNotificationSink,
  getPaletteHost,
  getSession,
  isFeature,
  notifyFeatureDetailsMiss,
  openFeatureWidget,
  SimpleFeature,
  withFeatureDetails,
} from '@jbrowse/core/util'
import { basePaintedAt } from '@jbrowse/core/util/Base1DUtils'
import {
  MIN_BAND_HEIGHT,
  boundBandHeight,
  clampBandHeight,
} from '@jbrowse/core/util/bandHeight'
import { carryGroupDomain, groupKeySpaceOf } from '@jbrowse/core/util/groupKeys'
import { sameStrings } from '@jbrowse/core/util/sameStrings'
import { ContextMenuMixin } from '@jbrowse/display-kit/ContextMenuMixin'
import DensityTierMixin from '@jbrowse/display-kit/DensityTierMixin'
import HeightModeMixin from '@jbrowse/display-kit/HeightModeMixin'
import HiddenGroupsMixin from '@jbrowse/display-kit/HiddenGroupsMixin'
import LegendMixin from '@jbrowse/display-kit/LegendMixin'
import MultiRegionDisplayMixin from '@jbrowse/display-kit/MultiRegionDisplayMixin'
import TrackHeightMixin from '@jbrowse/display-kit/TrackHeightMixin'
import { coarseTierPending } from '@jbrowse/display-kit/coarseTierPhase'
import { densityTierMenuItems } from '@jbrowse/display-kit/densityTierMenu'
import { onDisplayedRegionsChange } from '@jbrowse/display-kit/displayAutoruns'
import { fetchEachRegion } from '@jbrowse/display-kit/fetchEachRegion'
import { GROUP_LABEL_HEIGHT } from '@jbrowse/display-kit/groupLabelStyle'
import { editPlotMenuItems } from '@jbrowse/display-kit/plotMenu'
import { stableIdentityComputed } from '@jbrowse/display-kit/stableIdentityComputed'
import { subPixelBinBp } from '@jbrowse/display-kit/subPixelBinBp'
import { viewRegionTable } from '@jbrowse/display-kit/viewRegionTable'
import { addDisposer, types } from '@jbrowse/mobx-state-tree'
import { containingLgv } from '@jbrowse/plugin-linear-genome-view'
import { installUpload, oneCell } from '@jbrowse/render-core/installUpload'
import { scaleTypeCode } from '@jbrowse/render-core/scoreScale'
import {
  ScoreScaleMixin,
  getNiceDomain,
  resolveSymlogConstant,
  visibleStatsRange,
  widenRangeToRules,
} from '@jbrowse/wiggle-core'
import { YSCALEBAR_LABEL_OFFSET } from '@jbrowse/wiggle-core/constants'
import { autorun, compareStructural, observable } from 'mobx'

import { buildArcBandFeeds } from '../features/arcs/bandFeed.ts'
import { computeArcsByGroup } from '../features/arcs/compute.ts'
import { densityCoverageFields } from '../features/coverage/densityBand.ts'
import {
  bezierConnectionLegendItems,
  bezierDipReservePx,
  resolveConnectorsByGroup,
} from '../features/linkedReads/computeOverlay.ts'
import { buildSashimiBandFeeds } from '../features/sashimi/bandFeed.ts'
import { visibleRegionJunctions } from '../features/sashimi/computeOverlay.ts'
import { mergeJunctions } from '../features/sashimi/junctions.ts'
import { junctionSupportingReadSlots } from '../features/sashimi/supportingReads.ts'
import { arcSlotCategory } from '../shaders/palettes.ts'
import {
  BASE_COLOR_FIELDS,
  colorFieldOf,
  colorSnapshotFor,
  writtenReadCategoryColors,
  declaredReadLabels,
  isBakedScheme,
} from '../shared/alignmentsColor.ts'
import {
  paintsEveryBase,
  paintsModifications,
  workerColorBy,
} from '../shared/colorSchemes.ts'
import {
  facetForUnit,
  sectionOrder,
  workerFacet,
} from '../shared/groupFeatures.ts'
import {
  LEGEND_MAX_WIDTH,
  colorRampScales,
  getAlignmentsColorScales,
  arcColorCategoryLabel,
  getArcLegendItems,
  getReadDisplayLegendItems,
  readCategoryLabelOverrides,
  readColorCategoryLabel,
  sashimiLegendItems,
} from '../shared/legendUtils.ts'
import { DEFAULT_MODIFICATION_THRESHOLD } from '../shared/types.ts'
import { getMismatchContrastMap } from '../shared/util.ts'
import { getColorForModification } from '../util.ts'
import {
  bakedColorScale,
  numericExtentAcrossGroups,
  quantileExtentAcrossGroups,
} from './bakedColorScale.ts'
import { attachChainFields, buildReadIdsByChainName } from './chainFields.ts'
import {
  READ_COLOR_CATEGORY_BY_INDEX,
  framesUnpairedChainStrand,
} from './colorUtils.ts'
import { buildColorPaletteFromPalette } from './components/alignmentComponentUtils.ts'
import { computeVisibleLabels } from './components/computeVisibleLabels.ts'
import {
  readHighlightInk,
  readsToLight,
  slotsOfIds,
} from './components/readHighlightInk.ts'
import { SASHIMI_FEATURE_ID_PREFIX } from './components/sashimiArcs.ts'
import { selectedSashimiHighlight } from './components/sashimiHitTest.ts'
import { bandScreenTop } from './components/sectionScreen.ts'
import { nonReferenceAt } from './components/tooltipUtils.ts'
import { configSlotViews } from './configSlotViews.ts'
import { colorSchemeIndexFor } from './constants.ts'
import {
  applyChainStrandFrames,
  applyReadColorsByGroup,
  attachLinkedReadLinesByGroup,
  collectAcrossGroups,
  fitRowCount,
  fittedReadPitch,
  groupRowCaps,
  layoutGroupsToViewport,
  maxRowsFor,
  nextGroupHeightOverride,
  resolveFitDefaultCap,
  someAcrossGroups,
  stacksRows,
} from './groupLayout.ts'
import {
  buildRawDataByGroup,
  buildReadIdIndexMap,
  buildSashimiDownKeys,
  hasNamedGroups,
  orderedGroups,
} from './groupedDataMaps.ts'
import { computeInsertSizeTicks } from './insertSizeTicks.ts'
import {
  buildLanes,
  drawnLanesOf,
  toSectionGroupInputs,
  zipLaneSections,
} from './lanes.ts'
import {
  featureSpacingForHeight,
  getColorByMenuItem,
  getContextMenuItems,
  getCoverageMenuItems,
  getFeatureHeightMenuItem,
  getFiltersMenuItems,
  getGroupByMenuItem,
  getSectionOrderMenuItems,
  getReadConnectionsMenuItem,
  getReadsMenuItems,
  getSashimiMenuItem,
  getSortByMenuItem,
} from './menus/index.ts'
import { migrateAlignmentsSnapshot } from './migrateAlignmentsSnapshot.ts'
import {
  NO_QUALITY_SPAN,
  baseQualitySpanAcrossGroups,
  mapqExtentAcrossGroups,
  presentMapqs,
} from './qualitySpans.ts'
import { chainReadIdsAt, findRead, readInfo } from './readLookup.ts'
import { shouldDrawOverlaps } from './renderers/rendererTypes.ts'
import { sashimiBandsOf, sashimiLabels } from './renderers/sashimiMarks.ts'
import { fetchFeatureDetails, fetchFeaturesForRegion } from './rpcCalls.ts'
import {
  belowCoverageBandsGeometry,
  buildSectionRenders,
  computeStackedSections,
  totalBelowCoverageOverhead,
} from './sectionLayout.ts'

import type {
  ChainedPileupData,
  GroupedAlignmentsResult,
  RowCap,
  WorkerPileupData,
} from '../RenderAlignmentDataRPC/types'
import type { ArcBandFeed } from '../features/arcs/bandFeed.ts'
import type { ArcsByGroupResult } from '../features/arcs/compute.ts'
import type { CoverageRegionFields } from '../features/coverage/types.ts'
import type { BezierArcScope } from '../features/linkedReads/computeOverlay.ts'
import type { SashimiBandFeed } from '../features/sashimi/bandFeed.ts'
import type { LaneJunction } from '../features/sashimi/supportingReads.ts'
import type { ArcCategory } from '../shaders/palettes.ts'
import type {
  AlignmentsColorSetting,
  DeclaredReadLabels,
} from '../shared/alignmentsColor.ts'
import type { ReadSlot } from '../shared/readSlot.ts'
import type {
  ArcColorField,
  BaseLayer,
  ReadFilter,
  Facet,
  LayoutOrder,
  ReadColorBy,
  SortedBy,
  TagColorScale,
} from '../shared/types'
import type { NumericExtent } from './bakedColorScale.ts'
import type { ReadColorCategory } from './colorUtils.ts'
import type { ArcHighlight } from './components/arcHitTest.ts'
import type { ContextMenuHit } from './components/hitTestPipeline.ts'
import type { ScrollModel } from './components/sectionScreen.ts'
import type { TooltipPayload } from './components/tooltipUtils.ts'
import type { LinearAlignmentsDisplayConfigSchema } from './configSchema'
import type {
  AlignmentsUnit,
  ReadConnectionsMode,
  SashimiArcsMode,
} from './constants.ts'
import type { AlignmentLane } from './lanes.ts'
import type { QualitySpan } from './qualitySpans.ts'
import type { ColorPalette } from './renderers/AlignmentsRenderer.ts'
import type {
  AlignmentsRenderingBackend,
  SectionSource,
} from './renderers/rendererTypes.ts'
import type { SashimiLabel } from './renderers/sashimiMarks.ts'
import type {
  BelowCoverageBandsSettings,
  SectionsLayout,
} from './sectionLayout.ts'
import type { VariantAllele, VariantSortColumn } from '@jbrowse/alignments-core'
import type { LodTier } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { ContextMenuAnchor, MenuItem } from '@jbrowse/core/ui'
import type { ColorScale } from '@jbrowse/core/ui/colorScale'
import type { JBrowsePalette } from '@jbrowse/core/ui/palette'
import type { Feature, Region } from '@jbrowse/core/util'
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

export { ColorScheme } from './constants.ts'
export type { AlignmentLane }

export interface HoverCoverageBand {
  topOffset: number
  coverageHeight: number
}

// One identity, so `groupHeightOverrides` hands the layout no fresh map per
// read.
const NO_GROUP_HEIGHT_OVERRIDES: ReadonlyMap<string, number> = new Map()

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
 *       baseColor: 'modifications',
 *       modifications: { fillUnmarked: true },
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
 *       readConnections: 'arc',
 *     },
 *   ],
 * }
 * ```
 */
export default function stateModelFactory(
  configSchema: LinearAlignmentsDisplayConfigSchema,
) {
  return (
    types
      .compose(
        'LinearAlignmentsDisplay',
        BaseDisplay,
        TrackHeightMixin(),
        HeightModeMixin(),
        MultiRegionDisplayMixin(),
        DensityTierMixin(),
        ScoreScaleMixin(),
        LegendMixin(),
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
      .preProcessSnapshot((snap: Record<string, unknown> | undefined) =>
        migrateAlignmentsSnapshot(snap),
      )
      // Config-slot toggles live in `configSlotViews`.
      .views(configSlotViews)
      .views(self => ({
        /**
         * #getter
         * What the `color`, `facet` and `scales.y` slots say that the display
         * cannot draw as written, for the corner notice.
         */
        get notices(): string[] {
          return [
            ...self.colorNotices,
            ...self.facetNotices,
            ...self.valueScaleNotices,
          ]
        },
      }))
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
           * Group keys whose pileup is collapsed to its coverage band. Dropped
           * with the mixin's `hiddenGroups` when `groupKeySpace` moves.
           */
          collapsedGroups: observable.set<string>(),
          /**
           * #volatile
           * Per-group pileup height override in px, keyed by group key and
           * dropped with `collapsedGroups`. Absent keys fall back to the
           * display-wide `maxHeight`.
           */
          groupMaxHeightOverrides: observable.map<string, number>(),
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
           * Read ids of the chain under the cursor — NOT chain ids; see
           * `readIdsByChainName`, which is where they come from.
           */
          highlightedChainReadIds: [] as string[],
          /**
           * #volatile
           * The sashimi junction under the cursor, whose supporting reads the
           * hover lights.
           */
          hoveredJunction: undefined as LaneJunction | undefined,

          /**
           * #volatile
           */
          overCigarItem: false,
          /**
           * #volatile
           * Screen-px coverage band of the section under a coverage/indicator
           * hover; the tooltip's vertical hover bar lands on it. `undefined`
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
        /**
         * #getter
         * Whether the straight-line pass connects normal read pairs. Chain
         * layout has its own pass for them. Neither pass reaches across
         * regions; that is `bezierArcScope`'s `crossRegion`.
         */
        get showLinkedReadLines() {
          return self.showBezierConnections && self.unit !== 'chain'
        },

        /**
         * #getter
         * What the SVG connection overlay draws — see `BezierArcScope`. Chain
         * mode claims `crossRegion` even with the curved connectors off: only
         * that pass joins a chain's ends across displayed regions.
         */
        get bezierArcScope(): BezierArcScope {
          return self.showBezierConnections
            ? 'all'
            : self.unit === 'chain'
              ? 'crossRegion'
              : 'none'
        },
      }))
      .views(self => {
        let rowCaps: IComputedValue<ReadonlyMap<string, RowCap>> | undefined
        let fitCap: IComputedValue<RowCap> | undefined
        return {
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
          get selectedFeatureId() {
            const { selection } = getSession(self)
            if (isFeature(selection)) {
              return selection.id()
            }
            return undefined
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
            const out = new Map<string, string>()
            for (const { groups } of self.rpcDataMap.values()) {
              for (const { data } of groups) {
                for (const type of data.detectedModifications) {
                  if (!out.has(type)) {
                    out.set(type, getColorForModification(type))
                  }
                }
              }
            }
            return out
          },

          /**
           * #method
           * The loaded reads differing from the reference at a variant's sort
           * column, or with `allele` only those carrying it, over the reads
           * spanning it. Undefined until a fetch reaching the column lands.
           */
          nonReferenceAt(column: VariantSortColumn, allele?: VariantAllele) {
            let total: { count: number; depth: number } | undefined
            for (const { groups } of self.rpcDataMap.values()) {
              for (const { data } of groups) {
                const at = nonReferenceAt(column, data, allele)
                if (at) {
                  total = {
                    count: (total?.count ?? 0) + at.count,
                    depth: (total?.depth ?? 0) + at.depth,
                  }
                }
              }
            }
            return total
          },

          /**
           * #getter
           * Whether a fetch has landed, so an empty `detectedModifications`
           * means these reads carry none. The modifications menu shows "Loading
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
           * fit mode, else `configuredFeatureHeight`, which is what editors
           * that write the size read.
           */
          get featureHeight(): number {
            return this.isFitting
              ? self.fittedHeightPx - this.featureSpacing
              : self.configuredFeatureHeight
          },

          /**
           * #getter
           * Derived from the read height, never stored: a 1px gap once there is
           * room (pitch/height > 3), else flush. One rule covers the fixed
           * presets and the fit squeeze.
           */
          get featureSpacing(): number {
            return featureSpacingForHeight(
              this.isFitting
                ? self.fittedHeightPx
                : self.configuredFeatureHeight,
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
           * The single read of the `sortedBy` slot. Normalizes the refName,
           * since a spec can write an alias (`chr1` for `1`) that
           * `sortLayout`'s gate would never match. A slot missing `refName` or
           * `pos` reads as no sort; a missing refName would throw in
           * `canonicalizeViewRefName`.
           */
          get sortedBy(): SortedBy | undefined {
            const sortedBy = getConf(self, 'sortedBy') as SortedBy | undefined
            return sortedBy &&
              typeof sortedBy.refName === 'string' &&
              typeof sortedBy.pos === 'number'
              ? {
                  ...sortedBy,
                  refName: canonicalizeViewRefName(self, sortedBy.refName),
                }
              : undefined
          },

          /**
           * #getter
           * The facet the fetch partitions by. Chain mode turns a per-read
           * dimension into ungrouped without changing the slot, so the slot
           * alone does not determine which sections come back.
           */
          get effectiveFacet() {
            return facetForUnit(self.facet, self.unit)
          },

          /**
           * #getter
           * Identity of the key space the fetched group keys live in, and so of
           * every collection this model keys by group key — see
           * `groupKeySpaceOf`.
           */
          get groupKeySpace() {
            return groupKeySpaceOf(this.effectiveFacet)
          },

          /**
           * #getter
           * Whether the grouping will be HONORED, decidable from settings alone
           * since chain mode drops a per-read dimension (`facetForUnit`).
           * Positions the track label, which is placed before data arrives and
           * must not jump afterwards.
           */
          get prefersOffset() {
            return this.effectiveFacet !== undefined
          },

          /**
           * #getter
           * Whether each group draws as one row, overlap depth carried by the
           * tint layer — the collapse IN EFFECT. Reads `canCollapseGroupRows`,
           * not the slot alone: a config default can be ticked where collapsing
           * is inert.
           */
          get collapseGroupRows(): boolean {
            return (
              this.canCollapseGroupRows && getConf(self, 'collapseGroupRows')
            )
          },

          /**
           * #getter
           * Whether collapsing can take effect, so whether the "Show..." menu
           * offers the toggle. Chain mode never collapses (`collapsesRows`).
           * The menu omits the row rather than disabling it: a click would
           * write a slot no getter reads.
           */
          get canCollapseGroupRows() {
            return this.prefersOffset && self.unit !== 'chain'
          },

          /**
           * #getter
           * Why an explicit read ordering cannot take effect, or `undefined`:
           * one value carries both the gate and the copy naming the switch that
           * brings it back. Chain layout takes neither `sortedBy` nor
           * `layoutOrder`; its rows are chains.
           */
          get sortReadsBlockedReason(): string | undefined {
            return self.unit === 'chain'
              ? 'Chain rows are ordered by chain — turn off "View as pairs / link supplementary alignments" to sort reads'
              : self.showPileup
                ? undefined
                : 'Turn on "Show pileup" to sort reads'
          },

          /**
           * #getter
           * Whether an explicit read ordering can take effect. The track menu's
           * "Sort by..." and the context menu's position-anchored sorts both
           * read it.
           */
          get canSortReads() {
            return this.sortReadsBlockedReason === undefined
          },

          /**
           * #getter
           * Whether a single group's pileup height can be set on its own,
           * offered by the label chip's expand/fit button and the per-group
           * drag handles. Fit mode refuses: an override there opts a lane out
           * of the fit and overflows the display.
           */
          get canSizeGroupHeights() {
            return self.showPileup && !self.fitHeightToDisplay
          },

          /**
           * #getter
           * The per-lane height overrides IN EFFECT, not the set banked. Fit
           * solves one pitch from every lane's full row count, so fit mode
           * ignores the overrides without dropping them; returning to fixed
           * restores them.
           */
          get groupHeightOverrides(): ReadonlyMap<string, number> {
            return self.fitHeightToDisplay
              ? NO_GROUP_HEIGHT_OVERRIDES
              : self.groupMaxHeightOverrides
          },

          /**
           * #getter
           */
          get coverageScaleType() {
            return scaleTypeCode(self.scaleType)
          },

          /**
           * #getter
           * `CoarseTierMixin`'s hook: the band the tier's bins draw in. The
           * pileup, axis and fetch read `coarseTierStandsIn`, which conjoins
           * this with the tier's verdict.
           */
          get coarseTierHasSomewhereToDraw(): boolean {
            return self.showCoverage
          },

          /**
           * #getter
           * The density tier's bins as the coverage band's per-region payload,
           * empty while the tier is off. Both backends and the SVG export read
           * this map. Depends on `coarseTier` and the DEBOUNCED zoom, so a pan
           * frame never repacks.
           */
          get densityCoverageRegions(): ReadonlyMap<
            number,
            CoverageRegionFields
          > {
            const regions = new Map<number, CoverageRegionFields>()
            const { view } = self
            if (self.coarseTierStandsIn) {
              const binSize = densityBinSize(view.coarseBpPerPx)
              for (const [displayedRegionIndex, bins] of self.coarseTier) {
                regions.set(
                  displayedRegionIndex,
                  densityCoverageFields(bins, binSize),
                )
              }
            }
            return regions
          },

          /**
           * #getter
           * The tallest bin across every region the tier holds, 0 while it
           * holds none. One domain for all regions, so the bands the eye
           * compares share a scale.
           */
          get densityDepthMax() {
            let max = 0
            for (const {
              coverageMaxDepth,
            } of this.densityCoverageRegions.values()) {
              max = coverageMaxDepth > max ? coverageMaxDepth : max
            }
            return max
          },

          /**
           * #getter
           * The depth every SHOWN group spans, so stacked sections share a
           * scale; hidden lanes are excluded. Undefined while the density tier
           * stands in, whose per-bin count is no depth a group could share.
           */
          get autoscaleRange(): [number, number] | undefined {
            const hidden = self.hiddenGroupKeys
            return self.coarseTierStandsIn
              ? undefined
              : visibleStatsRange({
                  active: self.showCoverage,
                  view: self.view,
                  payloadFor: index => self.rpcDataMap.get(index),
                  itemsFor: grouped =>
                    grouped.groups
                      .filter(({ key }) => !hidden.has(key))
                      .map(({ data }) => data),
                  accumulate: entries => computeVisibleCoverageStats(entries),
                  range: (stats, entries) =>
                    widenRangeToRules(
                      computeVisibleCoverageDomain({
                        stats,
                        quantile: self.domainQuantile,
                        entries,
                      }),
                      self.scoreRules.map(rule => rule.value),
                    ),
                })
          },

          /**
           * #getter
           * Depth has a floor of 0 while the axis reaches it, so an unpinned
           * bottom stays there whatever a rule below it asks for; with
           * `scales.y.zero` off it spans the depths in view.
           */
          get defaultScoreDomain(): [number | undefined, number | undefined] {
            return [self.scaleZero ? 0 : undefined, undefined]
          },

          /**
           * #getter
           * The autoscaled depth domain. While the density tier stands in, the
           * axis is the bins' own count per bin, which the depth bounds
           * `scales.y` pins do not reach. Undefined until some region holds
           * one.
           */
          get coverageDomain(): [number, number] | undefined {
            return self.coarseTierStandsIn
              ? this.densityDepthMax > 0
                ? getNiceDomain({
                    domain: [0, this.densityDepthMax],
                    bounds: [0, undefined],
                    scaleType: self.scaleType,
                    zero: true,
                  })
                : undefined
              : self.autoscaledDomain
          },

          /**
           * #getter
           * The domain the coverage band draws against: `coverageDomain` with a
           * log scale's floor pulled up to one read (see
           * `coverageDepthDomain`). Every consumer reads this one — the y-axis
           * ticks and both renderers' normalizers.
           */
          get coverageDepthDomain() {
            return this.coverageDomain
              ? coverageDepthDomain(this.coverageDomain, self.scaleType)
              : undefined
          },

          /**
           * #getter
           * The coverage band's own ladder (`computeCoverageTicks`), which
           * `valueScales` hands the chrome in place of the mixin's. Takes the
           * raw `scales.y.symlogConstant`, resolved from the same domain as
           * `renderState`, so the labels sit on the bars.
           */
          get coverageTicks() {
            return this.coverageDepthDomain
              ? computeCoverageTicks(
                  this.coverageDepthDomain,
                  this.bandHeights.coverageHeight,
                  self.scaleType,
                  self.symlogConstant,
                  self.minimalTicks,
                )
              : undefined
          },

          /**
           * #getter
           * Read-color buckets present across the rendered reads, so the legend
           * lists only relevant swatches. Empty while the legend is hidden,
           * skipping the O(reads) scan.
           */
          get colorLegendCategories(): Set<ReadColorCategory> {
            const present = new Set<ReadColorCategory>()
            if (self.showLegend) {
              // Baked categories off the laid-out groups, not a second
              // classification of `rpcDataMap`: `readTagColors` is empty until
              // the main thread bakes it.
              for (const idx of collectAcrossGroups(
                this.laidOutByGroup,
                d => d.readColorCategories,
              )) {
                present.add(READ_COLOR_CATEGORY_BY_INDEX[idx]!)
              }
            }
            return present
          },

          /**
           * #getter
           * The per-read values the CPU-baked schemes painted in the rendered
           * reads (tag values, or mate refNames under chromosome painting).
           * `undefined` for other schemes, and the legend then does not filter;
           * the empty set means none are on screen. Gated on showLegend:
           * O(reads).
           */
          get presentTagValues(): ReadonlySet<string> | undefined {
            if (!self.showLegend || !isBakedScheme(self.colorBy)) {
              return undefined
            }
            return self.colorBy.type === 'mappingQuality'
              ? presentMapqs(this.laidOutByGroup)
              : collectAcrossGroups(this.laidOutByGroup, d => d.readTagValues)
          },

          /**
           * #getter
           * The modification types drawn in the rendered reads. Read from
           * `modificationTypes`, which the worker builds from the drawn marks;
           * `detectedModifications` includes hidden lanes. The legend's
           * bisulfite branch runs before this filter, since the two differ
           * there. `undefined` outside the modification schemes.
           */
          get presentModifications(): ReadonlySet<string> | undefined {
            if (!self.showLegend || !paintsModifications(self.baseLayer)) {
              return undefined
            }
            return collectAcrossGroups(
              this.laidOutByGroup,
              d => d.modificationTypes,
            )
          },

          /**
           * #getter
           * Derived from the session theme, so headless SVG export and RPC have
           * it without a mounted component.
           */
          get colorPalette(): ColorPalette {
            return this.colorPaletteIn(getPaletteHost(self).palette)
          },

          /**
           * #getter
           * `color.labels` against the read buckets and values it names, which
           * every key row, hover and connection curve names a bucket by.
           */
          get declaredReadLabels(): DeclaredReadLabels {
            return declaredReadLabels(self.colorEncoding, self.colorLabels)
          },

          /**
           * #method
           * The read palette over `theme`, with the category colors
           * `color` sets. SVG export passes its own theme.
           */
          colorPaletteIn(theme: JBrowsePalette): ColorPalette {
            return buildColorPaletteFromPalette(theme, {
              declared: writtenReadCategoryColors(
                self.colorSetting.value,
                self.colorEncoding,
              ),
            })
          },

          /**
           * #getter
           * The arc color slots plotted, mapped to legend buckets, for curved
           * arcs and the read cloud alike: both paint `arcColorField`, which
           * follows the reads only where they paint a pair field. Empty unless
           * an overlay is on with the legend shown.
           */
          get arcLegendCategories(): Set<ArcCategory> {
            const present = new Set<ArcCategory>()
            if (self.showLegend && self.readConnections !== 'off') {
              // `colorSlots`, not a walk of `arcsByGroup`, which holds only one
              // of the two halves arcs resolve into; see `ArcsByGroupResult`.
              for (const slot of this.arcsResult.colorSlots) {
                present.add(arcSlotCategory(slot, self.arcColorField))
              }
            }
            return present
          },

          /**
           * #getter
           * Which overlap mark the legend row names, undefined when none. The
           * row needs the pass to be DRAWING (`shouldDrawOverlaps`, shared with
           * both renderers) and some region to hold an interval, so no row
           * explains an off-screen mark. O(regions).
           */
          get overlapLegendKind(): 'chain' | 'collapsed' | undefined {
            if (
              !shouldDrawOverlaps({
                chainMode: self.unit === 'chain',
                collapseGroupRows: this.collapseGroupRows,
                featureHeight: this.featureHeight,
              })
            ) {
              return undefined
            }
            return someAcrossGroups(
              this.laidOutByGroup,
              d => d.overlapPositions.length > 0,
            )
              ? self.unit === 'chain'
                ? 'chain'
                : 'collapsed'
              : undefined
          },

          /**
           * #getter
           * The sections' order, where the facet reads the field the reads are
           * colored by: a key over one field lists it as the sections stack.
           */
          get keySectionOrder() {
            const facet = this.effectiveFacet
            return facet && facet.field === colorFieldOf(self.colorBy)
              ? sectionOrder(facet.field, facet.domain)
              : undefined
          },

          /**
           * #method
           */
          legendItems(palette: ColorPalette) {
            return getReadDisplayLegendItems({
              overlaps: this.overlapLegendKind,
              colorBy: self.colorBy,
              baseLayer: self.baseLayer,
              presentCategories: this.colorLegendCategories,
              palette,
              detectedModifications: this.detectedModifications,
              presentTagValues: this.presentTagValues,
              presentModifications: this.presentModifications,
              refNamePosition: this.paintedRefNamePosition,
              bakedScale: this.bakedColorScale,
              sectionOrder: this.keySectionOrder,
              baseQualityUnavailable: this.baseQualitySpan.unavailable,
              labels: this.declaredReadLabels,
            })
          },

          /**
           * #method
           * Key for the paired-end arc / read-cloud colors, empty when no
           * overlay is drawn.
           */
          arcLegendItems(palette: ColorPalette) {
            return getArcLegendItems(
              this.arcLegendCategories,
              palette,
              this.arcsResult.interchromFromMatePair,
              this.declaredReadLabels.categories,
            )
          },

          /**
           * #getter
           * Heading for the overlay's own color key, named after the overlay
           * the reader is looking at: flat read-cloud lines are not arcs.
           */
          get arcLegendTitle() {
            return self.readConnections === 'cloud'
              ? 'Read cloud colors'
              : 'Arc colors'
          },

          /**
           * #getter
           * Per group, which junctions draw in the strip below coverage (by
           * `junctionKey`): the one sashimi side decision, read by
           * `sashimiDownArcLanes` to reserve the strip and `sashimiFeedsByGroup`
           * to place each arc. refNames come from `loadedRegions`, keeping this
           * a tier-1 (fetch) derivation. A region not yet loaded gets a unique
           * key, so regions not proven to share a chromosome never pool onto
           * one bp line.
           */
          get sashimiDownKeysByGroup() {
            return buildSashimiDownKeys(self.rpcDataMap, {
              minSashimiScore: self.minSashimiScore,
              showNonCanonicalJunctions: self.showNonCanonicalJunctions,
              mode: self.sashimiArcsMode,
              refNameFor: i => self.loadedRegions.get(i)?.refName ?? `#${i}`,
              hidden: self.hiddenGroupKeys,
            })
          },

          /**
           * #getter
           * Group keys whose junctions land in the strip below coverage, i.e.
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
           * The ceiling of the three bands stacked over the pileup, which the
           * resize handles drag against and `bandHeights` draws within. Leaves
           * the pileup a row. Reads `fitTargetHeight`, not `height`, which
           * derives from the layout these heights feed in grow mode.
           */
          get resizableBandBounds() {
            const pileupReservePx = self.showPileup ? MIN_BAND_HEIGHT : 0
            return {
              max: Math.max(
                MIN_BAND_HEIGHT,
                self.fitTargetHeight - pileupReservePx,
              ),
            }
          },

          /**
           * #getter
           * The three band heights as every consumer draws them: the slots
           * bound to `resizableBandBounds`, since a config or a session
           * snapshot states a height no drag clamped.
           */
          get bandHeights() {
            const bounds = { min: 0, ...this.resizableBandBounds }
            return {
              coverageHeight: boundBandHeight(self.coverageHeight, bounds),
              readConnectionsHeight: boundBandHeight(
                self.readConnectionsHeight,
                bounds,
              ),
              sashimiArcsHeight: boundBandHeight(
                self.sashimiArcsHeight,
                bounds,
              ),
            }
          },

          /**
           * #getter
           * The settings half of the below-coverage band geometry: whether each
           * strip MAY be reserved and how tall, with neither data half
           * answered.
           */
          get belowCoverageBandsSettings(): BelowCoverageBandsSettings {
            return {
              ...this.bandHeights,
              showCoverage: self.showCoverage,
              readConnections: self.readConnections,
              readConnectionsDown: self.readConnectionsDown,
              showSashimiArcs: self.showSashimiArcs,
            }
          },

          /**
           * #getter
           * Inputs to `belowCoverageBandsGeometry`: the settings above plus
           * whether ANY lane has arcs or a sashimi junction bound for its
           * strip. Pooled over the lanes, so it is the ungrouped answer; the
           * grouped stack's total is `totalBandOverhead`.
           */
          get belowCoverageBandsInput() {
            return {
              ...this.belowCoverageBandsSettings,
              hasArcs: this.arcsResult.inkGroupKeys.size > 0,
              hasSashimiDownArcs: this.sashimiDownArcLanes.size > 0,
            }
          },

          /**
           * #getter
           * The height the below-coverage strips take from the fit-to-viewport
           * row budget: the bands reserved in every lane, summed as
           * `computeStackedSections` reserves them. Fetch-tier inputs only, so
           * the layout reads it without a cycle.
           */
          get totalBandOverhead() {
            return totalBelowCoverageOverhead(
              this.belowCoverageBandsSettings,
              this.groupOrder.map(g => g.key),
              this.arcsResult.inkGroupKeys,
              this.sashimiDownArcLanes,
            )
          },

          /**
           * #getter
           * The height overrides as row caps, keyed by lane — the layout's
           * input. Keeps its identity while the caps compare equal, so a drag
           * frame that moves no cap relays no read and re-bakes no color.
           */
          get groupRowCaps(): ReadonlyMap<string, RowCap> {
            rowCaps ??= stableIdentityComputed(() =>
              groupRowCaps(this.groupHeightOverrides, this.rowHeight),
            )
            return rowCaps.get()
          },

          /**
           * #getter
           * The cap a lane on the shared fit budget lays out to: its slice of
           * the viewport when grouped, the display-wide ceiling when not, with
           * the policy that set it (a clipped lane reports it as `clippedBy`).
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
            const { order } = this.groupLayoutContext
            return resolveFitDefaultCap({
              grouped: order.length > 1,
              height: self.autoHeight
                ? self.growMaxHeight
                : self.fitTargetHeight,
              visibleGroupCount: order.filter(
                g => !self.collapsedGroups.has(g.key),
              ).length,
              rowHeight: this.rowHeight,
              totalOverhead: this.totalBandOverhead,
              maxRows: this.fitCeilingRows,
            })
          },

          /**
           * #getter
           * How many rows the uncollapsed groups need, laid out uncapped. Reads
           * the overlaps and the ceiling only, so a fit drag leaves it alone.
           */
          get fitRows(): number {
            return fitRowCount(
              this.groupLayoutContext,
              self.maxHeight,
              self.collapsedGroups,
            )
          },

          /**
           * #getter
           * The `maxHeight` ceiling in rows. While fitting it is clamped to the
           * rows the pileup needs, so the quotient holds steady across drag
           * frames and the layout does not re-place every row.
           */
          get fitCeilingRows(): number {
            const ceiling = maxRowsFor(self.maxHeight, this.rowHeight)
            return this.isFitting ? Math.min(ceiling, this.fitRows) : ceiling
          },

          /**
           * #getter
           * Per-group laid-out data: group key → (region index → laid-out
           * data). Each group lays out independently under its own cap, so a
           * dense group cannot starve the rest. Rows only; the per-read color
           * arrays bake one computed later, in `laidOutByGroup`.
           */
          get laidOutByGroupUncolored() {
            return layoutGroupsToViewport(this.groupLayoutContext, {
              collapsedKeys: self.collapsedGroups,
              // Reads only the resolved caps, not the track height, row pitch
              // or band overhead behind them, which move a px per drag frame.
              maxRows: this.fitCeilingRows,
              defaultCap: this.fitDefaultCap,
              overrideCaps: this.groupRowCaps,
            })
          },

          /**
           * #getter
           * Whether the unpaired chain-strand framing is on: the one answer the
           * consensus pass, the bake (`readColorOpts`) and the key read. A
           * boolean in its own computed, so a scheme switch that leaves the
           * answer alone does not re-run the frame solve.
           */
          get framesChainStrand() {
            return framesUnpairedChainStrand(
              self.bodyColorScheme,
              self.unit === 'chain',
            )
          },

          /**
           * #getter
           * The laid-out data with every chain's strand frame settled — see
           * `applyChainStrandFrames`.
           */
          get laidOutByGroupFramed() {
            return applyChainStrandFrames(
              this.laidOutByGroupUncolored,
              self.unit === 'chain',
              this.framesChainStrand,
            )
          },

          /**
           * #getter
           * Per-group laid-out data with the per-read color arrays baked on.
           * Nothing in `readColorContext` moves a read's row, so a recolor
           * keeps the layout memoized and `readYs` keeps its identity: the GPU
           * upload memo checks `readYs` to rewrite only the read pass. Tag
           * colors bake here, not in the worker, so tag coloring stays a
           * main-thread tier-2 setting.
           */
          get laidOutByGroupColored() {
            return applyReadColorsByGroup(
              this.laidOutByGroupFramed,
              this.readColorContext,
            )
          },

          /**
           * #getter
           * `laidOutByGroupColored` with the straight-line pass's records
           * spread on, so a curved-connector toggle re-spreads the lines and
           * keeps both the layout and the colors.
           */
          get laidOutByGroup() {
            return attachLinkedReadLinesByGroup(
              this.laidOutByGroupColored,
              this.connectorsByGroup,
            )
          },

          /**
           * #getter
           * Every read connector per group, from one walk of its reads: the
           * straight-line pass's records and the pairs the bezier overlay
           * draws. Reads the layout tier, so a band resize, height drag or
           * recolor reuses them.
           */
          get connectorsByGroup() {
            return resolveConnectorsByGroup(
              self.coarseTierStandsIn ? new Map() : this.laidOutByGroupFramed,
              {
                lines: self.showLinkedReadLines,
                scope: self.bezierArcScope,
                canonicalRefName: this.canonicalRefName,
              },
              key =>
                stacksRows(
                  this.groupLayoutContext,
                  key,
                  this.groupRowCaps,
                  self.collapsedGroups,
                ),
            )
          },

          /**
           * #getter
           * The layout mechanics (grouping, sort, soft-clip) shared by the
           * viewport fit pass and ad-hoc layouts such as `fittedFeatureHeight`.
           * Excludes the fit policy (row caps) and the color inputs, which
           * invalidate a later tier.
           */
          get groupLayoutContext() {
            return {
              order: this.groupOrder,
              rawByGroup: this.chainedByGroup,
              unit: self.unit,
              sortedBy: this.sortedBy,
              showSoftClipping: self.showSoftClipping,
              layoutOrder: self.layoutOrder,
              regions: self.loadedRegions,
              collapseGroupRows: this.collapseGroupRows,
            }
          },

          /**
           * #getter
           * The per-read color bake's inputs, kept out of `groupLayoutContext`
           * so a recolor never relays.
           */
          get readColorContext() {
            return {
              colorBy: self.colorBy,
              bodyScheme: self.bodyColorScheme,
              readColorOpts: this.readColorOpts,
              bakedScale: this.bakedColorScale,
            }
          },

          /**
           * #getter
           * The span of a linear color field over the loaded reads, which a
           * ramp's open ends stretch across: their extremes, or below a
           * `domainQuantile` of 1 that quantile of each sign. Undefined
           * while `domainMin` and `domainMax` both pin the ramp or another
           * scale paints, so a region arriving rebakes nothing then.
           */
          get bakedColorExtent(): NumericExtent | undefined {
            const encoding = self.colorEncoding
            return typeof encoding === 'object' &&
              encoding.scale === 'linear' &&
              (encoding.domainMin === undefined ||
                encoding.domainMax === undefined)
              ? (encoding.domainQuantile ?? 1) < 1 &&
                self.colorBy.type === 'tag'
                ? quantileExtentAcrossGroups(
                    this.laidOutByGroupFramed,
                    d => d.readTagValues,
                    encoding.domainQuantile!,
                  )
                : this.tagValueExtent
              : undefined
          },

          /**
           * #getter
           * The span of a linear color field over the loaded reads, pinned
           * ends or not, which the key marks an end the reads run past by.
           */
          get tagValueExtent(): NumericExtent | undefined {
            const encoding = self.colorEncoding
            const { type } = self.colorBy
            return typeof encoding !== 'object' || encoding.scale !== 'linear'
              ? undefined
              : type === 'mappingQuality'
                ? mapqExtentAcrossGroups(this.laidOutByGroupFramed)
                : type === 'tag'
                  ? numericExtentAcrossGroups(
                      this.laidOutByGroupFramed,
                      d => d.readTagValues,
                    )
                  : undefined
          },

          /**
           * #getter
           * The span of the base qualities drawn, and whether a base carries
           * none. O(bases), so gated on showLegend like the category scan.
           */
          get baseQualitySpan(): QualitySpan {
            return self.showLegend && self.baseLayer?.type === 'perBaseQuality'
              ? baseQualitySpanAcrossGroups(this.laidOutByGroupFramed)
              : NO_QUALITY_SPAN
          },

          /**
           * #getter
           * The scale a tag, attribute or mate reference bakes through, read by
           * the per-read bake and the key alike. Undefined for the fields the
           * category table paints.
           */
          get bakedColorScale() {
            return isBakedScheme(self.colorBy)
              ? bakedColorScale(
                  self.colorBy,
                  self.colorEncoding,
                  this.paintedRefNamePosition,
                  this.bakedColorExtent,
                )
              : undefined
          },

          /**
           * #getter
           * Where a mate's reference sits in this assembly's own chromosome
           * order, for chromosome painting — the same
           * `Assembly.getRefNamePosition` the comparative displays paint by.
           * From the ASSEMBLY, not the reads on screen, so a color never
           * changes with what else is in view. Undefined under every other
           * scheme and until the assembly initializes.
           */
          get paintedRefNamePosition() {
            const assembly =
              self.colorBy.type === 'mateRefName'
                ? self.loadedAssembly
                : undefined
            return assembly?.getRefNamePosition
          },

          /**
           * #getter
           * The non-scheme inputs to read classification, with the framing as
           * `framesChainStrand` answered it, so the bake frames exactly where
           * the consensus pass ran and the key words it.
           */
          get readColorOpts() {
            return {
              chainMode: self.unit === 'chain',
              framesChainStrand: this.framesChainStrand,
            }
          },

          /**
           * #getter
           * Group keys + labels in stacking order; one entry (key '') when
           * ungrouped. Derived from the fetched `rpcDataMap`, not the layout
           * pass, so group identity and order stay stable across relayouts.
           */
          get groupOrder() {
            const facet = this.effectiveFacet
            return orderedGroups(
              self.rpcDataMap,
              self.hiddenGroupKeys,
              sectionOrder(facet?.field ?? '', facet?.domain),
            )
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
            return hasNamedGroups(this.groupOrder)
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
           * Raw (un-laid-out) data regrouped as group key → (region idx →
           * data), insertion-ordered so the first key is the primary group;
           * ungrouped is the single key `''`. Hidden lanes are already gone,
           * like `groupOrder`, so a walk of every entry is a walk of every
           * DRAWN lane. See `buildRawDataByGroup`.
           */
          get rawDataByGroup() {
            return buildRawDataByGroup(
              self.rpcDataMap,
              self.hiddenGroupKeys,
              self.pinnedInsertSizeBand,
            )
          },

          /**
           * #getter
           * `rawDataByGroup` with chain identity joined across every region and
           * lane (`attachChainFields`), in chain mode only. The worker knows no
           * chains, so toggling the mode is this getter changing, not a fetch.
           */
          get chainAttachment() {
            return self.unit === 'chain'
              ? attachChainFields(this.rawDataByGroup)
              : undefined
          },

          /**
           * #getter
           * The layout's input: `chainAttachment` in chain mode, else the
           * fetched data. `rawDataByGroup` stays chain-free, so the arcs,
           * sashimi, coverage and a split view overlaying this display do not
           * recompute on the toggle.
           */
          get chainedByGroup(): ReadonlyMap<
            string,
            ReadonlyMap<number, ChainedPileupData>
          > {
            return this.chainAttachment ?? this.rawDataByGroup
          },

          /**
           * #getter
           * Chain name → the ids of the READS in it; empty outside chain mode.
           * The key is a chain's own identity and the values are read ids,
           * which consumers resolve through `readIdToIndex` / `readIdIndexMap`
           * (hence `highlightedChainReadIds`, `selectedChainReadIds`).
           */
          get readIdsByChainName(): ReadonlyMap<string, string[]> {
            const chained = this.chainAttachment
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
           * Normalizer for a refName in the BAM's own spelling (an SA tag's or
           * RNEXT's `chr1`) rather than the assembly-canonical one a fetched
           * read carries (`1`). Undefined when no assembly is resolved, where
           * consumers fall back to identity. Without it a same-chromosome split
           * junction reads as inter-chromosomal.
           */
          get canonicalRefName() {
            const assembly = self.loadedAssembly
            return assembly
              ? (refName: string) => assembly.getCanonicalRefName2(refName)
              : undefined
          },

          /**
           * #getter
           * THE arc resolution: both halves from one pass, read through
           * `arcsByGroup` (arcs inside one region) or `crossRegionArcsByGroup`
           * (arcs joining two). `computeArcsByGroup` owns the whole fan-out
           * because the pooled arc scale (`poolArcScale`) describes the fetch,
           * not a lane. Hidden lanes must stay out: the cross-group scans
           * (`arcsYDomainBp`, `arcLegendCategories`) walk every entry.
           */
          get arcsResult(): ArcsByGroupResult {
            if (self.readConnections === 'off' || self.rpcDataMap.size === 0) {
              return {
                byGroup: new Map(),
                crossRegionByGroup: new Map(),
                inkGroupKeys: new Set(),
                colorSlots: new Set(),
                interchromFromMatePair: false,
                maxFlatArcSpanBp: 0,
              }
            }
            const settings = {
              colorField: self.arcColorField,
              cloud: self.readConnections === 'cloud',
              showInterchrom: self.showInterchrom,
              showLongRange: self.showLongRange,
              showProperPairArcs: self.showProperPairArcs,
              showModalPairsInCloud: self.showModalPairsInCloud,
              minInterchromSupport: self.minInterchromSupport,
              canonicalRefName: this.canonicalRefName,
            }
            return computeArcsByGroup(
              this.rawDataByGroup,
              {
                loaded: this.loadedRegionInfos,
                displayed: this.displayedRegionInfos,
              },
              settings,
            )
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

          /**
           * #getter
           * The band's marks' input, per group and region
           * (`buildArcBandFeeds`).
           */
          get arcFeedsByGroup() {
            return this.arcFeedsByGroupIn(this.colorPalette)
          },

          /**
           * #method
           * `arcFeedsByGroup` colored from `colors`, which the SVG export
           * passes to draw in its own theme.
           */
          arcFeedsByGroupIn(colors: ColorPalette) {
            const { byGroup, crossRegionByGroup } = this.arcsResult
            const displayed = this.displayedRegionInfos
            return new Map(
              [...byGroup].map(([key, byRegion]) => [
                key,
                buildArcBandFeeds({
                  byRegion,
                  crossRegion: crossRegionByGroup.get(key) ?? [],
                  displayed,
                  colors,
                  colorField: self.arcColorField,
                }),
              ]),
            )
          },
        }
      })
      .views(self => ({
        /**
         * #getter
         */
        get modificationThreshold() {
          return (
            self.modificationSettings.threshold ??
            DEFAULT_MODIFICATION_THRESHOLD
          )
        },

        /**
         * #getter
         */
        get colorSchemeIndex() {
          return colorSchemeIndexFor(self.bodyColorScheme)
        },

        /**
         * #getter
         */
        get showModifications() {
          return paintsModifications(self.baseLayer)
        },

        /**
         * #getter
         * Contrast colors for the mismatch/softclip/per-base letters, off the
         * session palette. SVG export calls `getMismatchContrastMap` with its
         * own palette.
         */
        get mismatchContrastMap(): Record<string, string> {
          return getMismatchContrastMap(
            this.showModifications,
            getPaletteHost(self).palette,
          )
        },

        /**
         * #getter
         */
        get showPerBaseQuality() {
          return self.baseLayer?.type === 'perBaseQuality'
        },

        /**
         * #getter
         */
        get showPerBaseLetter() {
          return self.baseLayer?.type === 'perBaseLetter'
        },

        /**
         * #getter
         */
        get readIdIndexMap() {
          return buildReadIdIndexMap(self.rpcDataMap, self.hiddenGroupKeys)
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
         * Geometry of the bands stacked below coverage in arcs-down mode:
         * coverage → paired-end arcs → sashimi. `arcsBandTop`/`sashimiBandTop`
         * are each band's top edge; `bottom` is where the pileup begins (==
         * coverageDisplayHeight).
         */
        get belowCoverageBands() {
          return belowCoverageBandsGeometry(self.belowCoverageBandsInput)
        },

        /**
         * #getter
         */
        get coverageDisplayHeight() {
          return this.belowCoverageBands.bottom
        },
      }))
      .views(self => ({
        /**
         * #getter
         * The stacked lanes in stacking order, one `AlignmentLane` per drawn
         * group; ungrouped is the one-lane case. The one place a lane's key
         * resolves to its data. Empty while the density tier is shown: every
         * overlay walks `renderSections`, and `drawnLanes` turns the empty list
         * into the synthetic no-data lane.
         */
        get lanes(): AlignmentLane[] {
          return self.coarseTierStandsIn
            ? []
            : buildLanes({
                order: self.groupOrder,
                rawByGroup: self.rawDataByGroup,
                laidOutByGroup: self.laidOutByGroup,
                arcInkKeys: self.arcsResult.inkGroupKeys,
                sashimiDownKeysByGroup: self.sashimiDownKeysByGroup,
                collapsedKeys: self.collapsedGroups,
                heightOverridesPx: self.groupHeightOverrides,
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
         * All vertical band geometry, one entry per lane; ungrouped is the
         * one-lane call. Runs over `drawnLanes` so a display with no data still
         * has a section. The sticky-coverage-vs-scroll distinction lives
         * downstream in `buildSectionRenders`.
         */
        get sections(): SectionsLayout {
          return computeStackedSections(toSectionGroupInputs(this.drawnLanes), {
            ...self.belowCoverageBandsSettings,
            coverageYOffset: YSCALEBAR_LABEL_OFFSET,
            rowHeight: self.rowHeight,
            minSectionHeight: self.showsGroupLabels ? GROUP_LABEL_HEIGHT : 0,
            dipReservePx: self.fitHeightToDisplay
              ? undefined
              : (groupKey, pileupHeight) => {
                  const pairs =
                    self.connectorsByGroup.get(groupKey)?.overlayPairs
                  return pairs?.length
                    ? bezierDipReservePx({
                        pairs,
                        displayedRegions: self.host.displayedRegions,
                        featureHeight: self.featureHeight,
                        featureSpacing: self.featureSpacing,
                        pileupHeight,
                      })
                    : 0
                },
          })
        },

        /**
         * #getter
         * Every lane paired with its band geometry in stacking order: the list
         * the overlays, the hit-test pipeline and both renderers walk. The
         * pairing is by INDEX, structural since `computeStackedSections` emits
         * one section per lane in order from `drawnLanes`.
         */
        get renderSections() {
          return zipLaneSections(this.drawnLanes, this.sections.sections)
        },

        /**
         * #getter
         * The pairs the bezier overlay draws, placed on each drawn section's
         * pileup band.
         */
        get bezierPairSections() {
          return this.renderSections.flatMap(sec => {
            const pairs = self.connectorsByGroup.get(sec.groupKey)?.overlayPairs
            return pairs?.length
              ? [
                  {
                    groupKey: sec.groupKey,
                    topOffset: sec.topOffset,
                    pileupHeight: sec.pileupHeight,
                    dipReserve: sec.dipReserve,
                    pairs,
                  },
                ]
              : []
          })
        },

        /**
         * #getter
         * The connection types (LINKED_READ_COLOR_*) drawn in view, by the
         * overlay's curves and by the straight-line pass beside them, so the
         * key lists every connector color on screen. Empty while the legend is
         * hidden so the scan is skipped.
         */
        get connectionColorTypes(): Set<number> {
          const present = new Set<number>()
          if (self.showLegend) {
            for (const {
              lines,
              overlayPairs,
            } of self.connectorsByGroup.values()) {
              for (const pair of overlayPairs) {
                present.add(pair.c.colorType)
              }
              for (const region of lines.values()) {
                for (const colorType of region.linkedReadLineColorTypes) {
                  present.add(colorType)
                }
              }
            }
          }
          return present
        },

        /**
         * #method
         * Legend swatches for the read connectors.
         */
        connectionLegendItems(palette: ColorPalette) {
          return bezierConnectionLegendItems(
            this.connectionColorTypes,
            palette,
            self.declaredReadLabels.categories,
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
         * The coverage band held out of the scroll: ungrouped keeps it sticky
         * above the pileup, grouped scrolls the whole stack. Subtracted from
         * both the viewport and the content.
         */
        get stickyBandHeight() {
          return this.isGrouped ? 0 : self.coverageDisplayHeight
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
        get showOutline() {
          return getConf(self, 'showOutline') ?? self.unit === 'chain'
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
            mismatchAlpha: self.mismatchAlpha,
            scrollTop: self.scrollTop,
          })
        },

        /**
         * #method
         * Content-space Y of a group's pileup relative to the reserved
         * below-coverage height: how far a read's row shifts because its group
         * is stacked below the others. Callers add `coverageDisplayHeight`
         * back. Slightly negative for a lane that drops its arc band (`hasArcs`
         * false).
         */
        groupPileupOffset(groupKey: string) {
          const section = this.renderSections.find(s => s.groupKey === groupKey)
          return section === undefined
            ? 0
            : section.topOffset - self.coverageDisplayHeight
        },

        /**
         * #method
         * Read ids sharing a chain with the read at `index` in `rpcData`, the
         * read's own included. Empty when the read is in no chain. Shared by
         * hover-highlight and click-select.
         */
        readIdsSharingChain(rpcData: ChainedPileupData, index: number) {
          return chainReadIdsAt(rpcData, index, self.readIdsByChainName)
        },

        /**
         * #method
         * `readIdsSharingChain` from a read id alone, for a caller holding no
         * block — the bezier overlay, whose arcs carry ids. Empty outside chain
         * mode and for an id no fetched region holds.
         */
        readIdsSharingChainWith(featureId: string) {
          const hit =
            self.unit === 'chain'
              ? self.findFeatureInRpcData(featureId)
              : undefined
          return hit ? this.readIdsSharingChain(hit.rpcData, hit.idx) : []
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
         * #method
         */
        getFeatureInfoById(featureId: string) {
          const hit = self.findFeatureInRpcData(featureId)
          const region = hit && self.loadedRegions.get(hit.displayedRegionIndex)
          return hit && region
            ? {
                ...readInfo(hit, region, featureId),
                lodMode: self.rpcDataMap.get(hit.displayedRegionIndex)?.lodMode,
              }
            : undefined
        },

        /**
         * #getter
         * Names one read color bucket for the hover, with the active scheme's
         * rewording applied — the same `readCategoryLabelOverrides` the legend
         * uses, so the tooltip and its swatch agree.
         */
        get readCategoryLabel() {
          const overrides = readCategoryLabelOverrides(
            self.colorBy,
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
          const { interchromFromMatePair } = self.arcsResult
          const { categories } = self.declaredReadLabels
          return (c: ArcCategory) =>
            arcColorCategoryLabel(c, interchromFromMatePair, categories)
        },
      }))
      .views(self => ({
        /**
         * #getter
         * The reads a view overlaying this display may connect — the
         * BreakpointSplitView's curves — by lane and region index, with hidden
         * lanes dropped. Empty while no pileup is laid out, so an overlay draws
         * no read this display does not.
         */
        get readArraysByGroup(): ReadonlyMap<
          string,
          ReadonlyMap<number, WorkerPileupData>
        > {
          return self.layoutReady ? self.rawDataByGroup : new Map()
        },

        /**
         * #method
         * Layout rect of one read of `readArraysByGroup`. Y is relative to the
         * pileup's own top (callers add `coverageDisplayHeight`), so a grouped
         * read needs only its section's stacking offset on top of its row. A
         * read past the row cap sits on the cap's overflow row.
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
          if (yRow === undefined || start === undefined || end === undefined) {
            return undefined
          }
          const top = self.groupPileupOffset(groupKey) + yRow * self.rowHeight
          return [start, top, end, top + self.featureHeight]
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
            if (!self.showSashimiArcs || !view.initialized) {
              return []
            }
            const filter = {
              minSashimiScore: self.minSashimiScore,
              showNonCanonicalJunctions: self.showNonCanonicalJunctions,
            }
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
           * The sashimi marks' input, per group and region
           * (`buildSashimiBandFeeds`). In bp, so a pan or zoom rebuilds
           * nothing.
           */
          get sashimiFeedsByGroup() {
            return this.sashimiFeedsByGroupIn(self.colorPalette)
          },

          /**
           * #method
           * `sashimiFeedsByGroup` colored from `colors`, which the SVG export
           * passes to draw in its own theme.
           */
          sashimiFeedsByGroupIn(colors: ColorPalette) {
            if (!this.drawsSashimi) {
              return NO_SASHIMI_FEEDS_BY_GROUP
            }
            const displayed = self.displayedRegionInfos
            return new Map(
              this.sashimiJunctionSections.map(sec => [
                sec.groupKey,
                buildSashimiBandFeeds({
                  junctions: sec.junctions,
                  downJunctionKeys: sec.sashimiDownKeys,
                  displayed,
                  colors,
                }),
              ]),
            )
          },

          /**
           * #getter
           * Per-section upload input in stacking order: each section's laid-out
           * region map with its arc and sashimi feeds, keyed by group. Both renderers pair uploaded
           * section `s` with drawn section `s` by INDEX, so this list and
           * `renderState.sections` both derive from `renderSections` and share
           * its length and order.
           */
          get sourceSections(): SectionSource[] {
            return this.sourceSectionsWith(
              self.arcFeedsByGroup,
              this.sashimiFeedsByGroup,
            )
          },

          /**
           * #method
           * `sourceSections` with the connections colored from `colors`, for
           * the SVG export's theme.
           */
          sourceSectionsIn(colors: ColorPalette): SectionSource[] {
            return this.sourceSectionsWith(
              self.arcFeedsByGroupIn(colors),
              this.sashimiFeedsByGroupIn(colors),
            )
          },

          /**
           * #method
           * The laid-out sections with each lane's read connections and splice
           * junctions, which join here rather than on the lane: both are colored, and the
           * layout must not read the palette.
           */
          sourceSectionsWith(
            feeds: ReadonlyMap<string, ReadonlyMap<number, ArcBandFeed>>,
            sashimiFeeds: ReadonlyMap<
              string,
              ReadonlyMap<number, SashimiBandFeed>
            >,
          ): SectionSource[] {
            return self.renderSections.map(
              ({ groupKey, laidOutPileupMap }) => ({
                groupKey,
                laidOutPileupMap,
                arcFeeds: feeds.get(groupKey) ?? NO_ARC_FEEDS,
                sashimiFeeds: sashimiFeeds.get(groupKey) ?? NO_SASHIMI_FEEDS,
              }),
            )
          },

          /**
           * #getter
           * The junction strands drawn, one key row each. Read off the merged
           * junctions rather than the projected arcs, so a pan does not rebuild
           * the legend.
           */
          get sashimiLegendStrands(): ReadonlySet<number> {
            const strands = new Set<number>()
            if (self.showLegend) {
              for (const sec of this.sashimiJunctionSections) {
                for (const j of sec.junctions) {
                  strands.add(j.strand)
                }
              }
            }
            return strands
          },

          /**
           * #method
           * The slots of the reads in the junction's lane whose skip gap it is.
           */
          sashimiSupportingReadSlots(junction: LaneJunction) {
            const sec = self.renderSections.find(
              s => s.groupKey === junction.groupKey,
            )
            return sec
              ? junctionSupportingReadSlots(
                  [...sec.laidOutPileupMap].map(([i, data]) => ({
                    displayedRegionIndex: i,
                    refName: self.loadedRegions.get(i)?.refName,
                    data,
                  })),
                  junction,
                )
              : []
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
            const palette = self.colorPaletteIn(theme)
            return getAlignmentsColorScales({
              ramps: colorRampScales({
                colorBy: self.colorBy,
                baseLayer: self.baseLayer,
                bakedScale: self.bakedColorScale,
                tagValueExtent: self.tagValueExtent,
                baseQualityExtent: self.baseQualitySpan.extent,
              }),
              colorTitle: self.colorTitle,
              legendItems: () => self.legendItems(palette),
              arcLegendTitle: self.arcLegendTitle,
              arcLegendItems: () => self.arcLegendItems(palette),
              connectionLegendItems: () => self.connectionLegendItems(palette),
              sashimiLegendItems: sashimiLegendItems(
                this.sashimiLegendStrands,
                theme.alignmentFill,
              ),
            })
          },
        }
      })
      .views(self => ({
        /**
         * #getter
         * The read height that makes every uncollapsed group's reads fill the
         * display without scrolling (`fittedReadPitch`). The uncapped row count
         * uses a fixed `maxHeight`-row cap, independent of `featureHeight`, so
         * the fit autorun that writes `featureHeight` cannot feed back into it.
         * Reads `fitTargetHeight`, not the reactive `height` getter — the
         * anti-cycle rule `laidOutByGroup` follows.
         */
        get fittedFeatureHeight() {
          return fittedReadPitch({
            rows: self.fitRows,
            fitTargetHeight: self.fitTargetHeight,
            totalOverhead: self.totalBandOverhead,
          })
        },

        /**
         * #getter
         * Only the tag NAME goes to the worker, so `rpcProps` re-notifies when
         * the tag changes, not when the sort position or a non-tag type flips.
         */
        get sortTag() {
          return self.sortedBy?.type === 'tag' ? self.sortedBy.tag : undefined
        },

        /**
         * #getter
         */
        get renderState() {
          const palette = self.colorPalette
          return {
            scrollTop: self.scrollTop,
            colorScheme: self.colorSchemeIndex,
            featureHeight: self.featureHeight,
            featureSpacing: self.featureSpacing,
            coverageHeight: self.belowCoverageBands.coverageHeight,
            coverageMinDepth: self.coverageDepthDomain?.[0],
            coverageMaxDepth: self.coverageDepthDomain?.[1],
            coverageScaleType: self.coverageScaleType,
            // The raw slot means "derive from the domain"; resolved here, where
            // the domain is in hand, so every backend normalizes with one
            // number.
            coverageSymlogConstant: resolveSymlogConstant(
              self.coverageDepthDomain?.[0] ?? 0,
              self.coverageDepthDomain?.[1] ?? 0,
              self.symlogConstant,
            ),
            coverageSnpMinFrequency: self.coverageSnpMinFrequency,
            sashimiArcsHeight: self.bandHeights.sashimiArcsHeight,
            showMismatches: self.showMismatches,
            filterMismatchesByFrequency: self.fadeLowFreqMismatches,
            mismatchAlpha: self.mismatchAlpha,
            showSoftClipping: self.showSoftClipping,
            showInterbaseIndicators: self.showInterbaseIndicators,
            showModifications: self.showModifications,
            showPerBaseQuality: self.showPerBaseQuality,
            showPerBaseLetter: self.showPerBaseLetter,
            showOutline: self.showOutline,
            pileupTopOffset: self.coverageDisplayHeight,
            coverageTopOffset: 0,
            sections: buildSectionRenders(self.sections, {
              scrollTop: self.scrollTop,
              canvasHeight: self.height,
            }),
            // The mixin's resolved canvas box, not `view.width` — see
            // `canvasWidthPx`.
            canvasWidth: self.canvasWidthPx,
            canvasHeight: self.height,
            colors: palette,
            chainMode: self.unit === 'chain',
            showLinkedReadLines: self.showLinkedReadLines,
            collapseGroupRows: self.collapseGroupRows,
            readConnectionsLineWidth: self.readConnectionsLineWidth,
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
          return (self.readConnections === 'off' && !self.drawsSashimi) ||
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
                self.sourceSections.map(sec => sec.sashimiFeeds),
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
          if (!id?.startsWith(SASHIMI_FEATURE_ID_PREFIX)) {
            return undefined
          }
          const state = this.renderState
          for (const [s, sec] of state.sections.entries()) {
            const groupKey = self.renderSections[s]?.groupKey
            const feeds =
              groupKey === undefined
                ? undefined
                : self.sashimiFeedsByGroup.get(groupKey)
            const highlight =
              feeds && groupKey !== undefined
                ? selectedSashimiHighlight(id, groupKey, feeds, {
                    ...state,
                    sashimi: sashimiBandsOf(state, sec),
                  })
                : undefined
            if (highlight) {
              return highlight
            }
          }
          return undefined
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
          const { ids, strong } = readsToLight({
            unit: self.unit,
            chainReadIds: self.highlightedChainReadIds,
            readId: self.featureIdUnderMouse,
          })
          return this.readInk(ids, strong)
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
         * The boxes the named reads painted, clipped to their sections. Reading
         * `readIdIndexMap` builds over the whole fetched dataset, so it waits
         * until something is hovered or selected.
         */
        readInk(ids: readonly string[], strong: boolean): HighlightRect[] {
          return ids.length > 0
            ? this.slotInk(slotsOfIds(ids, self.readIdIndexMap), strong)
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
          if (self.readConnections !== 'cloud') {
            return undefined
          }
          // Maxed across every group and both halves by `computeArcsByGroup`,
          // so all sections share one Y-domain. The largest INSERT SIZE, not
          // the largest drawn Y: the insert-size scale in `valueScales` labels
          // its top tick with this number, and the cloud's ±8% jitter would
          // print a template length no read has.
          return Math.max(1000, self.arcsResult.maxFlatArcSpanBp)
        },

        /**
         * #getter
         * Overrides `ScoreScaleMixin`'s: `scales.y.rules` are depths, so they
         * draw on the coverage band, and not while the density tier's
         * feature counts stand in for it.
         */
        get scoreRulesDrawn(): boolean {
          return self.showCoverage && !self.coarseTierStandsIn
        },

        /**
         * #getter
         * The scales the chrome places the axes from. Coverage rules one band
         * per section, on the right wherever the group label chips take the
         * left edge. While the density tier stands in, its scale counts
         * features per bin and keeps the unit-free guides of `scales.y`. The
         * read cloud's insert-size scale rules each section's arc band,
         * captioned TLEN. Each band projects through its section's own scroll;
         * the chrome drops the off-screen ones.
         */
        get valueScales(): ValueScale[] {
          const { scrollModel: scroll, renderSections } = self
          const scales: ValueScale[] = []
          if (self.showCoverage && self.coverageDepthDomain) {
            const counts = self.coarseTierStandsIn
            scales.push({
              domain: self.coverageDepthDomain,
              scaleType: self.scaleType,
              height: self.bandHeights.coverageHeight,
              ticks: self.coverageTicks,
              side: self.showsGroupLabels ? 'right' : 'left',
              symlogConstant: self.symlogConstant,
              caption: counts ? 'features per bin' : self.scaleTitle,
              rules: counts ? [] : self.scoreRules,
              grid: self.grid,
              bandTops: renderSections.map(section =>
                bandScreenTop(section.coverageTop, scroll),
              ),
            })
          }
          const arcsYDomainBp = this.arcsYDomainBp
          const banded = renderSections.filter(s => s.arcBandHeight > 0)
          const band = banded[0]
          if (arcsYDomainBp !== undefined && band) {
            const down = self.readConnectionsDown
            const ticks = computeInsertSizeTicks({
              band: { top: 0, height: band.arcBandHeight, down },
              arcsYDomainBp,
            })
            if (ticks) {
              scales.push({
                domain: [1, arcsYDomainBp],
                scaleType: 'log',
                height: band.arcBandHeight,
                ticks,
                side: down ? 'left' : 'right',
                caption: 'TLEN',
                bandTops: banded.map(section =>
                  bandScreenTop(section.arcBandTop, scroll),
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
         * Arc-only fields (`arcColor`, `showInterchrom`, `showLongRange`) are
         * NOT here: `arcsResult` reads them and they need no refetch. Non-tag
         * sort changes and tag coloring (`readTagColors`, baked in
         * `laidOutByGroup`) stay main-thread. Its own views block, after every
         * field it reads, so it reads them off `self`: a subclass override
         * captures the base as a bare function, which would lose a `this`.
         */
        rpcProps() {
          return {
            filterBy: self.readFilter,
            // Only the part the worker reads, so switching between
            // shader-decided schemes leaves these props identical and repaints
            // without a refetch.
            colorBy: workerColorBy(self.colorBy),
            baseLayer: self.baseLayer,
            // Chain layout reads neither the sort tag nor soft-clipped bases,
            // so chain mode sends neither and "Show soft clipping" stays live
            // there.
            sortTag: self.unit === 'chain' ? undefined : self.sortTag,
            facet: workerFacet(self.effectiveFacet, self.unit),
            showSoftClipping:
              self.unit === 'chain' ? false : self.showSoftClipping,
            // The worker skips the whole coverage-band pipeline, including the
            // per-bp GPU depth buffer that overflows the device limit at
            // chromosome scale, when the band is off.
            showCoverage: self.showCoverage,
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
         * entry per aligned base of EVERY read, so sampling one base per
         * sub-pixel window bounds the extract by the VIEWPORT, not the region.
         * Not an `rpcProps` field — see `zoomFetchArgs`.
         */
        get perBaseBinBp() {
          return paintsEveryBase(self.baseLayer) ? self.settledSubPixelBinBp : 1
        },

        /**
         * #getter
         * The same bin off the LIVE zoom, read by `dataSuperseded` alone. The
         * debounced bin is what the held data was fetched under, so it cannot
         * say whether that data is sampled finely enough. Kept out of
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
          return { perBaseBinBp: self.perBaseBinBp, lodMode: self.lodTier }
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
            Object.fromEntries(self.groupMaxHeightOverrides),
          ]
        },
      }))
      .actions(self => {
        const dropHiddenGroups = self.dropGroupState
        return {
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
           * The mixin's reset plus the collapses and per-group height
           * overrides, which are keyed by group key too.
           */
          dropGroupState() {
            dropHiddenGroups()
            self.collapsedGroups.clear()
            self.groupMaxHeightOverrides.clear()
          },
        }
      })
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
          if (self.highlightedChainReadIds.length > 0) {
            self.highlightedChainReadIds = []
          }
        }
        function setSortSlot(sortedBy: SortedBy) {
          setConf(self, 'layoutOrder', 'position')
          setConf(self, 'sortedBy', sortedBy)
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
           */
          setColorBy(colorBy: ReadColorBy) {
            // A re-pick of the scheme in use writes nothing: the write would
            // replace the slot's arrays, and every color tier keys on them.
            if (!compareStructural(colorBy, self.colorBy)) {
              setConf(
                self,
                'color',
                colorSnapshotFor(colorBy, self.writtenColor),
              )
            }
          },

          /**
           * #action
           * Color by a read tag as categories, a color per value, or on a
           * gradient over its numeric values.
           */
          setColorByTag(tag: string, scale: TagColorScale) {
            setConf(self, 'color', {
              ...colorSnapshotFor({ type: 'tag', tag }, self.writtenColor),
              scale: scale === 'linear' ? 'linear' : undefined,
            })
          },

          /**
           * #action
           * Draw a per-base layer over the reads, or none. The read fill is
           * `setColorBy`'s and stays as it is.
           */
          setBaseLayer(layer?: BaseLayer) {
            if (!compareStructural(layer, self.baseLayer)) {
              const field: string | undefined = getConf(self, [
                'baseColor',
                'field',
              ])
              setConf(
                self,
                'baseColor',
                layer
                  ? { field: BASE_COLOR_FIELDS[layer.type] }
                  : field
                    ? { field, scale: 'none' }
                    : {},
              )
              if (layer?.modifications) {
                setConf(self, 'modifications', layer.modifications)
              }
            }
          },

          /**
           * #action
           * Replace the `color` object whole: `"steelblue"`,
           * `{ field: 'tags.HP', range: [...] }`.
           */
          setColor(color: string | Partial<AlignmentsColorSetting>) {
            setConf(self, 'color', color)
          },

          /**
           * #action
           */
          setReadFilter(filterBy: ReadFilter) {
            setConf(self, 'filter', filterBy)
          },

          /**
           * #action
           */
          setShowSoftClipping(value: boolean) {
            setConf(self, 'showSoftClipping', value)
          },

          /**
           * #action
           */
          setMismatchAlpha(value: boolean) {
            setConf(self, 'mismatchAlpha', value)
          },

          /**
           * #action
           */
          setSortedBy(type: string, tag?: string) {
            const view = self.view
            const { centerLineInfo } = view
            // Every sort type here anchors on the position (`partitionBySort`
            // ranks by membership at `sortPos`), so reveal the center line
            // either way.
            view.setShowCenterLine(true)
            if (centerLineInfo && !centerLineInfo.oob) {
              setSortSlot({
                type,
                // `offset` counts bp INTO the region, the worker compares
                // absolute `readPositions`, and a reversed region mirrors the
                // base drawn here: go through `basePaintedAt`, as the
                // context-menu sort does.
                pos: basePaintedAt(centerLineInfo, centerLineInfo.offset),
                refName: centerLineInfo.refName,
                tag,
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
           * Commit a sort, the one place the `sortedBy` slot is written. Also
           * resets `layoutOrder`: the two are one radio group.
           */
          setSortedByAtPosition: setSortSlot,

          /**
           * #action
           * The orderings that are not a `sortedBy` column sort, and the
           * clear of that sort, which the radio group needs together.
           */
          setLayoutOrder(order: LayoutOrder) {
            setConf(self, 'layoutOrder', order)
            setConf(self, 'sortedBy', null)
          },

          /**
           * #action
           * Writes the `facet` object; undefined is ungrouped. A tier-1 refetch
           * setting (in `rpcProps`). Resets the Y scroll since the stacked
           * content height changes. `HiddenGroupsMixin`'s key-space reset drops
           * the per-lane state. A grouping named without a domain keeps the
           * current one while the key space holds, so a re-pick is not a
           * reorder.
           */
          setFacet(facet?: Facet) {
            const current = self.facet && {
              ...self.facet,
              hidden: getConf(self, ['facet', 'hidden']),
            }
            setConf(self, 'facet', carryGroupDomain(facet, current) ?? {})
            self.scrollTop = 0
          },

          /**
           * #action
           * Draw each group as one row, overlap depth shown as tint. Clears the
           * per-group height overrides: an override opts a lane out of the
           * collapse, which means nothing once every lane is a stack again.
           */
          setCollapseGroupRows(flag: boolean) {
            setConf(self, 'collapseGroupRows', flag)
            self.groupMaxHeightOverrides.clear()
            self.scrollTop = 0
          },

          /**
           * #action
           * Expand a fit-to-viewport group to the full `maxHeight` cap, or, if
           * it already carries an override, drop it to return the group to the
           * fit budget. Expanding overflows the viewport, which engages the
           * pileup scroll. Pairs with `groupHeightOverrides`.
           */
          toggleGroupExpanded(key: string) {
            if (self.groupMaxHeightOverrides.has(key)) {
              self.groupMaxHeightOverrides.delete(key)
            } else {
              self.groupMaxHeightOverrides.set(key, self.maxHeight)
            }
          },

          /**
           * #action
           * Drag a stacked group's pileup band taller/shorter by `dy` px. The
           * override caps the group's rows and pads the band where the rows
           * fall short, so the drag runs in both directions. The accumulation
           * policy lives in the pure `nextGroupHeightOverride`.
           */
          resizeGroupHeight(key: string, dy: number) {
            const section = self.renderSections.find(s => s.groupKey === key)
            if (!section) {
              return
            }
            self.groupMaxHeightOverrides.set(
              key,
              nextGroupHeightOverride({
                dy,
                rowHeight: self.rowHeight,
                displayedPx: section.pileupHeight,
                existingPx: self.groupMaxHeightOverrides.get(key),
              }),
            )
          },

          /**
           * #action
           * Set the per-read pixel size. Grow keeps growing at the new size.
           * Fit derives the size, so a chosen size would be dormant: picking
           * one drops back to fixed.
           */
          setFeatureHeight(height?: number) {
            if (self.fitHeightToDisplay) {
              self.setHeightMode('fixed')
            }
            setConf(self, 'featureHeight', height)
            self.scrollTop = 0
          },

          /**
           * #action
           */
          setMaxHeight(height?: number) {
            setConf(self, 'maxHeight', height)
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
              self.groupMaxHeightOverrides.clear()
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
           * Writes this slot alone. The arcs draw only with the coverage band
           * (`showSashimiArcs`), and the menu greys the row out without it
           * rather than turning the band back on behind the user's back.
           */
          setShowSashimiArcs(show: boolean) {
            setConf(self, 'showSashimiArcs', show)
          },

          /**
           * #action
           */
          setShowCoverage(show: boolean) {
            setConf(self, 'showCoverage', show)
          },

          /**
           * #action
           */
          setReadConnections(mode?: ReadConnectionsMode) {
            setConf(self, 'readConnections', mode)
          },

          /**
           * #action
           * Orientation of the below-coverage band, shared by read-connection
           * arcs and sashimi arcs.
           */
          setReadConnectionsDown(down: boolean) {
            setConf(self, 'readConnectionsDown', down)
          },

          /**
           * #action
           */
          setShowPileup(show: boolean) {
            setConf(self, 'showPileup', show)
          },

          /**
           * #action
           */
          setCoverageHeight(height: number) {
            setConf(
              self,
              'coverageHeight',
              clampBandHeight(
                self.coverageHeight,
                height,
                self.resizableBandBounds,
              ),
            )
          },

          /**
           * #action
           */
          setCoverageSnpMinFrequency(fraction: number) {
            setConf(self, 'coverageSnpMinFrequency', fraction)
          },

          /**
           * #action
           */
          setReadConnectionsHeight(height: number) {
            setConf(
              self,
              'readConnectionsHeight',
              clampBandHeight(
                self.readConnectionsHeight,
                height,
                self.resizableBandBounds,
              ),
            )
          },

          /**
           * #action
           */
          setSashimiArcsHeight(height: number) {
            setConf(
              self,
              'sashimiArcsHeight',
              clampBandHeight(
                self.sashimiArcsHeight,
                height,
                self.resizableBandBounds,
              ),
            )
          },

          /**
           * #action
           */
          setMinSashimiScore(score: number) {
            setConf(self, 'minSashimiScore', score)
          },

          /**
           * #action
           */
          setSashimiArcsMode(mode: SashimiArcsMode) {
            setConf(self, 'sashimiArcsMode', mode)
          },

          /**
           * #action
           */
          setShowSashimiLabels(show: boolean) {
            setConf(self, 'showSashimiLabels', show)
          },

          /**
           * #action
           */
          setShowNonCanonicalJunctions(show: boolean) {
            setConf(self, 'showNonCanonicalJunctions', show)
          },

          /**
           * #action
           */
          setReadConnectionsLineWidth(width: number) {
            setConf(self, 'readConnectionsLineWidth', width)
          },

          /**
           * #action
           */
          setShowInterchrom(draw: boolean) {
            setConf(self, 'showInterchrom', draw)
          },

          /**
           * #action
           */
          setShowProperPairArcs(draw: boolean) {
            setConf(self, 'showProperPairArcs', draw)
          },

          /**
           * #action
           */
          setMinInterchromSupport(support: number) {
            setConf(self, 'minInterchromSupport', support)
          },

          /**
           * #action
           */
          setShowLongRange(draw: boolean) {
            setConf(self, 'showLongRange', draw)
          },

          /**
           * #action
           */
          setArcColorField(field: ArcColorField | '') {
            setConf(self, ['arcColor', 'field'], field)
          },

          /**
           * #action
           */
          setShowMismatches(show: boolean) {
            setConf(self, 'showMismatches', show)
          },

          /**
           * #action
           */
          setShowInterbaseIndicators(show: boolean) {
            setConf(self, 'showInterbaseIndicators', show)
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
            // pairs. Under a per-base layer the plain fill is the backdrop its
            // marks read against, so neither direction swaps.
            const [from, to] =
              unit === 'read'
                ? (['insertSizeAndOrientation', 'normal'] as const)
                : (['normal', 'insertSizeAndOrientation'] as const)
            if (self.colorBy.type === from && !self.baseLayer) {
              setConf(
                self,
                'color',
                colorSnapshotFor({ type: to }, self.writtenColor),
              )
            }
            // No refetch: chain identity is joined on the main thread
            // (`chainAttachment`). A facet in effect refetches, since it
            // changes the unit the worker keeps whole (`workerFacet`).
          },

          /**
           * #action
           * Toggle the paired-read connection overlay. A main-thread tier-2/4
           * setting, not in `rpcProps`: toggling never refetches.
           */
          setShowBezierConnections(flag: boolean) {
            setConf(self, 'showBezierConnections', flag)
          },

          /**
           * #action
           * The whole hover state in one action, so no branch of the mousemove
           * handler leaves a field stale. Refused while the right-click menu is
           * open, since `openContextMenu` pins the hover to the read the menu
           * acts on. `highlightedChainReadIds` is a chain's reads in chain
           * mode, and outside it the two ends of a hovered connector.
           */
          setHoverState(state: {
            overCigarItem: boolean
            featureIdUnderMouse: string | undefined
            mouseoverExtraInformation: TooltipPayload | undefined
            hoverCoverageBand?: HoverCoverageBand
            // Optional and ALWAYS assigned, like `hoverCoverageBand`: a branch
            // with no arc clears the highlight by not mentioning one.
            hoveredArcHighlight?: ArcHighlight
            hoveredJunction?: LaneJunction
            highlightedChainReadIds: string[]
          }) {
            if (self.contextMenuInfo) {
              return
            }
            self.overCigarItem = state.overCigarItem
            self.featureIdUnderMouse = state.featureIdUnderMouse
            self.mouseoverExtraInformation = state.mouseoverExtraInformation
            self.hoverCoverageBand = state.hoverCoverageBand
            self.hoveredArcHighlight = state.hoveredArcHighlight
            self.hoveredJunction = state.hoveredJunction
            // Write only on a real change: assigning an equal array replaces
            // the MST node and invalidates `hoverInk`, an O(reads) rebuild per
            // mousemove along a chain.
            if (
              !sameStrings(
                self.highlightedChainReadIds,
                state.highlightedChainReadIds,
              )
            ) {
              self.highlightedChainReadIds = state.highlightedChainReadIds
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
                sections: self.sourceSections,
                densityRegions: self.densityCoverageRegions,
              }),
            // `hasRegionData` is the per-REGION store, not a group's laid-out
            // map: a grouped fetch over a region with no reads partitions to
            // zero groups, and gating on the map would leave the loading
            // overlay up forever. With the band standing in, first paint waits
            // on the band's own read.
            render: b =>
              (
                self.coarseTierStandsIn
                  ? coarseTierPending(self)
                  : !self.hasRegionData
              )
                ? false
                : b.renderBlocks(self.renderBlocks, self.renderState),
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
           * when the hit carries one, fills it by async RPC, so a repositioned
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
          return [
            getColorByMenuItem(self, {
              includeTagOption: true,
              includePairedEnd: true,
              includeModifications: true,
              arcColor:
                self.readConnections === 'off'
                  ? undefined
                  : {
                      own: getConf(self, ['arcColor', 'field']),
                      setField: (field: ArcColorField | '') => {
                        self.setArcColorField(field)
                      },
                    },
            }),
            ...editPlotMenuItems(self),
            getSortByMenuItem(self, {
              disabledHelpText: self.sortReadsBlockedReason,
            }),
            ...getFiltersMenuItems(self, { readCategories: true }),
            getGroupByMenuItem(self),
            ...getSectionOrderMenuItems(self),
            ...getReadsMenuItems(self),
            getFeatureHeightMenuItem(self, self.featureNoun, {
              disabled: !self.showPileup,
              disabledHelpText: 'Turn on "Show pileup" to change read height',
            }),
            ...getCoverageMenuItems(self),
            ...densityTierMenuItems(self, {
              disabled: !self.showCoverage,
              disabledHelpText:
                'The density band draws in the coverage band — turn on "Show coverage" first',
            }),
            getReadConnectionsMenuItem(self),
            getSashimiMenuItem(self),
          ] satisfies MenuItem[]
        },

        /**
         * #method
         */
        contextMenuItems() {
          // Same gate as the track menu's "Sort by...": these write the same
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
