import { lazy } from 'react'

import {
  YSCALEBAR_LABEL_OFFSET,
  computeCoverageTicks,
  computeVisibleCoverageStats,
} from '@jbrowse/alignments-core'
import { getSequenceAdapterConfig } from '@jbrowse/core/assemblyManager/assembly'
import {
  ConfigurationReference,
  getConf,
  makeCurrentValueDisplayTypeDefaultControl,
  makeDisplayTypeDefaultControl,
  makeSlotsValueDisplayTypeDefaultControl,
} from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import {
  SimpleFeature,
  getContainingTrack,
  getContainingView,
  getRpcSessionId,
  getSession,
  isFeature,
  measureText,
  openFeatureWidget,
} from '@jbrowse/core/util'
import { addDisposer, isAlive, types } from '@jbrowse/mobx-state-tree'
import {
  GROW_MAX_HEIGHT,
  HeightModeMixin,
  MultiRegionDisplayMixin,
  PromotableDefaultsMixin,
  TrackHeightMixin,
  installGrowExitBake,
  onDisplayedRegionsChange,
} from '@jbrowse/plugin-linear-genome-view'
import { domainFromStats, getNiceDomain } from '@jbrowse/wiggle-core'
import { autorun, observable, reaction } from 'mobx'

import {
  arcColorLegendCategory,
  computeArcsRegionMap,
} from '../features/arcs/compute.ts'
import {
  bezierConnectionLegendItems,
  enumerateBezierPairs,
  isBezierArcPair,
} from '../features/linkedReads/computeOverlay.ts'
import { computeSashimiArcs } from '../features/sashimi/computeOverlay.ts'
import {
  COLOR_SCHEMES,
  isModificationScheme,
  normalizeColorBy,
} from '../shared/colorSchemes.ts'
import { getReadDisplayLegendItems } from '../shared/legendUtils.ts'
import {
  DEFAULT_MODIFICATION_THRESHOLD,
  normalizeFilterBy,
} from '../shared/types.ts'
import { getColorForModification } from '../util.ts'
import { updateColorTagMap as updateColorTagMapPure } from './colorTagUtils.ts'
import { readColorCategory } from './colorUtils.ts'
import {
  buildColorPaletteFromTheme,
  makeBpToScreenX,
} from './components/alignmentComponentUtils.ts'
import { computeHighlightBoxes } from './components/computeHighlightBoxes.ts'
import { computeVisibleLabels } from './components/computeVisibleLabels.ts'
import { ColorScheme } from './constants.ts'
import {
  anyRegionTruncated,
  groupMaxY,
  layoutGroupRowCounts,
  layoutGroupsToViewport,
  maxRowsFor,
  nextGroupHeightOverride,
} from './groupLayout.ts'
import {
  anyGroupHasSashimiDownArcs,
  buildChainIdMap,
  buildRawDataByGroup,
  buildReadIdIndexMap,
  eachGroupData,
  orderedGroups,
} from './groupedDataMaps.ts'
import { computeInsertSizeTicks } from './insertSizeTicks.ts'
import {
  NORMAL_PITCH,
  featureSpacingForHeight,
  getColorByMenuItem,
  getContextMenuItems,
  getCoverageMenuItem,
  getFeatureHeightMenuItem,
  getFiltersMenuItem,
  getGroupByMenuItem,
  getReadConnectionsMenuItem,
  getReadsMenuItem,
  getSashimiMenuItem,
  getSortByMenuItem,
} from './menus/index.ts'
import { migrateAlignmentsSnapshot } from './migrateAlignmentsSnapshot.ts'
import { computeArcBand } from './renderers/rendererTypes.ts'
import {
  belowCoverageBandsGeometry,
  buildSectionRenders,
  computeStackedSections,
} from './sectionLayout.ts'

import type {
  GroupedAlignmentsResult,
  PileupDataResult,
} from '../RenderAlignmentDataRPC/types'
import type { ArcsUploadData } from '../features/arcs/types.ts'
import type { IndicatorHitResult } from '../features/indicator/types.ts'
import type { ModificationHitResult } from '../features/modification/hitTest.ts'
import type { CigarHitResult, ResolvedBlock } from '../shared/hitTestTypes.ts'
import type {
  ArcColorByType,
  ColorBy,
  ColorSchemeType,
  FilterBy,
  GroupBy,
  SortedBy,
} from '../shared/types'
import type { ReadColorCategory } from './colorUtils.ts'
import type { ScrollModel } from './components/sectionScreen.ts'
import type { TooltipPayload } from './components/tooltipUtils.ts'
import type { LinearAlignmentsDisplayConfigSchema } from './configSchema'
import type {
  LinkedReadsMode,
  ReadConnectionsMode,
  SashimiArcsMode,
} from './constants.ts'
import type { ColorPalette } from './renderers/AlignmentsRenderer.ts'
import type { AlignmentsRenderingBackend } from './renderers/rendererTypes.ts'
import type { SectionsLayout } from './sectionLayout.ts'
import type { MenuItem } from '@jbrowse/core/ui'
import type { AbstractSessionModel, Feature, Region } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type {
  ExportSvgDisplayOptions,
  FetchContext,
  HeightMode,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

export type { ArcColorByType } from '../shared/types'

export {
  getInsertionType,
  insertionBarWidth as getInsertionRectWidthPx,
  textWidthForNumber,
} from './constants.ts'
export type { InsertionType } from './constants.ts'

export type { Region } from '@jbrowse/core/util'

function getSequenceAdapter(session: AbstractSessionModel, region: Region) {
  return getSequenceAdapterConfig(
    region.assemblyName
      ? session.assemblyManager.get(region.assemblyName)
      : undefined,
  )
}

interface FetchFeatureDetailsSelf {
  adapterConfig: Record<string, unknown>
  loadedRegions: ReadonlyMap<number, Region>
  getFeatureInfoById: (
    id: string,
  ) => { refName: string; start: number; end: number } | undefined
}

async function fetchFeatureDetails(
  self: FetchFeatureDetailsSelf,
  featureId: string,
) {
  const session = getSession(self)
  const info = self.getFeatureInfoById(featureId)
  if (!info) {
    return undefined
  }
  const loaded = [...self.loadedRegions.values()].find(
    r => r.refName === info.refName,
  )
  if (!loaded) {
    throw new Error(`no loaded region found for refName ${info.refName}`)
  }
  const region = {
    refName: info.refName,
    start: info.start,
    end: info.end,
    assemblyName: loaded.assemblyName,
  }
  const sequenceAdapter = getSequenceAdapter(session, region)
  const sessionId = getRpcSessionId(self)
  const { feature } = await session.rpcManager.call(
    sessionId,
    'GetPileupFeatureDetails',
    {
      adapterConfig: self.adapterConfig,
      sequenceAdapter,
      regions: [region],
      featureId,
    },
  )
  if (!feature) {
    return undefined
  }
  return new SimpleFeature(feature)
}

const AlignmentsTooltip = lazy(
  () => import('./components/AlignmentsTooltip.tsx'),
)

export { ColorScheme } from './constants.ts'

// Floor for the user-resizable coverage / arc / sashimi bands, in px.
const MIN_BAND_HEIGHT = 20

// colorBy.type → shader colorScheme index, resolved through the shared
// COLOR_SCHEMES registry (each scheme names a shader path) and ColorScheme (the
// path → index map). Total over ColorSchemeType via the registry, so no
// fallback is needed at the call sites.
function colorSchemeIndexFor(type: ColorSchemeType) {
  return ColorScheme[COLOR_SCHEMES[type].shaderScheme]
}

// Color schemes that only carry meaning for paired-end data. Toggling "view as
// pairs" auto-switches between plain and pairing coloring for these, but leaves
// an explicit non-pairing choice (tag, methylation, base quality, ...) alone.
// Derived from the `pairedOnly` flag in the shared COLOR_SCHEMES registry.
const PAIRING_COLOR_SCHEMES = new Set<ColorSchemeType>(
  Object.values(COLOR_SCHEMES)
    .filter(s => s.pairedOnly)
    .map(s => s.type),
)

// Material UI 200-tone palette for color-by-tag values. The first value
// hit gets index 0, the eleventh wraps to index 0 again.

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
 *       colorBy: { type: 'modifications', modifications: { fillUnmarked: true } },
 *     },
 *   ],
 * }
 * ```
 *
 * Long reads with soft-clipping shown and split/mate reads connected by arcs:
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
 *       showSoftClipping: true,
 *       linkedReads: 'normal',
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
        PromotableDefaultsMixin(configSchema),
        // Track-menu settings are config slots (read via getConf, written via
        // configuration.setSlot) so an edit survives hide/retick and a config
        // default can be set declaratively. The plain MST fields below are the
        // remaining toggles. Each setting also has a refetch/relayout/render
        // blast radius documented in CLAUDE.md §"Settings: storage +
        // invalidation tiers".
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
      // Track-menu toggles resolved from config slots (thin getters keep every
      // read site as `self.x`; setters write via configuration.setSlot). Config
      // slots persist across hide/retick (#5591), unlike the old MST props.
      .views(self => ({
        /** #getter */
        // Resolved through the promotable-slot tiers: a track pins 'off'/'normal'
        // explicitly, else follows the session-wide default (view-as-pairs),
        // falling back to 'off'. getConf never returns the 'inherit'
        // sentinel. See promotableDefaults.ts.
        get linkedReads(): LinkedReadsMode {
          return getConf(self, 'linkedReads')
        },
        /** #getter */
        // "make view-as-pairs the default for all tracks" control (pin): active
        // when 'normal' is the session default for this display type
        get pairsDisplayTypeDefault() {
          return makeDisplayTypeDefaultControl(self, 'linkedReads', 'normal')
        },
        /** #getter */
        get showBezierConnections(): boolean {
          return getConf(self, 'showBezierConnections')
        },
        /** #getter */
        get showCoverage(): boolean {
          return getConf(self, 'showCoverage')
        },
        /** #getter */
        get showPileup(): boolean {
          return getConf(self, 'showPileup')
        },
        /** #getter */
        get coverageHeight(): number {
          return getConf(self, 'coverageHeight')
        },
        /** #getter */
        get showMismatches(): boolean {
          return getConf(self, 'showMismatches')
        },
        /** #getter */
        get showInterbaseIndicators(): boolean {
          return getConf(self, 'showInterbaseIndicators')
        },
        /** #getter */
        get drawSingletons(): boolean {
          return getConf(self, 'drawSingletons')
        },
        /** #getter */
        get drawProperPairs(): boolean {
          return getConf(self, 'drawProperPairs')
        },
        /** #getter */
        get showOnlySplitAlignments(): boolean {
          return getConf(self, 'showOnlySplitAlignments')
        },
        /** #getter */
        get flipStrandLongReadChains(): boolean {
          return getConf(self, 'flipStrandLongReadChains')
        },
        /** #getter */
        get colorSupplementaryChains(): boolean {
          return getConf(self, 'colorSupplementaryChains')
        },
        /** #getter */
        get drawInter(): boolean {
          return getConf(self, 'drawInter')
        },
        /** #getter */
        get drawLongRange(): boolean {
          return getConf(self, 'drawLongRange')
        },
        /** #getter */
        get arcColorByType(): ArcColorByType {
          return getConf(self, 'arcColorByType')
        },
        /** #getter */
        // Resolved through the promotable-slot tiers: a track pins
        // 'off'/'arc'/'cloud' explicitly, else follows the session-wide
        // default, falling back to 'off'. getConf never returns the
        // 'inherit' sentinel. See promotableDefaults.ts.
        get readConnections(): ReadConnectionsMode {
          return getConf(self, 'readConnections')
        },
        /** #getter */
        // "make arcs the default for all tracks" control (pin): active when
        // 'arc' is the session default. Independent of read cloud (both toggles
        // share the readConnections slot but target different on-values).
        get arcsDisplayTypeDefault() {
          return makeDisplayTypeDefaultControl(self, 'readConnections', 'arc')
        },
        /** #getter */
        // "make read cloud the default for all tracks" control (pin): active when
        // 'cloud' is the session default
        get readCloudDisplayTypeDefault() {
          return makeDisplayTypeDefaultControl(self, 'readConnections', 'cloud')
        },
        /** #getter */
        // Resolved through the promotable-slot tiers (getConf): a
        // maybeBoolean sentinel (like showSoftClipping) — an unset track follows
        // the session-wide default, else the promotedBase (true). getConf
        // never surfaces the `undefined` inherit sentinel.
        get readConnectionsDown(): boolean {
          return getConf(self, 'readConnectionsDown')
        },
        /** #getter */
        // "make this the default for all tracks" control (pin): promotes the
        // track's current resolved value, so either direction (below or above the
        // coverage band) can be made the session-wide default.
        get readConnectionsDownDisplayTypeDefault() {
          return makeCurrentValueDisplayTypeDefaultControl(self, [
            'readConnectionsDown',
          ])
        },
        /** #getter */
        get showSashimiArcs(): boolean {
          return getConf(self, 'showSashimiArcs')
        },
        /** #getter */
        // Sentinel promotable slot (like linkedReads/readConnections): a track
        // pins 'up' explicitly, else follows the session-wide default, falling
        // back to 'up'.
        get sashimiArcsMode(): SashimiArcsMode {
          return getConf(self, 'sashimiArcsMode')
        },
        /** #getter */
        // "make below-coverage placement the default for all tracks" control
        // (pin): active when 'down' is the session default. Independent of
        // auto-placement (both share the sashimiArcsMode slot but target
        // different on-values).
        get sashimiDownDisplayTypeDefault() {
          return makeDisplayTypeDefaultControl(self, 'sashimiArcsMode', 'down')
        },
        /** #getter */
        // "make auto-placement the default for all tracks" control (pin):
        // active when 'auto' is the session default
        get sashimiAutoDisplayTypeDefault() {
          return makeDisplayTypeDefaultControl(self, 'sashimiArcsMode', 'auto')
        },
        /** #getter */
        get minSashimiScore(): number {
          return getConf(self, 'minSashimiScore')
        },
        /** #getter */
        get sashimiArcsHeight(): number {
          return getConf(self, 'sashimiArcsHeight')
        },
        /** #getter */
        get readConnectionsHeight(): number {
          return getConf(self, 'readConnectionsHeight')
        },
        /** #getter */
        // Resolved through the promotable-slot tiers (getConf): an
        // explicit track value customizes soft clipping on or off; otherwise it
        // follows the session-wide default, falling back to off. A `maybeBoolean`
        // slot, so (unlike the old plain boolean) an explicit "off" can be customized
        // back over a session default of "on".
        get showSoftClipping(): boolean {
          return getConf(self, 'showSoftClipping')
        },

        /** #getter */
        // "make the current soft-clipping state the default for all tracks"
        // control (pin): symmetric, so it promotes whichever value the track
        // currently shows.
        get softClippingDisplayTypeDefault() {
          return makeCurrentValueDisplayTypeDefaultControl(self, [
            'showSoftClipping',
          ])
        },
      }))
      .volatile(() => {
        // typed local so the empty record isn't inferred as `{}` (a type assertion
        // here gets stripped by no-unnecessary-type-assertion)
        const colorTagMap: Record<string, string> = {}
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
           */
          contextMenuCoord: undefined as [number, number] | undefined,
          /**
           * #volatile
           */
          contextMenuCigarHit: undefined as CigarHitResult | undefined,
          /**
           * #volatile
           */
          contextMenuIndicatorHit: undefined as IndicatorHitResult | undefined,
          /**
           * #volatile
           * Per-read base modification under a right-click, so "Open modification
           * details" is reachable from the menu (not just left-click). Set with
           * the block/hits as a unit.
           */
          contextMenuModHit: undefined as ModificationHitResult | undefined,
          /**
           * #volatile
           * Genomic column under a right-click, anchoring the read menu's "sort
           * at the clicked position" items. Set with the block/hits as a unit.
           */
          contextMenuGenomicPos: undefined as number | undefined,
          /**
           * #volatile
           * The block under a right-click (refName + block-level worker result +
           * bp range). The position sort reads its refName and the
           * indicator/coverage detail items read its rpcData to open the
           * aggregate widget (mirrors the left-click path in useAlignmentsBase).
           */
          contextMenuBlock: undefined as ResolvedBlock | undefined,
          /**
           * #volatile
           */
          // Region index → grouped worker result. Ungrouped fetches store a
          // single group (key ''); grouping (Stage 5) stores N. Every reader
          // iterates `.groups`, so the ungrouped path is the one-group case.
          // Shallow (`deep: false`): entries are whole worker results (nested
          // plain objects wrapping large typed arrays) that are only ever
          // replaced via `.set`/`.delete`, never mutated in place. Deep
          // observability would recursively wrap every nested object/array on
          // insert and tax every property access (`getObservablePropValue_`) in
          // the layout/draw hot loops for zero benefit.
          rpcDataMap: observable.map<number, GroupedAlignmentsResult>(
            undefined,
            {
              deep: false,
            },
          ),
          /**
           * #volatile
           * pileup vertical scroll offset in px. Also read by the
           * BreakpointSplitView overlay to position its SVG curves.
           */
          scrollTop: 0,
          /**
           * #volatile
           * Group keys whose pileup is collapsed to just its coverage band
           * (in-track grouping). Keyed by group key so it survives re-fetches;
           * volatile so it resets on reload. Stale keys from a prior grouping
           * dimension are harmless — they never match the new keys.
           */
          collapsedGroups: observable.set<string>(),
          /**
           * #volatile
           * Per-group pileup height override in px (in-track grouping). Keyed by
           * group key, volatile like `collapsedGroups`; absent keys fall back to
           * the display-wide `maxHeight`. Lets a dense section be shrunk
           * independently. Cleared by `setGroupBy`.
           */
          groupMaxHeightOverrides: observable.map<string, number>(),
          /**
           * #volatile
           * Cache of the current fitted read height in px, kept in sync by the
           * afterAttach autorun while `fitHeightToDisplay` is on. A volatile (not a
           * getter) because the fit height derives from late layout getters that
           * the early `featureHeight` getter can't reference — the autorun bridges
           * that ordering. 0 until first computed / when nothing fits.
           */
          fittedHeightPx: 0,
          /**
           * #volatile
           */
          highlightedChainIds: [] as string[],
          /**
           * #volatile
           */
          selectedChainIds: [] as string[],

          /**
           * #volatile
           */

          colorTagMap,
          /**
           * #volatile
           */
          /**
           * Modification type code -> painted color, for every type seen in the
           * fetched reads. This is what the data CONTAINS; what is actually
           * drawn is filtered separately by isModificationTypeVisible, so don't
           * rename this back to "visible".
           */
          detectedModifications: observable.map<string, string>({}),
          /**
           * #volatile
           */
          modificationsReady: false,
          /**
           * #volatile
           */
          overCigarItem: false,
          /**
           * #volatile
           * Screen-px coverage band of the section currently under a
           * coverage/indicator hover. Drives the tooltip's vertical hover bar so
           * it lands on the hovered group's coverage band, not always the top
           * one. `undefined` when not hovering coverage.
           */
          hoverCoverageBand: undefined as
            | { topOffset: number; coverageHeight: number }
            | undefined,
        }
      })
      // Named getters for frequently-tested conditions so the inline boolean
      // expression doesn't have to be re-derived (and re-explained) at each
      // call site.
      .views(self => ({
        /**
         * #getter
         */
        get isChainMode() {
          return self.linkedReads === 'normal'
        },

        /**
         * #getter
         * Whether to draw the straight-line pass connecting normal read-pairs
         * in pileup layout. Only meaningful when bezier connections are on AND
         * we are in pileup mode — chain layout has its own connecting-line pass
         * that already covers normal pairs.
         */
        get showLinkedReadLines() {
          return self.showBezierConnections && self.linkedReads === 'off'
        },
      }))
      // Canonical ScoreScaleModel shape (shared with wiggle/manhattan) so the
      // coverage band reuses wiggle-core's score menu + SetMinMaxDialog with no
      // adapter shim. minScore/maxScore are raw (sentinels intact) for the
      // dialog; *Config strip the sentinels for domain bounds. Kept in its own
      // block so later getters reference them via `self`.
      .views(self => ({
        /**
         * #getter
         */
        get scaleType() {
          return getConf(self, 'scaleType')
        },
        /**
         * #getter
         */
        get autoscaleType() {
          return getConf(self, 'autoscale')
        },
        /**
         * #getter
         */
        get minScore() {
          return getConf(self, 'minScore')
        },
        /**
         * #getter
         */
        get maxScore() {
          return getConf(self, 'maxScore')
        },
        /**
         * #getter
         */
        get minScoreBound() {
          const v = getConf(self, 'minScore')
          return v !== Number.MIN_VALUE ? v : undefined
        },
        /**
         * #getter
         */
        get maxScoreBound() {
          const v = getConf(self, 'maxScore')
          return v !== Number.MAX_VALUE ? v : undefined
        },
        /**
         * #getter
         */
        get numStdDev() {
          return getConf(self, 'numStdDev')
        },
      }))
      .views(self => ({
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
         */
        get detectedModificationTypes() {
          return [...self.detectedModifications.keys()]
        },

        /**
         * #getter
         */
        // colorBy is a sentinel promotable slot: a track following the default (colorBy at
        // its `{type:'inherit'}` default) follows the session-wide color default
        // (e.g. "color every alignments track by methylation"), resolving to the
        // `promotedBase` `{type:'normal'}` when nothing is promoted; picking any
        // scheme — `normal` included — pins this track over that default.
        // getConf walks the cascade and never surfaces `inherit`.
        get colorBy(): ColorBy {
          return normalizeColorBy(getConf(self, 'colorBy'))
        },

        /**
         * #getter
         */
        get filterBy(): FilterBy {
          return normalizeFilterBy(getConf(self, 'filterBy'))
        },

        /**
         * #getter
         * True when fit-to-display mode is on AND a pitch has been computed
         * (`fittedHeightPx > 0`, i.e. there are rows and room to fit them). The
         * single gate both size getters read, so it's obvious they either both
         * split the fitted pitch or both fall back to config — never a mix.
         */
        get isFitting(): boolean {
          return self.fitHeightToDisplay && self.fittedHeightPx > 0
        },

        /**
         * #getter
         */
        // featureHeight is the one promotable "compactness" slot: it resolves
        // through getConf (track value, else session-wide default, else
        // schema base 7). featureSpacing is derived from it, never stored. In
        // fit-to-height mode featureHeight instead splits the autorun-cached fit
        // pitch (`fittedHeightPx` = pileupSpace/rows) into a read body plus the
        // derived spacing, so every read-height consumer sees the fitted values
        // without threading a separate getter. body + spacing === pitch by
        // construction (body is the pitch minus the spacing).
        get featureHeight(): number {
          return this.isFitting
            ? self.fittedHeightPx - this.featureSpacing
            : this.configuredFeatureHeight
        },

        /**
         * #getter
         */
        // Spacing is a pure function of the read height, not an independent
        // setting: a 1px gap once there's room for it (pitch/height > 3, leaving
        // a >2px body), else flush. This one rule drives both the fixed-mode
        // presets (7->1, 3->0, 1->0) and the fit-mode squeeze, so the two paths
        // can't disagree.
        get featureSpacing(): number {
          return featureSpacingForHeight(
            this.isFitting ? self.fittedHeightPx : this.configuredFeatureHeight,
          )
        },

        /**
         * #getter
         */
        // The per-row pitch: the read body plus its derived gap. The single
        // source for every "row N sits at N*pitch" computation (layout caps,
        // section stacking, hit-test row math). When fitting this equals
        // `fittedHeightPx` by construction (body = pitch - spacing); the getter
        // keeps callers from re-deriving it and conflating pitch with body.
        get rowHeight(): number {
          return this.featureHeight + this.featureSpacing
        },

        /**
         * #getter
         */
        // The configured fixed-mode read size, independent of the fit squeeze.
        // Consumers that EDIT the size (the "Set feature height" dialog) must
        // start from the configured value, not the fractional fit pitch that
        // `featureHeight` resolves to in fit mode — otherwise opening the dialog
        // while compressed would bake the squeezed height.
        get configuredFeatureHeight(): number {
          return getConf(self, 'featureHeight')
        },

        /**
         * #getter
         */
        get maxHeight() {
          return getConf(self, 'maxHeight')
        },

        /**
         * #getter
         * Whether to draw the supporting-read count on each sashimi arc.
         * Resolved through the promotable-slot tiers (getConf): an
         * explicit track value pins labels on or off; otherwise it follows the
         * session-wide default, falling back to off. A `maybeBoolean` slot, so
         * (like mismatchAlpha) a session default of "on" can be customized back
         * off on a single track.
         */
        get showSashimiLabels(): boolean {
          return getConf(self, 'showSashimiLabels')
        },
        /**
         * #getter
         * "make the current sashimi-label state the default for all tracks"
         * control (pin): symmetric, so it promotes whichever value the track
         * currently shows.
         */
        get showSashimiLabelsDisplayTypeDefault() {
          return makeCurrentValueDisplayTypeDefaultControl(self, [
            'showSashimiLabels',
          ])
        },

        /**
         * #getter
         */
        get chainIdMap() {
          return buildChainIdMap(self.rpcDataMap, self.linkedReads)
        },

        /**
         * #getter
         */
        get showLowFreqMismatches() {
          return !!getConf(self, 'showLowFreqMismatches')
        },

        /**
         * #getter
         */
        // The draw/hit-test sense of showLowFreqMismatches. Both the renderers
        // and the hit-test pipeline take the filter in this polarity, so the
        // negation lives here once rather than at each call site.
        get filterMismatchesByFrequency() {
          return !this.showLowFreqMismatches
        },

        /**
         * #getter
         */
        // Resolved through the promotable-slot tiers (getConf): an
        // explicit track value customizes the fade on or off; otherwise it follows the
        // session-wide default, falling back to off. A `maybeBoolean` slot, so
        // (unlike showSoftClipping) a session default of "on" can be customized back
        // off on a single track.
        get mismatchAlpha(): boolean {
          return getConf(self, 'mismatchAlpha')
        },

        /**
         * #getter
         */
        // "make the current fade-by-quality state the default for all tracks"
        // control (pin): symmetric, so it promotes whichever value the track
        // currently shows.
        get mismatchAlphaDisplayTypeDefault() {
          return makeCurrentValueDisplayTypeDefaultControl(self, [
            'mismatchAlpha',
          ])
        },

        /**
         * #getter
         */
        get showLegend() {
          // Opt-in: the floating color legend is hidden by default for every
          // color scheme (including modifications) and shown only on demand via
          // the "Show legend" track-menu item, rather than eagerly covering the
          // top of every alignments track.
          return !!getConf(self, 'showLegend')
        },

        /**
         * #getter
         */
        get sortedBy(): SortedBy | undefined {
          return getConf(self, 'sortedBy') ?? undefined
        },

        /**
         * #getter
         * Lay out the widest features in the lowest pileup rows (main-thread
         * tier-2 relayout via laidOutPileupMap). LGVSyntenyDisplay defaults it
         * on. Ignored while an explicit `sortedBy` position sort is active.
         */
        get largeFeaturesFirst(): boolean {
          return getConf(self, 'largeFeaturesFirst')
        },

        /**
         * #getter
         * In-track stacked grouping dimension (undefined = ungrouped). Falls
         * back to the `groupBy` config slot, so a track can be pre-grouped
         * declaratively. Sent to the worker via rpcProps; the worker partitions
         * one fetch into N sections.
         */
        get groupBy(): GroupBy | undefined {
          return getConf(self, 'groupBy') ?? undefined
        },

        /**
         * #getter
         * Offset the track label above the visualization when grouping, so the
         * stacked group sections aren't hidden behind an overlapping label.
         */
        get prefersOffset() {
          return this.groupBy !== undefined
        },

        /**
         * #method
         * Whether a stacked group's pileup is collapsed to just its coverage.
         */
        isGroupCollapsed(key: string) {
          return self.collapsedGroups.has(key)
        },

        /**
         * #method
         * Whether a stacked group carries a custom pileup-height override — set
         * by expanding it (show all reads) or dragging its resize handle (taller
         * or shorter). Drives the group label's restore-to-fit affordance.
         */
        hasGroupHeightOverride(key: string) {
          return self.groupMaxHeightOverrides.has(key)
        },

        /**
         * #getter
         */
        get coverageIsLog() {
          return self.scaleType === 'log'
        },

        /**
         * #getter
         */
        get coverageStats() {
          if (!self.showCoverage) {
            return undefined
          }
          const view = getContainingView(self) as LGV
          if (!view.initialized) {
            return undefined
          }
          // coarseDynamicBlocks (500ms debounced) instead of dynamicBlocks so
          // the per-bp depth scan doesn't recompute on every animation frame
          // during pan/zoom — same approach as wiggle's visibleScoreRange.
          //
          // The domain spans EVERY group (expand each block into one entry per
          // group's coverage): a shared scale is what makes stacked sections
          // visually comparable. Ungrouped is the one-group case.
          const covBlocks: {
            start: number
            end: number
            cov: PileupDataResult
          }[] = []
          for (const b of view.coarseDynamicBlocks) {
            const grouped =
              b.displayedRegionIndex === undefined
                ? undefined
                : self.rpcDataMap.get(b.displayedRegionIndex)
            if (grouped) {
              for (const { data } of grouped.groups) {
                covBlocks.push({ start: b.start, end: b.end, cov: data })
              }
            }
          }
          return computeVisibleCoverageStats(covBlocks, cb => cb.cov)
        },

        /**
         * #getter
         */
        get coverageDomain() {
          return this.coverageStats
            ? getNiceDomain({
                domain: domainFromStats(
                  this.coverageStats,
                  self.autoscaleType,
                  self.numStdDev,
                ),
                bounds: [self.minScoreBound, self.maxScoreBound],
                scaleType: self.scaleType,
              })
            : undefined
        },

        /**
         * #getter
         */
        get coverageTicks() {
          return this.coverageDomain
            ? computeCoverageTicks(
                this.coverageDomain[1],
                self.coverageHeight,
                self.scaleType,
              )
            : undefined
        },

        /**
         * #getter
         * Read-color buckets actually present across the rendered reads, the
         * single input that lets the legend list only relevant swatches (see
         * legendUtils). Shares readColorCategory with the renderer so the two
         * can't disagree. Empty while the legend is hidden so the O(reads) scan
         * is skipped; MobX memoizes it against rpcDataMap + scheme + mode.
         */
        get colorLegendCategories(): Set<ReadColorCategory> {
          const present = new Set<ReadColorCategory>()
          if (this.showLegend) {
            const colorScheme = colorSchemeIndexFor(this.colorBy.type)
            const opts = {
              linkedReads: self.linkedReads,
              flipStrandLongReadChains: self.flipStrandLongReadChains,
              colorSupplementaryChains: self.colorSupplementaryChains,
            }
            for (const data of eachGroupData(self.rpcDataMap)) {
              for (let i = 0; i < data.readFlags.length; i++) {
                present.add(readColorCategory(i, data, colorScheme, opts))
              }
            }
          }
          return present
        },

        /**
         * #getter
         */
        // Derived from the session theme so it's always available — including
        // headless SVG export and RPC, where no component mounts to seed it.
        get colorPalette(): ColorPalette {
          return buildColorPaletteFromTheme(getSession(self).theme)
        },

        /**
         * #getter
         * Legend categories contributed by the read-cloud endpoint
         * squares — the arc color slots actually plotted, mapped to legend
         * buckets. Read-fill categories miss the cloud-only buckets (split
         * junctions especially), so these are merged into the legend. Empty
         * unless in read-cloud mode with the legend shown.
         */
        get readCloudLegendCategories(): Set<ReadColorCategory> {
          const present = new Set<ReadColorCategory>()
          if (this.showLegend && self.readConnections === 'cloud') {
            for (const regionMap of this.arcsByGroup.values()) {
              for (const data of regionMap.values()) {
                for (const ct of data.arcColorTypes) {
                  present.add(arcColorLegendCategory(ct, self.arcColorByType))
                }
                for (const ct of data.arcLineColorTypes) {
                  present.add(arcColorLegendCategory(ct, self.arcColorByType))
                }
              }
            }
          }
          return present
        },

        /**
         * #method
         */
        legendItems() {
          return getReadDisplayLegendItems(
            this.colorBy,
            new Set([
              ...this.colorLegendCategories,
              ...this.readCloudLegendCategories,
            ]),
            this.colorPalette,
            self.detectedModifications,
            self.colorTagMap,
          )
        },

        /**
         * #getter
         * Inputs to `belowCoverageBandsGeometry` — the below-coverage band
         * settings plus whether any sashimi junction is present. Defined here
         * (an earlier .views block than `belowCoverageBands`) so the fit-budget
         * `laidOutByGroup` and the `belowCoverageBands` getter share one source.
         */
        get belowCoverageBandsInput() {
          return {
            showCoverage: self.showCoverage,
            coverageHeight: self.coverageHeight,
            readConnections: self.readConnections,
            readConnectionsDown: self.readConnectionsDown,
            readConnectionsHeight: self.readConnectionsHeight,
            showSashimiArcs: self.showSashimiArcs,
            sashimiArcsHeight: self.sashimiArcsHeight,
            hasSashimiDownArcs: anyGroupHasSashimiDownArcs(
              self.rpcDataMap,
              self.minSashimiScore,
              self.sashimiArcsMode,
            ),
          }
        },

        /**
         * #getter
         * Per-group laid-out data: group key → (region index → laid-out data).
         * Each group lays out independently (own `maxRows` cap) so a dense group
         * can't starve the rest. When grouped, the default cap fits all sections
         * into the viewport (`fitGroupMaxRows`) so the stack doesn't tower and
         * need scrolling; a per-group height drag / expand still overrides it.
         * Tag colors are baked here (not in the worker) so colorTagMap stays a
         * main-thread tier-2 setting — see readTagColors.
         */
        get laidOutByGroup() {
          return layoutGroupsToViewport(this.groupLayoutContext, {
            rowHeight: this.rowHeight,
            // Grow fits rows to the grow ceiling (content grows the track up to
            // it, then scrolls); fixed/fit fit to the drag-resizable slot. Reads
            // the slot (fitTargetHeight), never the reactive `height` getter, so
            // grow's `height`→grownHeight→layout chain can't cycle.
            height: self.autoHeight ? GROW_MAX_HEIGHT : self.fitTargetHeight,
            maxHeight: this.maxHeight,
            overhead: belowCoverageBandsGeometry(this.belowCoverageBandsInput)
              .bottom,
            collapsedKeys: self.collapsedGroups,
            heightOverridesPx: self.groupMaxHeightOverrides,
          })
        },

        /**
         * #getter
         * The layout mechanics (grouping, sort, soft-clip, colors) shared by the
         * viewport fit pass and any ad-hoc layout — e.g. `fittedFeatureHeight`,
         * which lays every group out uncapped to count rows. Kept apart from the
         * fit policy (row caps), which varies per call.
         */
        get groupLayoutContext() {
          return {
            order: this.groupOrder,
            rawByGroup: this.rawDataByGroup,
            isChainMode: self.isChainMode,
            sortedBy: this.sortedBy,
            showSoftClipping: self.showSoftClipping,
            largeFeaturesFirst: this.largeFeaturesFirst,
            regions: self.loadedRegions,
            showLinkedReadLines: self.showLinkedReadLines,
            colorBy: this.colorBy,
            colorTagMap: self.colorTagMap,
          }
        },

        /**
         * #getter
         * Group keys + labels in stacking order; a single entry (key '') when
         * ungrouped. Derived straight from the fetched `rpcDataMap` (not from the
         * layout pass), so group identity/order stays stable across relayouts.
         */
        get groupOrder() {
          return orderedGroups(self.rpcDataMap)
        },

        /**
         * #method
         * Laid-out region map for one group key, or an empty map for a key with
         * no data. Centralizes the empty-map fallback shared by the section
         * getters so they never have to branch on a missing group.
         */
        groupLaidOutMap(key: string) {
          return (
            this.laidOutByGroup.get(key) ?? new Map<number, PileupDataResult>()
          )
        },

        /**
         * #getter
         * Renderer-facing per-region layout. Stage 2 draws a single section, so
         * this exposes the first (for ungrouped, the only) group; Stage 3
         * switches the renderers to loop `sections` directly.
         */
        get laidOutPileupMap() {
          return this.groupLaidOutMap(this.groupOrder[0]?.key ?? '')
        },

        /**
         * #getter
         * Per-section renderer input, in stacking order. One entry per group
         * (the single key '' when ungrouped). Pairs each group's laid-out
         * region map with its key so the renderers can namespace HAL region
         * keys per section. Parallel to `renderState.sections`.
         */
        get sourceSections() {
          const arcsByGroup = this.arcsByGroup
          return this.groupOrder.map(({ key }) => ({
            groupKey: key,
            laidOutPileupMap: this.groupLaidOutMap(key),
            arcsRpcDataMap:
              arcsByGroup.get(key) ?? new Map<number, ArcsUploadData>(),
          }))
        },

        /**
         * #getter
         * Row count of the primary group across its regions. This reads only the
         * first group (`laidOutPileupMap`), so it is meaningful only on the
         * single-section/ungrouped path (`searchFeatureByID` and the no-data
         * synthetic section in `sections`). Grouped layout sizes each section
         * from its own `groupMaxY`; don't use this as a cross-group aggregate.
         */
        get maxY() {
          return groupMaxY(this.laidOutPileupMap)
        },

        /**
         * #method
         * True when the row cap clipped reads from a group's pileup and the user
         * hasn't explicitly sized that group (a height drag/expand makes any
         * truncation intentional, so it isn't flagged). Drives the per-group
         * "show all" affordance on the section label.
         */
        isGroupTruncated(key: string) {
          return (
            !self.groupMaxHeightOverrides.has(key) &&
            anyRegionTruncated(this.groupLaidOutMap(key))
          )
        },

        /**
         * #getter
         * True when the ungrouped pileup hit `maxHeight` and overflow reads were
         * collapsed — drives the "max height reached" / "show all" banner. Only
         * the ungrouped (single-group) case: grouped sections surface their own
         * truncation per-label (`isGroupTruncated`), where raising `maxHeight`
         * wouldn't lift the fit-to-viewport cap anyway — expanding the group does.
         * Suppressed in fit-to-display mode for the same reason: reads there are
         * already clamped to a 1px floor, so "Show all" can't deliver a fit — it
         * only deepens the 1px scroll. The overflow indicator still flags the
         * scroll in that case.
         */
        get pileupTruncated() {
          return (
            !self.fitHeightToDisplay &&
            this.groupOrder.length <= 1 &&
            this.isGroupTruncated(this.groupOrder[0]?.key ?? '')
          )
        },

        /**
         * #getter
         * Raw (un-laid-out) data regrouped as group key → (region idx → data),
         * insertion-ordered so the first key is the primary group. The arc
         * compute and the per-section sashimi overlay both read one group's raw
         * map from here; ungrouped is the single key `''`.
         */
        get rawDataByGroup() {
          return buildRawDataByGroup(self.rpcDataMap)
        },

        /**
         * #getter
         * Per-group arc upload feed: group key → (region idx → `ArcsUploadData`).
         * The heavy `computeArcsFromPileupData` pass runs once per group (arcs are
         * pre-grouped by refName so each region lookup is O(1)); ungrouped is the
         * single-group case. Empty map when read-connections are off, so the
         * off-path skips the per-read region scan entirely. Source of truth for
         * the per-section arc feed (`sourceSections`) and the shared cross-group
         * `arcsYDomainBp`.
         */
        get arcsByGroup() {
          const out = new Map<string, Map<number, ArcsUploadData>>()
          if (self.readConnections === 'off' || self.rpcDataMap.size === 0) {
            return out
          }
          const regionInfos = [...self.loadedRegions.entries()]
            .filter(([idx]) => self.rpcDataMap.has(idx))
            .map(([displayedRegionIndex, r]) => ({
              refName: r.refName,
              start: r.start,
              end: r.end,
              displayedRegionIndex,
            }))
          // SA-tag / RNEXT refNames use the BAM's own naming (e.g. `chr1`);
          // fetched reads carry the assembly-canonical name (e.g. `1`). Pass the
          // assembly's normalizer so a same-chr split junction to an SA segment
          // isn't misclassified inter-chromosomal.
          const assembly = getSession(self).assemblyManager.get(
            self.loadedRegions.values().next().value?.assemblyName ?? '',
          )
          const settings = {
            colorByType: self.arcColorByType,
            cloud: self.readConnections === 'cloud',
            drawInter: self.drawInter,
            drawLongRange: self.drawLongRange,
            // gate on `initialized` (== refNameAliases loaded): getCanonicalRefName
            // throws otherwise. In practice rpcDataMap only has data once the
            // assembly is loaded; when absent the arc compute falls back to
            // identity (no aliasing).
            canonicalRefName: assembly?.initialized
              ? (refName: string) => assembly.getCanonicalRefName2(refName)
              : undefined,
          }
          for (const [key, rawMap] of this.rawDataByGroup) {
            out.set(key, computeArcsRegionMap(rawMap, regionInfos, settings))
          }
          return out
        },
      }))
      .views(self => ({
        /**
         * #getter
         */
        get modificationThreshold() {
          return (
            self.colorBy.modifications?.threshold ??
            DEFAULT_MODIFICATION_THRESHOLD
          )
        },

        /**
         * #getter
         */
        get colorSchemeIndex() {
          return colorSchemeIndexFor(self.colorBy.type)
        },

        /**
         * #getter
         */
        get showModifications() {
          return isModificationScheme(self.colorBy.type)
        },

        /**
         * #getter
         */
        get showPerBaseQuality() {
          return self.colorBy.type === 'perBaseQuality'
        },

        /**
         * #getter
         */
        get showPerBaseLetter() {
          return self.colorBy.type === 'perBaseLetter'
        },

        /**
         * #getter
         */
        get readIdIndexMap() {
          return buildReadIdIndexMap(self.rpcDataMap)
        },

        /**
         * #getter
         * Whether `searchFeatureByID` has a pileup to search. Same name and
         * meaning as the canvas display's; see MultiRegionDisplayMixin.
         */
        get layoutReady() {
          // the too-large term isn't redundant: clearAllRpcData deliberately
          // leaves the gate alone, so a zoom-out into the banner can strand the
          // previous region's data in rpcDataMap with no pileup on screen
          return !self.regionTooLarge && self.rpcDataMap.size > 0
        },
      }))
      .views(self => ({
        /**
         * #getter
         */
        get readConnectionsLineWidth() {
          return getConf(self, 'readConnectionsLineWidth')
        },

        /**
         * #method
         */
        findFeatureInRpcData(featureId: string) {
          const entry = self.readIdIndexMap.get(featureId)
          if (!entry) {
            return undefined
          }
          const { displayedRegionIndex, groupKey, idx } = entry
          const rpcData = self.laidOutByGroup
            .get(groupKey)
            ?.get(displayedRegionIndex)
          if (!rpcData) {
            return undefined
          }
          const start = rpcData.readPositions[idx * 2]
          const end = rpcData.readPositions[idx * 2 + 1]
          if (start !== undefined && end !== undefined) {
            return {
              displayedRegionIndex,
              idx,
              rpcData,
              start,
              end,
            }
          }
          return undefined
        },
      }))
      .views(self => ({
        /**
         * #getter
         * Geometry of the bands stacked below coverage in arcs-down mode, top to
         * bottom: coverage → paired-end arcs → sashimi. Single source of truth so
         * the layout height, the renderers, and the three resize handles can't
         * drift apart. `arcsBandTop`/`sashimiBandTop` are each band's top edge;
         * `bottom` is where the pileup begins (== coverageDisplayHeight).
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
         * Single source of all vertical band geometry, one entry per stacked
         * group. `computeStackedSections` reproduces the prior ungrouped reserved
         * layout exactly for its single-section (N==1) case, so ungrouped is not a
         * special branch here — it is the one-group call, with a synthetic group
         * when no data has arrived yet (so `laidOutPileupMap`/`renderState` still
         * see one section). The sticky-coverage-vs-scroll distinction lives
         * downstream in `buildSectionRenders`, keyed off section count.
         */
        get sections(): SectionsLayout {
          const order = self.groupOrder
          // showPileup off collapses every pileup band to zero height (coverage
          // + arcs only), the same height-0 path collapsed groups use.
          const groupMaxYFor = (key: string) =>
            !self.showPileup || self.isGroupCollapsed(key)
              ? 0
              : groupMaxY(self.groupLaidOutMap(key))
          const groups =
            order.length === 0
              ? [{ key: '', label: '', maxY: self.showPileup ? self.maxY : 0 }]
              : order.map(({ key, label }) => ({
                  key,
                  label,
                  maxY: groupMaxYFor(key),
                }))
          return computeStackedSections(groups, {
            coverageHeight: self.coverageHeight,
            rowHeight: self.rowHeight,
            showCoverage: self.showCoverage,
            coverageYOffset: YSCALEBAR_LABEL_OFFSET,
            readConnections: self.readConnections,
            readConnectionsDown: self.readConnectionsDown,
            readConnectionsHeight: self.readConnectionsHeight,
            hasSashimiBand: self.belowCoverageBands.hasSashimiBand,
            sashimiHeight: self.sashimiArcsHeight,
          })
        },

        /**
         * #getter
         * Per-section data + content-space band tops for the overlay/hit-test
         * pipeline (labels, highlights, hit-test). Pairs each section's group
         * data map with its `pileupTop` (used as the row `topOffset`) and
         * coverage band so a screen-y can be mapped to the right section and its
         * group. Reads straight off `sections` (every field already lives on the
         * `Section`); ungrouped is the single section, so the pipeline reduces to
         * pre-grouping.
         */
        get renderSections() {
          return this.sections.sections.map(sec => ({
            groupKey: sec.groupKey,
            label: sec.label,
            laidOutPileupMap: self.groupLaidOutMap(sec.groupKey),
            topOffset: sec.pileupTop,
            coverageTop: sec.coverageTop,
            coverageHeight: sec.coverageHeight,
            // Bottom of this section's arc band (== top of its sashimi band), so
            // the arc-resize handle can anchor per group like coverage/pileup.
            sashimiBandTop: sec.sashimiBandTop,
            pileupHeight: sec.pileupHeight,
          }))
        },

        /**
         * #getter
         * Scroll/pan-invariant half of the bezier connection overlay: the linked
         * pairs of each section, resolved once per relayout. The read grouping +
         * connection resolution (`enumerateBezierPairs`) is the allocation-heavy
         * step; memoizing it here (this getter never reads `scrollTop`) keeps a
         * scroll frame down to the cheap per-pair screen projection in
         * `computePileupBezierArcsFromModel`. Empty when the overlay is off.
         */
        get bezierPairSections() {
          return self.showBezierConnections
            ? this.renderSections.map(sec => ({
                topOffset: sec.topOffset,
                pileupHeight: sec.pileupHeight,
                pairs: enumerateBezierPairs(sec.laidOutPileupMap),
              }))
            : []
        },

        /**
         * #getter
         * Connection types (LINKED_READ_COLOR_*) actually drawn as bezier/line
         * arcs in view, the input that lets the legend list only the connection
         * colors present. Mirrors the overlay's skip rule (normal within-region
         * pairs are drawn by the GPU pipeline, not as arcs) so the key matches the
         * curves. Empty while the legend is hidden so the scan is skipped.
         */
        get bezierConnectionColorTypes(): Set<number> {
          const present = new Set<number>()
          if (self.showLegend) {
            for (const sec of this.bezierPairSections) {
              for (const pair of sec.pairs) {
                if (isBezierArcPair(pair)) {
                  present.add(pair.c.colorType)
                }
              }
            }
          }
          return present
        },

        /**
         * #method
         * Legend swatches for the linked-read connection curves, empty unless the
         * bezier overlay is on and at least one connection is in view.
         */
        bezierLegendItems() {
          return bezierConnectionLegendItems(this.bezierConnectionColorTypes)
        },

        /**
         * #getter
         * Per-section sashimi arcs, in stacking order: each group's junction
         * geometry (sashimi counts live per-group) already split into the two
         * sub-bands, paired with their content-space tops — `coverageOverlayTop`
         * for `up` arcs drawn over the coverage histogram, `sashimiBandTop` for
         * `down` arcs in the reserved strip below it. In 'auto' both are
         * populated; 'up'/'down' leave the other empty. The overlay and SVG
         * export both map over this, so it is the single source for sashimi
         * geometry and neither path can drift; ungrouped is the single-section
         * case (sticky band below sticky coverage). Empty when sashimi is off.
         *
         * A computed on purpose (tier 3 — mirrors `bezierPairSections`): the arc
         * math depends on the view's pan/zoom but NOT on scrollTop, so MobX
         * replays the cache while the user scrolls a grouped track. Computing it
         * in the overlay's render instead re-ran the O(n^2) 'auto' side
         * assignment for every section on every scroll frame.
         */
        get sashimiArcSections() {
          const view = getContainingView(self) as LGV
          if (
            !self.showSashimiArcs ||
            !self.showCoverage ||
            !view.initialized
          ) {
            return []
          }
          const byGroup = self.rawDataByGroup
          const empty = new Map<number, PileupDataResult>()
          const bpToScreenX = makeBpToScreenX(view)
          return this.sections.sections.map(sec => {
            const arcs = computeSashimiArcs({
              rpcDataMap: byGroup.get(sec.groupKey) ?? empty,
              visibleRegions: view.visibleRegions,
              bpToScreenX,
              coverageHeight: self.coverageHeight,
              sashimiArcsHeight: self.sashimiArcsHeight,
              mode: self.sashimiArcsMode,
              minSashimiScore: self.minSashimiScore,
            })
            // Ascending score so high-count arcs paint over low-count ones — and,
            // since overlapping hit targets resolve to the last-painted path, so
            // the heavier junction also wins the hover.
            arcs.sort((a, b) => a.score - b.score)
            return {
              groupKey: sec.groupKey,
              up: arcs.filter(a => a.side === 'up'),
              down: arcs.filter(a => a.side === 'down'),
              // Content-space band tops; the overlay scrolls them for grouped,
              // the export reads them as-is (scrollTop 0).
              coverageOverlayTop: sec.coverageTop + YSCALEBAR_LABEL_OFFSET,
              sashimiBandTop: sec.sashimiBandTop,
            }
          })
        },

        /**
         * #getter
         * True when reads are stacked into >1 group section. Drives the scroll
         * model: ungrouped keeps coverage sticky (only the pileup scrolls);
         * grouped scrolls the whole coverage+pileup stack as one.
         */
        get isGrouped() {
          return self.groupOrder.length > 1
        },

        /**
         * #getter
         * The scroll-projection inputs (`sectionScreen.ts`) every overlay needs
         * to map a content-space Y into screen space. Built once here so the
         * label / resize-handle / coverage-axis overlays don't each re-assemble
         * `{ isGrouped, scrollTop, canvasHeight }` inline.
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
         * Height of the scrollable viewport. Ungrouped excludes the sticky
         * coverage band; grouped scrolls the entire display.
         */
        get pileupViewportHeight() {
          return this.isGrouped
            ? self.height
            : Math.max(0, self.height - self.coverageDisplayHeight)
        },

        /**
         * #getter
         * Total scrollable content height. Grouped is the full stacked-sections
         * height; ungrouped is the pileup band alone (coverage is sticky), which
         * is the stacked height minus that sticky coverage band. Both read the
         * laid-out `sections` so the scroll extent tracks the geometry actually
         * drawn — when `showPileup` is off or the group is collapsed the section
         * reserves no pileup rows, so this collapses to 0 and no phantom scroll
         * region opens up below the coverage band.
         */
        get pileupContentHeight() {
          return this.isGrouped
            ? this.sections.contentHeight
            : Math.max(
                0,
                this.sections.contentHeight - self.coverageDisplayHeight,
              )
        },

        /**
         * #getter
         * Target track height for `grow` mode: the full laid-out content height
         * (coverage + pileup + arcs), capped at `GROW_MAX_HEIGHT` so a deep
         * pileup doesn't grow the track to thousands of px (a taller pileup fits
         * to the cap and scrolls the remainder). Independent of `self.height` (in
         * grow mode reads use the configured `featureHeight`, not the fitted
         * pitch), so the grow autorun that writes it back can't feed back on
         * itself. `setHeight` floors it to MIN_DISPLAY_HEIGHT.
         */
        get grownHeight() {
          return Math.min(this.sections.contentHeight, GROW_MAX_HEIGHT)
        },

        /**
         * #getter
         */
        // In grow mode the track height follows the laid-out content
        // (`grownHeight`) reactively — no autorun writes the height config slot,
        // so a settled relayout never churns the persisted session nor bakes a
        // momentary height. Fixed/fit read the slot (fit shrinks features to fill
        // it via the fittedHeightPx autorun). `grownHeight` is height-independent
        // in grow mode because `laidOutByGroup` fits to GROW_MAX_HEIGHT there (not
        // the reactive `height`) and featureHeight is the configured value (not the
        // fitted pitch), so returning it here can't cycle. Guarded on
        // `view.initialized`: grownHeight transitively reads view-geometry getters
        // that throw before the view is measured, and unlike the former autorun
        // (whose MobX error-boundary swallowed the pre-init throw) a getter would
        // propagate it into render/hydration. Overrides TrackHeightMixin.height
        // (mirrors canvas).
        get height(): number {
          const view = getContainingView(self) as LGV
          return self.autoHeight && view.initialized
            ? this.grownHeight
            : self.fitTargetHeight
        },

        /**
         * #getter
         */
        get scalebarOverlapLeft() {
          const view = getContainingView(self) as {
            effectiveTrackLabels?: string
          }
          // when grouping (prefersOffset) the label is drawn above the plot, so
          // the coverage axis needn't dodge right of it (matches TrackContainer)
          if (
            view.effectiveTrackLabels === 'overlapping' &&
            !self.prefersOffset
          ) {
            const track = getContainingTrack(self)
            return measureText(getConf(track, 'name'), 12.8) + 100
          }
          return 0
        },

        /**
         * #getter
         */
        get showOutline() {
          return getConf(self, 'showOutline') ?? self.isChainMode
        },

        /**
         * #getter
         */
        get visibleLabels() {
          const view = getContainingView(self) as LGV
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
            scrollTop: self.scrollTop,
          })
        },

        /**
         * #getter
         * Chain member ids to highlight, empty unless in `normal` linked-read
         * mode. Single source for the "is this a chain highlight" decision that
         * both `highlightBoxes` (which ids to box) and `HighlightOverlay` (how
         * strongly to shade them) read, so the two can't drift.
         */
        get highlightChainIds() {
          return self.linkedReads === 'normal' ? self.highlightedChainIds : []
        },

        /**
         * #getter
         * Screen boxes for the hovered read / chain, painted by the
         * `HighlightOverlay` div. Deliberately NOT part of `renderState`: the
         * hovered id changes on nearly every mousemove, and routing it through
         * the canvas would repaint the whole pileup each move.
         */
        get highlightBoxes() {
          const view = getContainingView(self) as LGV
          const chainIds = this.highlightChainIds
          const ids =
            chainIds.length > 0
              ? chainIds
              : self.featureIdUnderMouse
                ? [self.featureIdUnderMouse]
                : []
          // Reading `readIdIndexMap` forces its (per-read) build over the whole
          // fetched dataset — deferred until something is actually hovered /
          // highlighted so it stays off the initial-render path.
          return view.initialized && ids.length > 0
            ? computeHighlightBoxes({
                view,
                sections: this.renderSections,
                readIdIndexMap: self.readIdIndexMap,
                ids,
                height: self.height,
                featureHeight: self.featureHeight,
                featureSpacing: self.featureSpacing,
                scrollTop: self.scrollTop,
              })
            : []
        },

        /**
         * #method
         */
        searchFeatureByID(
          featureId: string,
        ): [number, number, number, number] | undefined {
          const hit = self.findFeatureInRpcData(featureId)
          if (!hit) {
            return undefined
          }
          const { rpcData, idx, start, end } = hit
          const yRow = rpcData.readYs[idx]
          if (yRow === undefined) {
            return undefined
          }
          const top = yRow * self.rowHeight
          return [start, top, end, top + self.featureHeight]
        },

        /**
         * #method
         * Chain IDs sharing a QNAME with the read at `index` in `rpcData`.
         * Empty when the read isn't part of a chain. Shared by hover-highlight
         * and click-select so the two paths can't drift.
         */
        chainIdsForRead(rpcData: PileupDataResult, index: number) {
          const { readChainIndices, chainNames } = rpcData
          const chainIdx = readChainIndices?.[index]
          const name =
            chainIdx === undefined ? undefined : chainNames?.[chainIdx]
          return name === undefined ? [] : (self.chainIdMap.get(name) ?? [])
        },

        getFeatureInfoById(featureId: string) {
          const hit = self.findFeatureInRpcData(featureId)
          if (!hit) {
            return undefined
          }
          const { displayedRegionIndex, idx, rpcData, start, end } = hit
          const view = getContainingView(self) as LGV
          const flags = rpcData.readFlags[idx]
          return {
            id: featureId,
            name: rpcData.readNames[idx] ?? '',
            start,
            end,
            flags,
            mapq: rpcData.readMapqs[idx],
            strand: flags !== undefined && flags & 16 ? -1 : 1,
            refName:
              view.displayedRegions[displayedRegionIndex]?.refName ?? 'unknown',
          }
        },
      }))
      .views(self => ({
        /**
         * #getter
         * The read height that makes every uncollapsed group's reads fill the
         * display without scrolling. Row count is fixed by read overlaps, so we
         * lay the groups out uncapped (a fixed maxHeight-row cap, independent of
         * the current featureHeight — so the fit autorun that writes featureHeight
         * can't feed back into this) and divide the pileup space by it.
         *
         * Fractional (not floored): the pileup then fills the display exactly
         * rather than leaving up to a row of slack at the bottom. Clamped up to a
         * 1px floor — below 1px the reads can't all fit, so the stack scrolls
         * instead. 0 when there's nothing to fit (no data / no room), signalling
         * "leave the configured height as-is".
         *
         * Also clamped down to the NORMAL read pitch — not the currently
         * configured height — because fit OVERRIDES the compactness preset: a
         * handful of reads in a tall display would otherwise stretch to fill it,
         * e.g. one read blown up to 100px. Capping at the configured height would
         * instead let a Compact/Super-compact selection clamp the fit expansion
         * (compact overriding fit), so a fit under Compact could never grow past
         * 3px. Fit should only ever squeeze reads smaller than normal, never grow
         * them past it; once there's more room than reads need, the extra space is
         * left blank (`laidOutByGroup` already scrolls/pads for the shortfall).
         *
         * Reads the `fitTargetHeight` slot, NOT the reactive `height` getter — the
         * same anti-cycle rule `laidOutByGroup` follows. Fit mode only, where the
         * two are equal, but the slot can never chain back through
         * height->grownHeight->layout->featureHeight if this ever moves.
         */
        get fittedFeatureHeight() {
          const counts = layoutGroupRowCounts(
            self.groupLayoutContext,
            maxRowsFor(self.maxHeight, 1),
          )
          const rows = self.groupOrder
            .filter(g => !self.collapsedGroups.has(g.key))
            .reduce((sum, { key }) => sum + (counts.get(key) ?? 0), 0)
          // rows === 0 (no groups) already short-circuits to 0 below, so
          // groupOrder.length is >= 1 whenever this product matters — matching the
          // layout's `groupCount * overhead`.
          const pileupSpace =
            self.fitTargetHeight -
            self.groupOrder.length * self.coverageDisplayHeight
          // Cap at the pitch a NORMAL read renders at (body + its derived gap),
          // never the configured Compact/Super-compact size: choosing "fit"
          // overrides the compactness preset, so a small configured height must
          // not clamp the fit — otherwise Compact would override fit instead of
          // the reverse. The cap only stops a handful of reads ballooning past
          // normal in a tall display; below normal, fit squeezes freely.
          return rows > 0 && pileupSpace > 0
            ? Math.min(NORMAL_PITCH, Math.max(1, pileupSpace / rows))
            : 0
        },

        /**
         * #getter
         */
        get scrollableHeight() {
          return Math.max(
            0,
            self.pileupContentHeight - self.pileupViewportHeight,
          )
        },

        // Only the tag NAME is sent to the worker (to extract per-read
        // sortTagValues). Wrapping as its own getter means rpcProps only
        // re-notifies when the tag itself changes — not when sort
        // position or sort type flips between non-tag flavors.
        /**
         * #getter
         */
        get sortTag() {
          return self.sortedBy?.type === 'tag' ? self.sortedBy.tag : undefined
        },

        // Fields that invalidate the fetched pileup/chain data. Worker-
        // bound (filterBy, colorBy, …) plus the one main-thread decision
        // field that selects between pileup and chain RPC (linkedReads).
        // Arc-only fields (arcColorByType, drawInter, drawLongRange) are
        // NOT here — they are tracked by the arcsRpcDataMap computed
        // getter and do not require a refetch. Non-tag sort changes are
        // handled main-thread by laidOutPileupMap, as is tag coloring
        // (colorTagMap is baked into readTagColors in laidOutPileupMap, so it
        // is intentionally NOT in rpcProps — putting it here would re-create
        // the discover→assign→refetch feedback loop).
        /**
         * #method
         */
        rpcProps() {
          return {
            filterBy: self.filterBy,
            colorBy: self.colorBy,
            sortTag: this.sortTag,
            groupBy: self.groupBy,
            showSoftClipping: self.showSoftClipping,
            // showCoverage is here (not just renderState) because the worker
            // skips the entire coverage-band pipeline — including the per-bp GPU
            // depth buffer that overflows the device limit at whole-chromosome
            // scale — when the band is off. So toggling it refetches. The
            // pileup's low-frequency fade is unaffected (see runCoveragePipeline).
            showCoverage: self.showCoverage,
            drawSingletons: self.drawSingletons,
            drawProperPairs: self.drawProperPairs,
            showOnlySplitAlignments: self.showOnlySplitAlignments,
            linkedReads: self.linkedReads,
          }
        },

        /**
         * #getter
         */
        get renderState() {
          const view = getContainingView(self) as LGV
          const palette = self.colorPalette
          return {
            scrollTop: self.scrollTop,
            colorScheme: self.colorSchemeIndex,
            featureHeight: self.featureHeight,
            featureSpacing: self.featureSpacing,
            showCoverage: self.showCoverage,
            coverageHeight: self.coverageHeight,
            coverageYOffset: YSCALEBAR_LABEL_OFFSET,
            coverageMaxDepth: self.coverageDomain?.[1],
            coverageIsLog: self.coverageIsLog,
            showMismatches: self.showMismatches,
            filterMismatchesByFrequency: self.filterMismatchesByFrequency,
            mismatchAlpha: self.mismatchAlpha,
            showSoftClipping: self.showSoftClipping,
            showInterbaseIndicators: self.showInterbaseIndicators,
            showModifications: self.showModifications,
            showPerBaseQuality: self.showPerBaseQuality,
            showPerBaseLetter: self.showPerBaseLetter,
            showOutline: self.showOutline,
            readConnections: self.readConnections,
            readConnectionsDown: self.readConnectionsDown,
            readConnectionsHeight: self.readConnectionsHeight,
            pileupTopOffset: self.coverageDisplayHeight,
            coverageTopOffset: 0,
            sections: buildSectionRenders(self.sections, {
              scrollTop: self.scrollTop,
              canvasHeight: self.height,
            }),
            canvasWidth: view.width,
            canvasHeight: self.height,
            selectedFeatureId: self.selectedFeatureId,
            // Chain selection is only valid in 'normal' linked-reads mode.
            // Gating here makes a stale selection unrenderable in off/bezier by
            // construction — render correctness no longer depends on any
            // clear-on-transition. The renderers draw on `length > 0` with no
            // mode check, so this is the one place the invariant must hold.
            // (Hover highlight lives in `highlightBoxes` / `HighlightOverlay`,
            // not here, so a hover never triggers a canvas repaint.)
            selectedChainIds:
              self.linkedReads === 'normal' ? self.selectedChainIds : [],
            colors: palette,
            linkedReads: self.linkedReads,
            showLinkedReadLines: self.showLinkedReadLines,
            flipStrandLongReadChains: self.flipStrandLongReadChains,
            colorSupplementaryChains: self.colorSupplementaryChains,
            readConnectionsLineWidth: self.readConnectionsLineWidth,
            arcsYDomainBp: this.arcsYDomainBp,
          }
        },

        // Floored at 1000bp to avoid near-zero division when all pairs are concordant.
        /**
         * #getter
         */
        get arcsYDomainBp() {
          if (self.readConnections !== 'cloud') {
            return undefined
          }
          // Max across every group so all sections share one Y-domain (the same
          // comparability trick coverage uses with coverageMaxDepth). Ungrouped
          // has one group, so this reduces to the prior single-group max.
          let maxBp = 0
          for (const regionMap of self.arcsByGroup.values()) {
            for (const data of regionMap.values()) {
              if (data.maxFlatArcYBp > maxBp) {
                maxBp = data.maxFlatArcYBp
              }
            }
          }
          return Math.max(1000, maxBp)
        },

        /**
         * #getter
         */
        get insertSizeTicks() {
          const domain = this.arcsYDomainBp
          if (domain === undefined) {
            return undefined
          }
          // arcsYDomainBp is only set in read-cloud mode, so this runs only then.
          // The ruler reuses the arcs' own band geometry so ticks land on the
          // arc apexes (see insertSizeTicks.ts / features/arcs/drawCanvas.ts).
          const band = computeArcBand({
            showCoverage: self.showCoverage,
            coverageHeight: self.coverageHeight,
            coverageYOffset: YSCALEBAR_LABEL_OFFSET,
            readConnections: self.readConnections,
            readConnectionsDown: self.readConnectionsDown,
            readConnectionsHeight: self.readConnectionsHeight,
          })
          if (!band) {
            return undefined
          }
          return computeInsertSizeTicks({ band, arcsYDomainBp: domain })
        },
      }))
      .views(self => ({
        /**
         * #getter
         */
        get featureUnderMouse() {
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
            name: info.name || info.id,
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
      .actions(self => {
        const superSetError = self.setError
        function addModification(modType: string) {
          if (!self.detectedModifications.has(modType)) {
            self.detectedModifications.set(
              modType,
              getColorForModification(modType),
            )
          }
        }
        function clearMouseoverState() {
          self.featureIdUnderMouse = undefined
          self.mouseoverExtraInformation = undefined
          self.overCigarItem = false
          self.hoverCoverageBand = undefined
          if (self.highlightedChainIds.length > 0) {
            self.highlightedChainIds = []
          }
        }
        function setShowSashimiArcs(show: boolean) {
          self.configuration.setSlot('showSashimiArcs', show)
          // Sashimi only renders over the coverage band, so making it visible
          // requires coverage. Keep this invariant here, not in the menu
          // handler, so it holds for every caller.
          if (show) {
            self.configuration.setSlot('showCoverage', true)
          }
        }
        return {
          /**
           * #action
           */
          clearMouseoverState,

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
           * Clear the hover/tooltip when the region goes too large (the banner
           * replaces the pileup). Called by MultiRegionDisplayMixin's
           * `ClearHoverOnRegionTooLarge` autorun, so it fires on the derived
           * gate's `regionTooLarge` transition without an imperative setter.
           */
          onRegionTooLarge() {
            clearMouseoverState()
          },

          /**
           * #action
           */
          setRpcData(
            displayedRegionIndex: number,
            data: GroupedAlignmentsResult | null,
          ) {
            if (data) {
              self.rpcDataMap.set(displayedRegionIndex, data)
              for (const { data: groupData } of data.groups) {
                for (const modType of groupData.detectedModifications) {
                  addModification(modType)
                }
              }
            } else {
              self.rpcDataMap.delete(displayedRegionIndex)
            }
          },

          /**
           * #action
           */
          clearDisplaySpecificData() {
            self.rpcDataMap.clear()
            self.scrollTop = 0
          },

          /**
           * #action
           */
          setOverCigarItem(flag: boolean) {
            self.overCigarItem = flag
          },

          /**
           * #action
           */
          setScrollTop(scrollTop: number) {
            // clamp here (like the variant model) so a resize that shrinks
            // scrollableHeight while scrollTop sits at the old bottom can't
            // strand it past the content — no native overflow container to
            // self-correct
            const next = Math.max(0, Math.min(scrollTop, self.scrollableHeight))
            if (self.scrollTop !== next) {
              self.scrollTop = next
            }
          },

          /**
           * #action
           */
          setHighlightedChainIds(ids: string[]) {
            self.highlightedChainIds = ids
          },

          /**
           * #action
           */
          clearHighlights() {
            if (self.highlightedChainIds.length > 0) {
              self.highlightedChainIds = []
            }
          },

          /**
           * #action
           */
          clearSelection() {
            const session = getSession(self)
            if (isFeature(session.selection)) {
              session.clearSelection()
            }
            if (self.selectedChainIds.length > 0) {
              self.selectedChainIds = []
            }
          },

          /**
           * #action
           */
          setSelectedChainIds(ids: string[]) {
            self.selectedChainIds = ids
          },

          /**
           * #action
           */
          setColorScheme(colorBy: ColorBy) {
            const current = self.colorBy
            if (colorBy.type !== 'tag' || colorBy.tag !== current.tag) {
              self.colorTagMap = {}
            }
            self.configuration.setSlot('colorBy', colorBy)
          },

          /**
           * #action
           */
          updateColorTagMap(uniqueTag: string[]) {
            const { map, added } = updateColorTagMapPure(
              self.colorTagMap,
              uniqueTag,
            )
            // Only assign when a value was actually added: colorTagMap is read
            // by laidOutPileupMap, so a no-op assignment would needlessly
            // re-bake readTagColors.
            if (added) {
              self.colorTagMap = map
            }
          },

          /**
           * #action
           */
          setFilterBy(filterBy: FilterBy) {
            self.configuration.setSlot('filterBy', filterBy)
          },

          /**
           * #action
           */
          setShowSoftClipping(value: boolean) {
            self.configuration.setSlot('showSoftClipping', value)
          },

          /**
           * #action
           */
          setMismatchAlpha(value: boolean) {
            self.configuration.setSlot('mismatchAlpha', value)
          },

          /**
           * #action
           */
          setSortedBy(type: string, tag?: string) {
            const view = getContainingView(self) as LGV
            const { centerLineInfo } = view
            // basePair / insertion / softclip / hardclip / tag use sortPos
            // to pick which reads to sort first; position / strand ignore
            // it and produce a sensible layout without a center line.
            const needsPos = type !== 'position' && type !== 'strand'
            if (centerLineInfo && centerLineInfo.offset >= 0) {
              self.configuration.setSlot('sortedBy', {
                type,
                pos: Math.round(centerLineInfo.offset),
                refName: centerLineInfo.refName,
                assemblyName: centerLineInfo.assemblyName,
                tag,
              })
              // The sort anchors on the column under the center line, so reveal
              // it — the user sees exactly where the pileup is being ordered.
              view.setShowCenterLine(true)
            } else if (needsPos) {
              // Reveal the center line the warning asks the user to reposition —
              // it's the thing they need to see to comply.
              view.setShowCenterLine(true)
              getSession(self).notify(
                'Cannot sort: the view center line is not over a valid position. Scroll so the center line is within a region and try again.',
                'warning',
              )
            } else {
              const assemblyName = view.assemblyNames[0]
              if (assemblyName) {
                self.configuration.setSlot('sortedBy', {
                  type,
                  pos: -1,
                  refName: '',
                  assemblyName,
                  tag,
                })
              }
            }
          },

          /**
           * #action
           */
          setSortedByAtPosition(arg: {
            type: string
            pos: number
            refName: string
            tag?: string
          }) {
            const { type, pos, refName, tag } = arg
            const view = getContainingView(self) as LGV
            const assemblyName = view.assemblyNames[0]
            if (assemblyName) {
              self.configuration.setSlot('sortedBy', {
                type,
                pos,
                refName,
                assemblyName,
                tag,
              })
            } else {
              getSession(self).notify(
                'Cannot sort: no assembly loaded in this view.',
                'warning',
              )
            }
          },

          /**
           * #action
           */
          clearSortedBy() {
            self.configuration.setSlot('sortedBy', null)
          },

          /**
           * #action
           */
          setLargeFeaturesFirst(flag: boolean) {
            self.configuration.setSlot('largeFeaturesFirst', flag)
          },

          /**
           * #action
           * Set (or remove, when undefined) the in-track stacked grouping
           * dimension. A tier-1 refetch setting (in `rpcProps`) — the worker
           * re-partitions the fetch into N sections. Resets the Y scroll since
           * the stacked content height changes. Ungrouping stores an explicit
           * `null` override (not a cleared override) so it beats a configured
           * `groupBy` default rather than falling back to it.
           */
          setGroupBy(groupBy?: GroupBy) {
            self.configuration.setSlot('groupBy', groupBy ?? null)
            self.collapsedGroups.clear()
            self.groupMaxHeightOverrides.clear()
            self.scrollTop = 0
          },

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
           * Expand a fit-to-viewport group back to the full `maxHeight` cap (show
           * all its reads), or, if it already carries a height override (from
           * expand or a drag), drop the override to return it to the fit budget.
           * Expanding makes the stack overflow the viewport, which engages the
           * pileup scroll. Pairs with `hasGroupHeightOverride`.
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
           * Drag a stacked group's pileup band taller/shorter by `dy` px, capping
           * how many rows that group lays out. The continuous-accumulation policy
           * (seed once, floor at a row, pin/skip a fully-shown group) lives in the
           * pure `nextGroupHeightOverride`; this action just gathers the group's
           * live state and commits the result (undefined = leave on the fit
           * budget). Pairs with `hasGroupHeightOverride` / `toggleGroupExpanded`.
           */
          resizeGroupHeight(key: string, dy: number) {
            const next = nextGroupHeightOverride({
              dy,
              rowHeight: self.rowHeight,
              displayedPx:
                self.sections.sections.find(s => s.groupKey === key)
                  ?.pileupHeight ?? 0,
              existingPx: self.groupMaxHeightOverrides.get(key),
              fullyShown: !anyRegionTruncated(self.groupLaidOutMap(key)),
            })
            if (next !== undefined) {
              self.groupMaxHeightOverrides.set(key, next)
            }
          },

          /**
           * #action
           */
          setScaleType(val: string) {
            self.configuration.setSlot('scaleType', val)
          },

          /**
           * #action
           */
          setAutoscale(val?: string) {
            self.configuration.setSlot('autoscale', val)
          },

          /**
           * #action
           */
          setMinScore(val?: number) {
            self.configuration.setSlot('minScore', val)
          },

          /**
           * #action
           */
          setMaxScore(val?: number) {
            self.configuration.setSlot('maxScore', val)
          },

          /**
           * #action
           * Set the per-read pixel size. The track-sizing mode is a mostly
           * independent axis (changed via setHeightMode): grow keeps growing at
           * the new size. Fit is the exception — it derives the size, so a chosen
           * size would be dormant; picking one drops back to fixed so the pick
           * takes effect.
           */
          setFeatureHeight(height?: number) {
            if (self.fitHeightToDisplay) {
              self.configuration.setSlot('heightMode', 'fixed')
            }
            self.configuration.setSlot('featureHeight', height)
            self.scrollTop = 0
          },

          /**
           * #action
           */
          setMaxHeight(height?: number) {
            self.configuration.setSlot('maxHeight', height)
            self.scrollTop = 0
          },

          /**
           * #action
           * Set the track-height strategy by writing the unified `heightMode`
           * slot; the modes are mutually exclusive by construction. Entering a
           * non-`fixed` mode (fit or grow) resets the transient state a uniform
           * fit/grow contradicts — per-group height overrides (a drag opts a
           * group out) and the scroll offset (neither fit nor grow scrolls) —
           * tied to the explicit user action so a track that merely inherits the
           * mode from a session-wide default keeps its overrides. The driving
           * autoruns then keep `featureHeight` (fit) or `height` (grow) sized as
           * the display/data change.
           */
          setHeightMode(mode: HeightMode) {
            self.configuration.setSlot('heightMode', mode)
            if (mode !== 'fixed') {
              self.groupMaxHeightOverrides.clear()
              self.scrollTop = 0
            }
            // Seed the fitted pitch in the SAME transaction as the mode flip, so
            // the first render already draws reads at the fit height. Otherwise
            // `fittedHeightPx` stays stale (isFitting false → reads paint at the
            // configured height) until the AlignmentsFitHeight autorun ticks a
            // step later, and the display visibly snaps configured->fitted. The
            // autorun still keeps it fresh as the display resizes / data loads /
            // groups collapse, and covers cascade-driven fit entry (no
            // setHeightMode call) — this only removes the one-step lag on the
            // direct action.
            if (mode === 'fit') {
              self.fittedHeightPx = self.fittedFeatureHeight
            }
          },

          /**
           * #action
           * Cache the fitted read height so the `featureHeight`/`featureSpacing`
           * getters can split it into a body + derived gap. Written only by the
           * driving autorun.
           */
          setFittedHeightPx(px: number) {
            self.fittedHeightPx = px
          },

          /**
           * #action
           */
          setShowSashimiArcs,

          /**
           * #action
           */
          setReadConnections(mode: ReadConnectionsMode) {
            self.configuration.setSlot('readConnections', mode)
          },

          /**
           * #action
           */
          // Shared below-coverage band orientation for both read-connection
          // arcs and sashimi arcs. Single source of truth — there is no
          // per-feature direction to keep in sync.
          setReadConnectionsDown(down: boolean) {
            self.configuration.setSlot('readConnectionsDown', down)
          },

          /**
           * #action
           */
          setShowCoverage(show: boolean) {
            self.configuration.setSlot('showCoverage', show)
          },

          /**
           * #action
           */
          setShowPileup(show: boolean) {
            self.configuration.setSlot('showPileup', show)
          },

          /**
           * #action
           */
          setCoverageHeight(height: number) {
            self.configuration.setSlot(
              'coverageHeight',
              Math.max(MIN_BAND_HEIGHT, height),
            )
          },

          /**
           * #action
           */
          setReadConnectionsHeight(height: number) {
            self.configuration.setSlot(
              'readConnectionsHeight',
              Math.max(MIN_BAND_HEIGHT, height),
            )
          },

          /**
           * #action
           */
          setSashimiArcsHeight(height: number) {
            self.configuration.setSlot(
              'sashimiArcsHeight',
              Math.max(MIN_BAND_HEIGHT, height),
            )
          },

          /**
           * #action
           */
          setMinSashimiScore(score: number) {
            self.configuration.setSlot('minSashimiScore', score)
          },

          /**
           * #action
           */
          setSashimiArcsMode(mode: SashimiArcsMode) {
            self.configuration.setSlot('sashimiArcsMode', mode)
          },

          /**
           * #action
           */
          setShowSashimiLabels(show: boolean) {
            self.configuration.setSlot('showSashimiLabels', show)
          },

          /**
           * #action
           */
          setReadConnectionsLineWidth(width: number) {
            self.configuration.setSlot('readConnectionsLineWidth', width)
          },

          /**
           * #action
           */
          setDrawInter(draw: boolean) {
            self.configuration.setSlot('drawInter', draw)
          },

          /**
           * #action
           */
          setDrawLongRange(draw: boolean) {
            self.configuration.setSlot('drawLongRange', draw)
          },

          /**
           * #action
           */
          setArcColorByType(type: ArcColorByType) {
            self.configuration.setSlot('arcColorByType', type)
          },

          /**
           * #action
           */
          setShowMismatches(show: boolean) {
            self.configuration.setSlot('showMismatches', show)
          },

          /**
           * #action
           */
          setShowLegend(show: boolean | undefined) {
            self.configuration.setSlot('showLegend', show)
          },

          /**
           * #action
           */
          setDrawSingletons(flag: boolean) {
            self.configuration.setSlot('drawSingletons', flag)
          },

          /**
           * #action
           */
          setDrawProperPairs(flag: boolean) {
            self.configuration.setSlot('drawProperPairs', flag)
          },

          /**
           * #action
           */
          setShowOnlySplitAlignments(flag: boolean) {
            self.configuration.setSlot('showOnlySplitAlignments', flag)
          },

          /**
           * #action
           */
          setShowInterbaseIndicators(show: boolean) {
            self.configuration.setSlot('showInterbaseIndicators', show)
          },

          /**
           * #action
           */
          setFlipStrandLongReadChains(flag: boolean) {
            self.configuration.setSlot('flipStrandLongReadChains', flag)
          },

          /**
           * #action
           */
          setColorSupplementaryChains(flag: boolean) {
            self.configuration.setSlot('colorSupplementaryChains', flag)
          },

          /**
           * #action
           */
          setLinkedReads(mode: LinkedReadsMode) {
            const prev = self.linkedReads
            self.configuration.setSlot('linkedReads', mode)
            // Forget chain hover/selection when leaving 'normal' mode. This is
            // now a product choice (selection doesn't survive a mode change),
            // not a render-safety mechanism — `renderState` already gates chain
            // highlights on linkedReads === 'normal', so stale IDs can't render
            // regardless.
            if (prev === 'normal' && mode !== 'normal') {
              self.highlightedChainIds = []
              self.selectedChainIds = []
            }
            if ((prev === 'off') !== (mode === 'off')) {
              clearMouseoverState()
              const currentType = self.colorBy.type
              if (mode === 'off') {
                // Leaving pairs: pairing-only schemes no longer have meaning, so
                // reset colorBy back to inherit — falling back to the
                // session-wide color default, else the `normal` promotedBase.
                // This cleanly undoes the enter-pairs customization rather than
                // customizing `normal` over a default. Explicit non-pairing choices (tag,
                // methylation, base quality, ...) are preserved by the gate.
                if (PAIRING_COLOR_SCHEMES.has(currentType)) {
                  self.configuration.setSlot('colorBy', { type: 'inherit' })
                }
              } else if (currentType === 'normal') {
                // Entering pairs: nudge the plain default to the SV-signal
                // scheme, but don't clobber a scheme the user explicitly picked.
                self.configuration.setSlot('colorBy', {
                  type: 'insertSizeAndOrientation',
                })
              }
              self.invalidateLoadedRegions()
            }
          },

          /**
           * #action
           * Toggle the paired-read connection overlay. A main-thread tier-2/4
           * setting (read in `laidOutPileupMap` + `renderState`), not in
           * `rpcProps` — toggling it never refetches.
           */
          setShowBezierConnections(flag: boolean) {
            self.configuration.setSlot('showBezierConnections', flag)
          },

          /**
           * #action
           */
          updateVisibleModifications(uniqueModifications: string[]) {
            for (const modType of uniqueModifications) {
              addModification(modType)
            }
          },

          /**
           * #action
           */
          setModificationsReady(flag: boolean) {
            self.modificationsReady = flag
          },

          /**
           * #action
           */
          setFeatureIdUnderMouse(feature?: string) {
            self.featureIdUnderMouse = feature
          },

          /**
           * #action
           */
          setMouseoverExtraInformation(extra?: TooltipPayload) {
            self.mouseoverExtraInformation = extra
          },

          /**
           * #action
           */
          setHoverState(state: {
            overCigarItem: boolean
            featureIdUnderMouse: string | undefined
            mouseoverExtraInformation: TooltipPayload | undefined
            hoverCoverageBand?: { topOffset: number; coverageHeight: number }
          }) {
            self.overCigarItem = state.overCigarItem
            self.featureIdUnderMouse = state.featureIdUnderMouse
            self.mouseoverExtraInformation = state.mouseoverExtraInformation
            self.hoverCoverageBand = state.hoverCoverageBand
          },

          /**
           * #action
           */
          setContextMenuFeature(feature?: Feature) {
            self.contextMenuFeature = feature
          },

          /**
           * #action
           */
          closeContextMenu() {
            self.contextMenuCoord = undefined
            self.contextMenuFeature = undefined
            self.contextMenuCigarHit = undefined
            self.contextMenuIndicatorHit = undefined
            self.contextMenuModHit = undefined
            self.contextMenuBlock = undefined
            self.contextMenuGenomicPos = undefined
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
          self.attachRenderingBackend<AlignmentsRenderingBackend>(backend, {
            upload: b => {
              b.sync({
                sections: self.sourceSections,
              })
            },
            // size === 0 keeps first paint gated until data arrives, so the
            // loading overlay stays up (canvasDrawn stays false); an empty but
            // loaded region has size > 0 and paints an empty pileup.
            render: b =>
              self.laidOutPileupMap.size === 0
                ? false
                : b.renderBlocks(self.renderBlocks, self.renderState),
          })
        },
      }))
      .actions(self => {
        async function fetchAndDo(
          featureId: string,
          onFeat: (feat: SimpleFeature) => void,
        ) {
          const session = getSession(self)
          try {
            const feat = await fetchFeatureDetails(self, featureId)
            if (isAlive(self) && feat) {
              onFeat(feat)
            }
          } catch (e) {
            console.error(e)
            session.notifyError(`${e}`, e)
          }
        }
        return {
          /**
           * #action
           */
          async selectFeatureById(featureId: string) {
            await fetchAndDo(featureId, feat => {
              self.selectFeature(feat)
            })
          },
          /**
           * #action
           * Open the right-click menu over a hit. Coord, block, and the two hit
           * kinds always travel as a unit — set atomically so a consumer can
           * never read a block without its hit (the split-state class of bug
           * that silently no-op'd position sorts). The read feature is reset now
           * and, when the hit carries one, populated by an async RPC fetch — so
           * "open the menu for this hit and its read" stays a single call and a
           * repositioned menu can't inherit the prior read's items.
           */
          openContextMenu(args: {
            coord: [number, number]
            block?: ResolvedBlock
            genomicPos?: number
            cigarHit?: CigarHitResult
            indicatorHit?: IndicatorHitResult
            modHit?: ModificationHitResult
            featureId?: string
          }) {
            self.contextMenuCoord = args.coord
            self.contextMenuBlock = args.block
            self.contextMenuGenomicPos = args.genomicPos
            self.contextMenuCigarHit = args.cigarHit
            self.contextMenuIndicatorHit = args.indicatorHit
            self.contextMenuModHit = args.modHit
            self.contextMenuFeature = undefined
            // Pin the hover to the menu's target read so its highlight box
            // (highlightBoxes, keyed on featureIdUnderMouse) stays on while the
            // menu is open — the caller cleared mouseover state first, so this
            // re-boxes just the read the menu acts on. Undefined for
            // coverage/indicator hits, which have no read to box. Mirrors canvas
            // LinearBasicDisplay.openContextMenu.
            self.featureIdUnderMouse = args.featureId
            if (args.featureId !== undefined) {
              void fetchAndDo(args.featureId, feat => {
                self.setContextMenuFeature(feat)
              })
            }
          },
        }
      })
      .actions(self => {
        // One RPC for both pileup and chain modes; the worker branches on
        // `linkedReads` (passed via rpcProps).
        async function fetchFeaturesForRegion(
          adapterConfig: Record<string, unknown>,
          region: Region,
          displayedRegionIndex: number,
          stopToken: StopToken,
        ) {
          const session = getSession(self)
          const sequenceAdapter = getSequenceAdapter(session, region)
          const sessionId = getRpcSessionId(self)
          const result = await session.rpcManager.call(
            sessionId,
            'RenderAlignmentData',
            {
              adapterConfig,
              sequenceAdapter,
              regions: [region],
              ...self.rpcProps(),
              stopToken,
              // per-region status so the N parallel collapsed-intron fetches
              // aggregate into one bar instead of clobbering each other's
              // progress text (matches every other multi-region display)
              statusCallback:
                self.makeRegionStatusCallback(displayedRegionIndex),
            },
          )

          return { displayedRegionIndex, result }
        }

        return {
          /**
           * #action
           */
          getByteEstimateConfig() {
            return {
              adapterConfig: self.adapterConfig,
              visibleBp: (getContainingView(self) as LGV).visibleBp,
            }
          },

          /**
           * #action
           */
          async fetchNeeded(
            needed: { region: Region; displayedRegionIndex: number }[],
          ) {
            await self.fetchRegions(needed, async (ctx: FetchContext) => {
              const promises = needed.map(({ region, displayedRegionIndex }) =>
                fetchFeaturesForRegion(
                  self.adapterConfig,
                  region,
                  displayedRegionIndex,
                  ctx.stopToken,
                ),
              )
              const results = await Promise.all(promises)
              if (ctx.isStale()) {
                return
              }

              const newDataMap = new Map<number, GroupedAlignmentsResult>()
              self.setModificationsReady(true)
              for (const r of results) {
                // newTagValues are discovered per group; union across groups so
                // colorTagMap covers every section's reads.
                const tagValues = r.result.groups.flatMap(
                  g => g.data.newTagValues ?? [],
                )
                if (tagValues.length > 0) {
                  self.updateColorTagMap(tagValues)
                }
                newDataMap.set(r.displayedRegionIndex, r.result)
              }
              // Assigning colorTagMap (above) re-runs laidOutByGroup, which
              // bakes readTagColors on the main thread — no refetch needed, so
              // there is no feedback loop. Order vs setRpcData no longer
              // matters: the layout getter recomputes on either.
              for (const [displayedRegionIndex, data] of newDataMap) {
                self.setRpcData(displayedRegionIndex, data)
              }
            })
          },
        }
      })
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
                      current: self.arcColorByType,
                      setColor: (type: ArcColorByType) => {
                        self.setArcColorByType(type)
                      },
                    },
              supplementaryColoring: {
                flipStrandLongReadChains: self.flipStrandLongReadChains,
                setFlipStrandLongReadChains: (flag: boolean) => {
                  self.setFlipStrandLongReadChains(flag)
                },
                colorSupplementaryChains: self.colorSupplementaryChains,
                setColorSupplementaryChains: (flag: boolean) => {
                  self.setColorSupplementaryChains(flag)
                },
              },
              displayTypeDefault: (colorBy: ColorBy) =>
                makeSlotsValueDisplayTypeDefaultControl(self, [
                  { slot: 'colorBy', value: colorBy },
                ]),
            }),
            getSortByMenuItem(self, {
              disabled: !self.showPileup,
              disabledHelpText: 'Turn on "Show pileup" to sort reads',
            }),
            getFiltersMenuItem(self),
            getGroupByMenuItem(self),
            getReadsMenuItem(self),
            getFeatureHeightMenuItem(self, 'read', {
              disabled: !self.showPileup,
              disabledHelpText: 'Turn on "Show pileup" to change read height',
            }),
            getCoverageMenuItem(self),
            getReadConnectionsMenuItem(self),
            getSashimiMenuItem(self),
          ] satisfies MenuItem[]
        },

        /**
         * #method
         */
        contextMenuItems() {
          return getContextMenuItems(self)
        },
      }))
      // The derived, self-releasing too-large banner is opt-in via
      // MultiRegionDisplayMixin: it's enabled automatically because
      // getByteEstimateConfig() returns a config (the pre-flight captures the
      // estimate and short-circuits the download server-side; afterAttach clears
      // the estimate on chromosome nav, and onRegionTooLarge clears the hover).
      // Byte-only — no density axis.
      .actions(self => ({
        /**
         * #action
         */
        async renderSvg(opts?: ExportSvgDisplayOptions) {
          const { renderSvg } = await import('./renderSvg.tsx')
          return renderSvg(self as LinearAlignmentsDisplayModel, opts)
        },

        afterAttach() {
          // Drop the cached byte estimate on chromosome navigation:
          // displayedRegionIndex is reused across chromosomes, so a stale
          // estimate would gate the new region against the wrong stats and, since
          // FetchVisibleRegions gates on !regionTooLarge, wedge the banner. The
          // estimate intentionally survives viewport-change clears (no flicker on
          // pan); this hook is the one path that clears it. Mirrors canvas/maf.
          onDisplayedRegionsChange(self, () => {
            self.setByteEstimate(undefined)
          })
          // Keep the fitted-height cache in sync while in "fit to display height"
          // mode — re-fits as the display resizes, data loads, or groups collapse.
          // `fittedFeatureHeight` ignores featureHeight, so caching it (which the
          // featureHeight getter then reads) can't loop. In its own trailing
          // actions block so `self.setFittedHeightPx` (an earlier block) is typed.
          //
          // Why this stays an autorun (unlike grow mode, which is a pure reactive
          // `height` getter): fit's output is `featureHeight`, an EARLY getter that
          // `laidOutByGroup`/`sections` depend on, but its fitted value is computed
          // from the LATE `fittedFeatureHeight` (which reads `self.height`, the
          // group layout, and the coverage band — all defined after featureHeight).
          // That forward dependency can't be a direct getter read without a big
          // model reorder; the volatile `fittedHeightPx` bridges it, and this
          // autorun fills it. Grow has no such gap — its `height` output is
          // consumed late — so it needed no bridge. Don't "simplify" this to a
          // getter.
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
          // Grow mode needs no autorun to drive height: the `height` getter
          // returns `grownHeight` reactively (see the getter above), so consumers
          // recompute when the laid-out content changes without ever writing the
          // height config slot. Leaving grow is the one write — bake the grown
          // height into the slot on any grow->non-grow exit (menu switch,
          // reset-to-default, or a session-default change flipping a track that
          // follows the default) so fixed/fit resume from the height the user was
          // seeing, not the stale slot.
          addDisposer(
            self,
            installGrowExitBake(self, getContainingView(self) as LGV),
          )

          // Keep scrollTop inside the content by construction. Any geometry
          // change — band resize, group collapse/expand/drag, show/hide
          // coverage or pileup, read-connection mode, fit — can shrink
          // scrollableHeight below the current offset, and there's no native
          // overflow container to self-correct. Re-clamping reactively here
          // means individual actions never have to remember to do it.
          addDisposer(
            self,
            autorun(
              () => {
                if (self.scrollTop > self.scrollableHeight) {
                  self.setScrollTop(self.scrollableHeight)
                }
              },
              { name: 'AlignmentsClampScroll' },
            ),
          )

          // Drop a lingering hover tooltip/highlight when the view zooms. A
          // wheel-zoom leaves the cursor stationary (no mousemove to refresh
          // it), so the tooltip would pin to a now-wrong bp and re-render every
          // zoom frame. `reaction` tracks only bpPerPx; its effect is untracked
          // by construction, so reading the hover state to guard the clear can't
          // couple it back (setting a hover never self-clears).
          addDisposer(
            self,
            reaction(
              () => (getContainingView(self) as LGV).bpPerPx,
              () => {
                if (
                  self.featureIdUnderMouse !== undefined ||
                  self.mouseoverExtraInformation !== undefined
                ) {
                  self.clearMouseoverState()
                }
              },
            ),
          )
        },
      }))
      .actions(self => {
        const superResizeHeight = self.resizeHeight
        return {
          /**
           * #action
           * A manual drag-resize means the user wants a fixed height; leave grow
           * mode first, otherwise the grow autorun snaps the height back on the
           * next relayout and the drag appears to do nothing (mirrors canvas).
           * Read the displayed (grown) height before flipping and write
           * `grown + distance` directly — the grow-exit bake skips when the slot
           * is written during the exit, so this delta isn't clobbered.
           */
          resizeHeight(distance: number) {
            if (self.autoHeight) {
              const grown = self.height
              self.setHeightMode('fixed')
              return self.setHeight(grown + distance) - grown
            }
            return superResizeHeight(distance)
          },
        }
      })
  )
}

export type LinearAlignmentsDisplayStateModel = ReturnType<
  typeof stateModelFactory
>
// interface (not type alias) breaks the circular reference TypeScript would
// encounter through React.lazy → PileupComponent → useAlignmentsBase → model
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface LinearAlignmentsDisplayModel extends Instance<LinearAlignmentsDisplayStateModel> {}
