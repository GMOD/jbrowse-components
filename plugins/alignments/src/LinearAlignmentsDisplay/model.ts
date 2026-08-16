import { lazy } from 'react'

import {
  computeCoverageTicks,
  coverageDepthDomain,
  computeVisibleCoverageStats,
} from '@jbrowse/alignments-core'
import { getSequenceAdapterConfig } from '@jbrowse/core/assemblyManager/assembly'
import {
  ConfigurationReference,
  getConf,
  makePin,
  resolveConf,
  setConf,
} from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import {
  SimpleFeature,
  canonicalizeViewRefName,
  getContainingTrack,
  getContainingView,
  getRpcSessionId,
  getSession,
  isFeature,
  measureText,
  notifyFeatureDetailsMiss,
  openFeatureWidget,
  withFeatureDetails,
} from '@jbrowse/core/util'
import { MIN_BAND_HEIGHT, clampBandHeight } from '@jbrowse/core/util/bandHeight'
import { sameStrings } from '@jbrowse/core/util/sameStrings'
import { addDisposer, types } from '@jbrowse/mobx-state-tree'
import {
  HeightModeMixin,
  MultiRegionDisplayMixin,
  TrackHeightMixin,
  callEachRegion,
  installGrowExitBake,
} from '@jbrowse/plugin-linear-genome-view'
import { regionDataMap } from '@jbrowse/render-core/installPerRegionLifecycle'
import {
  ScoreScaleMixin,
  domainFromStats,
  getNiceDomain,
} from '@jbrowse/wiggle-core'
import { YSCALEBAR_LABEL_OFFSET } from '@jbrowse/wiggle-core/constants'
import { autorun, observable } from 'mobx'

import { arcAvailH, arcYScale } from '../features/arcs/arcYScale.ts'
import {
  arcColorLegendCategory,
  computeArcsByGroup,
  computeReadChains,
} from '../features/arcs/compute.ts'
import { computeCrossRegionArcs } from '../features/arcs/crossRegionOverlay.ts'
import { computeDerivativePaths } from '../features/derivativePaths/computePaths.ts'
import {
  bezierConnectionLegendItems,
  enumerateBezierPairs,
} from '../features/linkedReads/computeOverlay.ts'
import { computeSashimiArcs } from '../features/sashimi/computeOverlay.ts'
import {
  COLOR_SCHEMES,
  isModificationScheme,
  normalizeColorBy,
  workerColorBy,
} from '../shared/colorSchemes.ts'
import { groupByForMode, normalizeGroupBy } from '../shared/groupFeatures.ts'
import {
  getArcLegendItems,
  getReadDisplayLegendItems,
  readCategoryLabelOverrides,
  readColorCategoryLabel,
} from '../shared/legendUtils.ts'
import { readNameAt } from '../shared/readNameBlock.ts'
import {
  DEFAULT_MODIFICATION_THRESHOLD,
  normalizeFilterBy,
} from '../shared/types.ts'
import { getColorForModification } from '../util.ts'
import {
  updateColorTagMap as updateColorTagMapPure,
  updateQueryNameColorMap,
} from './colorTagUtils.ts'
import {
  READ_COLOR_CATEGORY_BY_INDEX,
  framesUnpairedChainStrand,
} from './colorUtils.ts'
import {
  buildColorPaletteFromPalette,
  makeBpToScreenX,
} from './components/alignmentComponentUtils.ts'
import { computeHighlightBoxes } from './components/computeHighlightBoxes.ts'
import { computeVisibleLabels } from './components/computeVisibleLabels.ts'
import { splitArcsBySide } from './components/sashimiArcs.ts'
import { ColorScheme } from './constants.ts'
import { GROUP_LABEL_HEIGHT } from './groupLabelStyle.ts'
import {
  anyRegionTruncated,
  applyReadColorsByGroup,
  collectAcrossGroups,
  groupMaxY,
  layoutGroupRowCounts,
  layoutGroupsToViewport,
  maxRowsFor,
  nextGroupHeightOverride,
  someAcrossGroups,
} from './groupLayout.ts'
import {
  buildReadIdsByChainName,
  buildRawDataByGroup,
  buildReadIdIndexMap,
  buildSashimiDownKeys,
  hasNamedGroups,
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
  getFiltersMenuItems,
  getGroupByMenuItem,
  getReadConnectionsMenuItem,
  getReadsMenuItems,
  getSashimiMenuItem,
  getSortByMenuItem,
} from './menus/index.ts'
import { migrateAlignmentsSnapshot } from './migrateAlignmentsSnapshot.ts'
import { shouldDrawOverlaps } from './renderers/rendererTypes.ts'
import {
  belowCoverageBandsGeometry,
  buildSectionRenders,
  computeStackedSections,
} from './sectionLayout.ts'

import type {
  GroupedAlignmentsResult,
  PileupDataResult,
} from '../RenderAlignmentDataRPC/types'
import type { ArcsByGroupResult } from '../features/arcs/compute.ts'
import type { ArcsUploadData } from '../features/arcs/types.ts'
import type { DerivativeCandidate } from '../features/derivativePaths/computePaths.ts'
import type { BezierArcScope } from '../features/linkedReads/computeOverlay.ts'
import type {
  ArcColorByType,
  ColorBy,
  ColorSchemeType,
  FilterBy,
  GroupBy,
  SortedBy,
} from '../shared/types'
import type { ReadColorCategory } from './colorUtils.ts'
import type { ArcHighlight } from './components/arcHitTest.ts'
import type { ContextMenuHit } from './components/hitTestPipeline.ts'
import type { SashimiArcSection } from './components/sashimiArcs.ts'
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
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { ContextMenuAnchor, MenuItem } from '@jbrowse/core/ui'
import type { AbstractSessionModel, Feature, Region } from '@jbrowse/core/util'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type {
  ExportSvgDisplayOptions,
  FetchContext,
  HeightMode,
} from '@jbrowse/plugin-linear-genome-view'

function getSequenceAdapter(session: AbstractSessionModel, region: Region) {
  return getSequenceAdapterConfig(
    region.assemblyName
      ? session.assemblyManager.get(region.assemblyName)
      : undefined,
  )
}

interface FetchFeatureDetailsSelf {
  adapterConfig: Record<string, unknown>
  rpcProps: () => { lodMode?: BaseOptions['lodMode'] }
  getFeatureInfoById: (id: string) =>
    | {
        refName: string
        assemblyName: string
        start: number
        end: number
      }
    | undefined
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
  // refName + assemblyName come from the loaded region the read was fetched
  // from (see getFeatureInfoById), so there's nothing to look up here. The old
  // refName scan over loadedRegions could pick a different region's assembly and
  // threw on the one it couldn't resolve.
  //
  // A single base at the feature's start, not its full extent: the adapter
  // returns everything overlapping the region and we keep the one matching id,
  // so the extent only ever made the query bigger. It is the read's own length
  // for a BAM, but the whole block for a synteny alignment — right-clicking a
  // megabase PAF block re-read the entire block just to name it, so the menu's
  // feature items landed seconds after it opened.
  const region = {
    refName: info.refName,
    assemblyName: info.assemblyName,
    start: info.start,
    end: info.start + 1,
  }
  const sequenceAdapter = getSequenceAdapter(session, region)
  const sessionId = getRpcSessionId(self)
  const { feature } = await session.rpcManager.call(
    sessionId,
    'GetPileupFeatureDetails',
    // Nothing to report and nothing worth stopping: the region is a single base
    // (see above), the adapter's index is already resident by the time a read is
    // on screen to right-click, and the widget this feeds opens on the result.
    // eslint-disable-next-line no-restricted-syntax
    {
      adapterConfig: self.adapterConfig,
      sequenceAdapter,
      regions: [region],
      featureId,
      // The tier the pileup was fetched at. A tiered PIF adapter numbers its
      // coarse and fine rows from different file offsets, so ids only match
      // within one tier — querying the default (fine) tier for a feature drawn
      // from the coarse one found nothing, and the details silently never came.
      // Read live rather than recorded with the data because the two can't
      // drift: `lodMode` is part of `rpcProps`, so a tier flip trips
      // SettingsInvalidate, which drops every fetched region. Data on screen was
      // always fetched at the tier `rpcProps` names right now.
      lodMode: self.rpcProps().lodMode,
    },
  )
  if (!feature) {
    return undefined
  }
  return new SimpleFeature(feature)
}

// lazy so this eager state model does not pull the tooltip's @floating-ui
// dependency onto the startup path; the consumer renders it inside a Suspense
// boundary (AlignmentsDisplayComponent)
const AlignmentsTooltip = lazy(
  () => import('./components/AlignmentsTooltip.tsx'),
)

export { ColorScheme } from './constants.ts'

// Shared by every display that hides no group, so `groupOrder` compares against
// a stable identity rather than allocating a set per read.
const EMPTY_HIDDEN_GROUPS: ReadonlySet<string> = new Set()

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

// The read-fill scheme each arc coloring mode is the overlay twin of —
// getArcColorType (features/arcs/compute.ts) mirrors that scheme's classifier,
// so both paint a bucket the same color. Only 'orientation' is spelled
// differently on the two sides.
const ARC_SCHEME_AS_READ_SCHEME: Record<ArcColorByType, ColorSchemeType> = {
  insertSize: 'insertSize',
  orientation: 'pairOrientation',
  insertSizeAndOrientation: 'insertSizeAndOrientation',
}

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
        // The coverage band's score axis, shared with the wiggle family so the
        // wiggle-core score menu / SetMinMaxDialog consume this model directly.
        ScoreScaleMixin(),
        // Track-menu settings are config slots (read via getConf, written via
        // configuration.setSlot) so an edit survives hide/retick and a config
        // default can be set declaratively. The plain MST fields below are the
        // remaining toggles. Each setting also has a refetch/relayout/render
        // blast radius documented in CLAUDE.md §"Which getter decides what a
        // setting invalidates".
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
        // falling back to 'off'. resolveConf never returns the unset sentinel.
        // See promotableDefaults.ts.
        get linkedReads(): LinkedReadsMode {
          return resolveConf(self, 'linkedReads')
        },
        /** #getter */
        // "make view-as-pairs the default for all tracks" control (pin): active
        // when 'normal' is the session default for this display type
        get pairsDisplayTypeDefault() {
          return makePin(self, 'linkedReads', 'normal')
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
        get coverageSnpMinFrequency(): number {
          return getConf(self, 'coverageSnpMinFrequency')
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
        /**
         * #getter
         * Whether ordinary concordant pairs get an arc. Same definition of
         * concordant as `drawProperPairs`, which hides the reads themselves —
         * see `isConcordantPairRead`.
         */
        get drawProperPairArcs(): boolean {
          return getConf(self, 'drawProperPairArcs')
        },
        /**
         * #getter
         * Reads a translocation must gather, within one fragment length on both
         * sides, before its connector ticks are drawn. See
         * `clusteredInterchromSupport` — the count is over a window because a
         * mate-pair breakpoint is not localized to a base.
         */
        get minInterchromSupport(): number {
          return getConf(self, 'minInterchromSupport')
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
        // default, falling back to 'off'. resolveConf never returns the
        // unset sentinel. See promotableDefaults.ts.
        get readConnections(): ReadConnectionsMode {
          return resolveConf(self, 'readConnections')
        },
        /** #getter */
        // "make arcs the default for all tracks" control (pin): active when
        // 'arc' is the session default. Independent of read cloud (both toggles
        // share the readConnections slot but target different on-values).
        get arcsDisplayTypeDefault() {
          return makePin(self, 'readConnections', 'arc')
        },
        /** #getter */
        // "make read cloud the default for all tracks" control (pin): active when
        // 'cloud' is the session default
        get readCloudDisplayTypeDefault() {
          return makePin(self, 'readConnections', 'cloud')
        },
        /** #getter */
        // Resolved through the promotable-slot tiers (resolveConf): a
        // maybeBoolean sentinel (like showSoftClipping) — an unset track follows
        // the session-wide default, else the promotedBase (true). resolveConf
        // never surfaces the `undefined` inherit sentinel.
        get readConnectionsDown(): boolean {
          return resolveConf(self, 'readConnectionsDown')
        },
        /** #getter */
        // "make this the default for all tracks" control (pin): promotes the
        // track's current resolved value, so either direction (below or above the
        // coverage band) can be made the session-wide default.
        get readConnectionsDownDisplayTypeDefault() {
          return makePin(self, 'readConnectionsDown')
        },
        /** #getter */
        // Sentinel promotable slot: a track pins arcs on/off explicitly, else
        // follows the session-wide default, falling back to on.
        get showSashimiArcs(): boolean {
          return resolveConf(self, 'showSashimiArcs')
        },
        /**
         * #getter
         * "make the current sashimi on/off state the default for all tracks"
         * control (pin) for the submenu's own checkbox.
         */
        get showSashimiArcsDisplayTypeDefault() {
          return makePin(self, 'showSashimiArcs')
        },
        /** #getter */
        // Sentinel promotable slot (like linkedReads/readConnections): a track
        // pins 'up' explicitly, else follows the session-wide default, falling
        // back to 'up'.
        get sashimiArcsMode(): SashimiArcsMode {
          return resolveConf(self, 'sashimiArcsMode')
        },
        /**
         * #method
         * "make this arc placement the default for all tracks" control (pin),
         * one per option of the radio group. A method rather than a getter per
         * value: the options share one slot and differ only in the on-value, so
         * naming each combination was what made the base value 'up' look
         * unpinnable.
         */
        sashimiArcsModeDisplayTypeDefault(mode: SashimiArcsMode) {
          return makePin(self, 'sashimiArcsMode', mode)
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
        // Resolved through the promotable-slot tiers (resolveConf): an
        // explicit track value customizes soft clipping on or off; otherwise it
        // follows the session-wide default, falling back to off. A `maybeBoolean`
        // slot, so (unlike the old plain boolean) an explicit "off" can be customized
        // back over a session default of "on".
        get showSoftClipping(): boolean {
          return resolveConf(self, 'showSoftClipping')
        },

        /** #getter */
        // "make the current soft-clipping state the default for all tracks"
        // control (pin): symmetric, so it promotes whichever value the track
        // currently shows.
        get softClippingDisplayTypeDefault() {
          return makePin(self, 'showSoftClipping')
        },
      }))
      .volatile(() => {
        // typed local so the empty record isn't inferred as `{}` (a type assertion
        // here gets stripped by no-unnecessary-type-assertion)
        const colorTagMap: Record<string, string> = {}
        return {
          /**
           * #volatile
           * Draws the arc band's own geometry over the canvas — see
           * `ArcDebugOverlay`. Volatile rather than a config slot: it is a
           * diagnostic for "why is this arc this shape", not a display setting,
           * so it should not survive into a saved session or a shared link.
           */
          debugArcGeometry: false,
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
           * The read/feature id under a right-click, known synchronously (the
           * hit test carries it) unlike `contextMenuFeature`, which only lands
           * after an RPC. A menu item that can act from the id alone — or fetch
           * the feature in its own onClick — reads this, so it doesn't blink
           * into existence a fetch later.
           */
          contextMenuFeatureId: undefined as string | undefined,
          /**
           * #volatile
           * Viewport point the right-click menu opens at, and the single
           * "is the menu open" flag. Undefined = closed.
           */
          contextMenuAnchor: undefined as ContextMenuAnchor | undefined,
          /**
           * #volatile
           * Everything the right-click's hit test resolved — the block, the
           * clicked column, and whichever mark answered — as one value, so a
           * consumer can't read a block without its hit and closing the menu
           * can't forget a field. See `ContextMenuHit`.
           */
          contextMenuHit: undefined as ContextMenuHit | undefined,
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
          rpcDataMap: regionDataMap<GroupedAlignmentsResult>(),
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
           * Read ids of the chain under the cursor — NOT chain ids; see
           * `readIdsByChainName`, which is where they come from.
           */
          highlightedChainReadIds: [] as string[],
          /**
           * #volatile
           * Read ids of the clicked chain. Same id space as the hover set above.
           */
          selectedChainReadIds: [] as string[],

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
          /**
           * #volatile
           * The read-connection arc under the cursor, as the ink to draw over
           * it — `ArcHoverOverlay`'s whole input. A SNAPSHOT, resolved at the
           * mousemove that found the arc, exactly like the tooltip it appears
           * with: both describe where the cursor was, and both refresh on the
           * next move. `undefined` when not on an arc.
           */
          hoveredArcHighlight: undefined as ArcHighlight | undefined,
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
         * that already covers normal pairs WITHIN a region. Neither pass reaches
         * across one (both are per region, one buffer each); that is
         * `bezierArcScope`'s `crossRegion`.
         */
        get showLinkedReadLines() {
          return self.showBezierConnections && !this.isChainMode
        },
      }))
      // The coverage band's score axis (scaleType / autoscale / min-max + their
      // setters) is `ScoreScaleMixin`, composed above — the same one the wiggle
      // family composes, so the shared score menu and SetMinMaxDialog take this
      // model with no adapter shim and the two can't drift.
      .views(() => ({
        /**
         * #getter
         * Group keys that `groupOrder` drops, so a display can hide a lane its
         * own grouping produces without every consumer of the order learning
         * about it. Empty here; LGVSyntenyDisplay overrides it to hide the
         * self-alignment lane of an all-vs-all track.
         */
        get hiddenGroupKeys(): ReadonlySet<string> {
          return EMPTY_HIDDEN_GROUPS
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
        // its unset default) follows the session-wide color default
        // (e.g. "color every alignments track by methylation"), resolving to the
        // `promotedBase` `{type:'normal'}` when nothing is promoted; picking any
        // scheme — `normal` included — pins this track over that default.
        // resolveConf walks the cascade and never surfaces `inherit`.
        get colorBy(): ColorBy {
          return normalizeColorBy(resolveConf(self, 'colorBy'))
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
        // through resolveConf (track value, else session-wide default, else
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
          return resolveConf(self, 'featureHeight')
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
         * Resolved through the promotable-slot tiers (resolveConf): an
         * explicit track value pins labels on or off; otherwise it follows the
         * session-wide default, falling back to off. A `maybeBoolean` slot, so
         * (like mismatchAlpha) a session default of "on" can be customized back
         * off on a single track.
         */
        get showSashimiLabels(): boolean {
          return resolveConf(self, 'showSashimiLabels')
        },
        /**
         * #getter
         * "make the current sashimi-label state the default for all tracks"
         * control (pin): symmetric, so it promotes whichever value the track
         * currently shows.
         */
        get showSashimiLabelsDisplayTypeDefault() {
          return makePin(self, 'showSashimiLabels')
        },

        /**
         * #getter
         * Chain name → the ids of the READS in it. The two id spaces are easy to
         * confuse and nothing else in this model crosses them: `chainNames` (the
         * key here) is a chain's own identity, `readIds` (the values) are the
         * reads', and every consumer of this map resolves the values through
         * `readIdToIndex` / `readIdIndexMap`. Hence the names carried downstream
         * — `highlightedChainReadIds`, `selectedChainReadIds`.
         */
        get readIdsByChainName() {
          return buildReadIdsByChainName(self.rpcDataMap, self.isChainMode)
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
        // Resolved through the promotable-slot tiers (resolveConf): an
        // explicit track value customizes the fade on or off; otherwise it follows the
        // session-wide default, falling back to off. A `maybeBoolean` slot, so
        // (unlike showSoftClipping) a session default of "on" can be customized back
        // off on a single track.
        get mismatchAlpha(): boolean {
          return resolveConf(self, 'mismatchAlpha')
        },

        /**
         * #getter
         */
        // "make the current fade-by-quality state the default for all tracks"
        // control (pin): symmetric, so it promotes whichever value the track
        // currently shows.
        get mismatchAlphaDisplayTypeDefault() {
          return makePin(self, 'mismatchAlpha')
        },

        /**
         * #getter
         */
        get showLegend(): boolean {
          // Opt-in: the floating color legend is hidden by default for every
          // color scheme (including modifications) and shown only on demand via
          // the "Show legend" track-menu item, rather than eagerly covering the
          // top of every alignments track.
          //
          // Resolved through the promotable-slot tiers (resolveConf): an
          // explicit track value customizes the legend on or off; otherwise it
          // follows the session-wide default, falling back to the opt-in base.
          // A `maybeBoolean` slot, so a session default of "on" can be
          // customized back off on a single track — which is what the legend's
          // own "×" writes.
          return resolveConf(self, 'showLegend')
        },

        /**
         * #getter
         */
        // "make the current legend visibility the default for all tracks"
        // control (pin): symmetric, so it promotes whichever value the track
        // currently shows.
        get showLegendDisplayTypeDefault() {
          return makePin(self, 'showLegend')
        },

        /**
         * #getter
         * The single read of the `sortedBy` slot, so the RPC args and the menu
         * checkmarks cannot disagree about which sort is active.
         *
         * The refName is normalized here because this slot has two provenances
         * and only one of them is safe. `setSortedByAtPosition` (the center-line
         * "Sort by..." menu) writes a refName taken off the view's own region,
         * canonical by construction; a config or session spec writes whatever
         * the author typed. `sortLayout` gates the sort on
         * `commonRefName === sortedBy.refName` against the loaded regions, so an
         * aliased spec (`chr1` where the assembly is canonicalized `1`) leaves
         * the reads unsorted with the menu still showing the sort as active.
         *
         * A sort names a genomic COLUMN — a refName AND a position — so a slot
         * carrying neither half is no sort rather than a broken one, and this
         * getter's `SortedBy` says both are there. The slot is `frozen`, so a
         * config or session spec can put anything in it, and the two halves
         * fail differently: a missing refName reaches
         * `canonicalizeViewRefName`, which lower-cases what it is handed, so it
         * threw a TypeError out of a getter the fetch autorun and the render
         * both read — the whole track replaced by an error over a typo in a
         * spec. A missing `pos` merely compares false against every read and
         * sorts nothing, which is the same answer this now gives explicitly.
         */
        get sortedBy(): SortedBy | undefined {
          const sortedBy = getConf(self, 'sortedBy') as SortedBy | null
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
         * one fetch into N sections. The slot is `frozen` (unvalidated JSON), so
         * `normalizeGroupBy` is the chokepoint that keeps an unrecognized type or
         * a tag grouping with no tag name from reaching the worker.
         */
        get groupBy(): GroupBy | undefined {
          return normalizeGroupBy(getConf(self, 'groupBy'))
        },

        /**
         * #getter
         * Offset the track label above the visualization when grouping, so the
         * stacked group sections aren't hidden behind an overlapping label.
         *
         * Asks whether the grouping will be HONORED, not merely whether it is set:
         * chain mode drops a per-read dimension (`groupByForMode`), and reserving
         * label room for sections that then never get drawn leaves dead space above
         * the plot. Unlike `showsGroupLabels` this can't read the fetched sections —
         * the track label is positioned before any data arrives, and flipping once
         * it lands would jump the layout — but the degradation is decidable from the
         * two settings alone, so no data is needed.
         */
        get prefersOffset() {
          return groupByForMode(this.groupBy, self.isChainMode) !== undefined
        },

        /**
         * #getter
         * Whether each group draws as a single row, its overlap depth carried by
         * the tint layer rather than by stacking. Gated on the grouping actually
         * being honored (`prefersOffset`), so the slot can be a track-config
         * default without an ungrouped view silently flattening its whole pileup
         * onto one row.
         */
        get collapseGroupRows(): boolean {
          return this.prefersOffset && getConf(self, 'collapseGroupRows')
        },

        /**
         * #getter
         * Whether collapsing can take effect at all, and so whether the
         * "Show..." menu offers the toggle: the grouping has to be honored, and
         * chain mode never collapses (`collapsesRows`) because a chain row is a
         * chain and one row would drop the connecting lines the mode exists for.
         * The menu omits the row rather than showing it disabled, since a click
         * would write a slot no getter reads.
         */
        get canCollapseGroupRows() {
          return this.prefersOffset && !self.isChainMode
        },

        /**
         * #getter
         * Whether an explicit read ordering can take effect, and so whether the
         * ordering controls are live: there has to be a pileup to order, and
         * chain layout is handed neither `sortedBy` nor `largeFeaturesFirst`
         * (`buildLaidOutChainMap` takes neither) because its rows are chains,
         * ordered by chain distance. The sibling of `canCollapseGroupRows`, and
         * read by both surfaces that can set an ordering — the track menu's
         * "Sort by..." and the context menu's position-anchored sorts — so the
         * two can't answer it differently. Without it a chain-mode sort was a
         * silent no-op, and the tag mode additionally refetched the region to
         * extract `sortTagValues` (it is in `rpcProps`) that nothing reads.
         */
        get canSortReads() {
          return self.showPileup && !self.isChainMode
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
         * Whether a single group's pileup height can be set on its own, and so
         * whether the two surfaces that write `groupMaxHeightOverrides` are
         * offered: the label chip's expand/fit button and the per-group drag
         * handles. Both write the same volatile, so they answer this together —
         * the chip used to be offered where the handle was hidden.
         *
         * Nothing to size with the pileup hidden, and in fit mode an override is
         * a lane opting out of the fit the mode just computed: the extra rows
         * overflow the display it was sized to fill. The truncation notice
         * (`isGroupCeilingClipped`) steps aside in fit mode for the same reason.
         */
        get canSizeGroupHeights() {
          return self.showPileup && !self.fitHeightToDisplay
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
          const view = self.lgv
          if (!view.initialized) {
            return undefined
          }
          // coarseDynamicBlocks (500ms debounced) instead of dynamicBlocks so
          // the per-bp depth scan doesn't recompute on every animation frame
          // during pan/zoom — same approach as wiggle's visibleScoreRange.
          //
          // The domain spans every SHOWN group (expand each block into one entry
          // per group's coverage): a shared scale is what makes stacked sections
          // visually comparable. Ungrouped is the one-group case. Hidden lanes
          // are excluded — sizing the visible lanes' axis against a lane the
          // user hid is exactly the comparability this scale exists to give.
          const hidden = self.hiddenGroupKeys
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
              for (const { key, data } of grouped.groups) {
                if (!hidden.has(key)) {
                  covBlocks.push({ start: b.start, end: b.end, cov: data })
                }
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
         * The domain the coverage band draws against — `coverageDomain` with a
         * log scale's floor pulled up to one read (see `coverageDepthDomain`).
         *
         * **This, not `coverageDomain`, is what every consumer reads**: the
         * y-axis ticks and both renderers' normalizers. `coverageDomain[0]` used
         * to be read by none of them, so a `minScore` bound was resolved into it
         * and then thrown away — the menu reported a manual range in force while
         * the picture was identical.
         */
        get coverageDepthDomain() {
          return this.coverageDomain
            ? coverageDepthDomain(this.coverageDomain, self.scaleType)
            : undefined
        },

        /**
         * #getter
         */
        get coverageTicks() {
          return this.coverageDepthDomain
            ? computeCoverageTicks(
                this.coverageDepthDomain,
                self.coverageHeight,
                self.scaleType,
              )
            : undefined
        },

        /**
         * #getter
         * Read-color buckets actually present across the rendered reads, the
         * single input that lets the legend list only relevant swatches (see
         * legendUtils). Reads the same baked categories the renderer paints, so
         * the two can't disagree. Empty while the legend is hidden so the
         * O(reads) scan is skipped; MobX memoizes it against `laidOutByGroup`,
         * which already folds in the scheme and the classification opts.
         */
        get colorLegendCategories(): Set<ReadColorCategory> {
          const present = new Set<ReadColorCategory>()
          if (this.showLegend) {
            // Reads the BAKED categories off the laid-out groups, not a second
            // classification pass over `rpcDataMap`. Scanning the raw map was
            // subtly wrong: `readTagColors` is empty until the main thread bakes
            // it, and the `noTagValue` bucket is decided from that array — so
            // under a tag scheme the legend listed "Tag" for reads the renderer
            // was painting with the no-value neutral, and never listed
            // "No tag value" at all.
            //
            // Indices first, mapped once at the end: the category set is a
            // dozen entries where the index arrays are per read, so the lookup
            // runs a dozen times rather than once per read.
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
         * The per-read values the CPU-baked schemes actually painted in the
         * rendered reads — tag values, or mate refNames under chromosome
         * painting. `colorTagMap` cannot answer this: it only ever grows (it is
         * cleared solely when the scheme changes), so after panning it holds
         * every value the track has ever seen, and keying the legend straight
         * off it listed swatches for a chromosome the user navigated away from.
         * The presence filter every other scheme gets through
         * `colorLegendCategories`, for the one vocabulary that isn't a fixed
         * category set.
         *
         * `undefined` for schemes with no such values, which is what tells the
         * legend not to filter — distinct from the empty set, which means the
         * scheme has values and none are on screen. Same showLegend gate as the
         * category scan, for the same reason: it is O(reads).
         */
        get presentTagValues(): ReadonlySet<string> | undefined {
          const { type } = this.colorBy
          if (!this.showLegend || (type !== 'tag' && type !== 'mateRefName')) {
            return undefined
          }
          return collectAcrossGroups(this.laidOutByGroup, d => d.readTagValues)
        },

        /**
         * #getter
         * The modification types actually drawn in the rendered reads. The twin
         * of `presentTagValues`, against the same failure: `detectedModifications`
         * takes each region's types as that region's fetch lands and is never
         * cleared, so keying it whole named every type the track had ever seen —
         * pan off the one locus carrying 6mA and the box still listed 6mA.
         *
         * Off `modificationTypes`, which the worker builds from the MARKS rather
         * than from the MM/ML parse, so it is what a reader is looking at. The
         * two sets diverge on bisulfite — no tags to parse, every mark carrying
         * 'm' — and the legend's bisulfite branch answers before this filter for
         * that reason.
         *
         * `undefined` outside the modification schemes, which is what tells the
         * legend not to filter; the empty set means the scheme is on and no
         * marks are drawn. Same showLegend gate as the other two scans.
         */
        get presentModifications(): ReadonlySet<string> | undefined {
          if (!this.showLegend || !isModificationScheme(this.colorBy.type)) {
            return undefined
          }
          return collectAcrossGroups(
            this.laidOutByGroup,
            d => d.modificationTypes,
          )
        },

        /**
         * #getter
         */
        // Derived from the session theme so it's always available — including
        // headless SVG export and RPC, where no component mounts to seed it.
        get colorPalette(): ColorPalette {
          return buildColorPaletteFromPalette(getSession(self).palette)
        },

        /**
         * #getter
         * The arc color slots actually plotted, mapped to legend buckets —
         * curved paired-end arcs and the read cloud's flat lines and endpoint
         * squares alike, since both paint from `arcColorByType`. Its own
         * vocabulary when the fills use a different scheme (a track colored by
         * strand still draws insert-size-colored arcs), so it keys its own
         * legend section then and folds into the read key otherwise — see
         * `arcColorsMatchReads`. Empty unless an overlay is on with the legend
         * shown.
         */
        get arcLegendCategories(): Set<ReadColorCategory> {
          const present = new Set<ReadColorCategory>()
          if (this.showLegend && self.readConnections !== 'off') {
            // `colorSlots`, not a walk of `arcsByGroup`: that is only one of the
            // two halves the arcs are resolved into, and a lane whose every arc
            // crosses a seam would key no swatch at all for colours it draws.
            // The pass that holds both halves answers this — see
            // `ArcsByGroupResult`, which also says why it is computed after
            // regionization rather than before.
            for (const slot of this.arcsResult.colorSlots) {
              present.add(arcColorLegendCategory(slot, self.arcColorByType))
            }
          }
          return present
        },

        /**
         * #getter
         * Whether the overlay speaks the reads' own color vocabulary — arc mode
         * against its equivalent read scheme (see ARC_SCHEME_AS_READ_SCHEME),
         * AND every bucket the arcs are actually painting being one the reads
         * are painting too. The swatches are then identical categories in
         * identical palette colors, so keying both sections lists the same
         * colors twice under two headings; the arc buckets fold into the read
         * key instead.
         *
         * The second half is not belt-and-braces, it is the half that was
         * missing. Folding drops the curve mark and renders an arc bucket as a
         * plain read swatch, so it is an assertion that the reads paint that
         * color — and the scheme names alone do not support it, because the arc
         * classifier is not a re-spelling of the read one:
         *
         * - A SPLIT JUNCTION colors by its two segments' strands
         *   (`splitInversion` / `splitDeletion`), whatever the mode, since it has
         *   no TLEN and no pair orientation to classify. The read fills reach
         *   those two categories only in chain mode, so an ordinary pileup of
         *   SA-split long reads paints arc buckets its reads never paint.
         * - `hasPaired` is a property of the whole fetched set, so a track with
         *   no paired reads at all sends every arc down that same branch.
         *
         * (It used to name a different divergence: the arcs folded a pair whose
         * mates were drawn far apart into `longInsert` while the reads read TLEN
         * alone. That rule is gone — `getArcColorType` keys on TLEN and only
         * TLEN now, for the reasons written there — but the check outlives its
         * first example, which is exactly why it is asked of the categories in
         * hand rather than of a table of what each scheme COULD emit.)
         */
        get arcColorsMatchReads() {
          return (
            ARC_SCHEME_AS_READ_SCHEME[self.arcColorByType] ===
              this.colorBy.type &&
            [...this.arcLegendCategories].every(c =>
              this.colorLegendCategories.has(c),
            )
          )
        },

        /**
         * #getter
         * Which overlap mark the reader is looking at, for the legend row that
         * names it — undefined when there is none to name. The two layouts that
         * put more than one feature on a row are drawn differently and the row
         * differs with them: chain mode fills the span with a neutral that is no
         * read category, collapsed rows tint what is underneath (overlap.slang).
         *
         * Two conditions, and the second is the one the other swatches already
         * apply to themselves. The pass has to be DRAWING (`shouldDrawOverlaps`,
         * shared with both renderers rather than restated here, so a legend row
         * can't outlive the ink), and some region has to hold an actual
         * interval. Without the second, a paired track in chain mode whose mates
         * happen not to overlap anywhere in view gets a row explaining a mark
         * that isn't on screen — the same failure `presentCategories` and
         * `presentTagValues` exist to prevent, and it would be the common case
         * on long-insert libraries.
         *
         * O(regions), not O(reads): the layout already reduced each region's
         * overlaps to one array, so this reads a length per region.
         */
        get overlapLegendKind(): 'chain' | 'collapsed' | undefined {
          if (
            !shouldDrawOverlaps({
              chainMode: self.isChainMode,
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
            ? self.isChainMode
              ? 'chain'
              : 'collapsed'
            : undefined
        },

        /**
         * #method
         */
        legendItems() {
          return getReadDisplayLegendItems({
            overlaps: this.overlapLegendKind,
            colorBy: this.colorBy,
            presentCategories: this.arcColorsMatchReads
              ? new Set([
                  ...this.colorLegendCategories,
                  ...this.arcLegendCategories,
                ])
              : this.colorLegendCategories,
            palette: this.colorPalette,
            detectedModifications: self.detectedModifications,
            colorTagMap: self.colorTagMap,
            presentTagValues: this.presentTagValues,
            presentModifications: this.presentModifications,
            chainFramed: framesUnpairedChainStrand(
              colorSchemeIndexFor(this.colorBy.type),
              this.readColorOpts,
            ),
          })
        },

        /**
         * #method
         * Key for the paired-end arc / read-cloud colors. Empty when no overlay
         * is drawn, or when it shares the reads' scheme and merged into their
         * key — either way its legend section drops out of the box. A *partial*
         * overlap is not resolved here: this stays the complete arc key, and
         * `getAlignmentsLegendSections` folds it into one deduped list.
         */
        arcLegendItems() {
          return this.arcColorsMatchReads
            ? []
            : getArcLegendItems(
                this.arcLegendCategories,
                this.colorPalette,
                self.readConnections,
              )
        },

        /**
         * #getter
         * Heading for the overlay's own color key, named after the overlay the
         * reader is looking at: flat read-cloud lines are not arcs.
         */
        get arcLegendTitle() {
          return self.readConnections === 'cloud'
            ? 'Read cloud colors'
            : 'Arc colors'
        },

        /**
         * #getter
         * The fields `computeArcBand` reads, bundled so the layout can hand them
         * over whole.
         *
         * It used to have a second caller — the insert-size ruler assembled its
         * own band from this, and the bundle was what kept the two assemblies
         * identical. `insertSizeTickSections` now reads the band the LAYOUT
         * placed (`renderSections`), which it had to in order to rule more than
         * the first section, so the ruler and the arcs agree by reading one
         * answer rather than by computing one twice from one input.
         */
        get arcBandInput() {
          return {
            showCoverage: self.showCoverage,
            coverageHeight: self.coverageHeight,
            coverageYOffset: YSCALEBAR_LABEL_OFFSET,
            readConnections: self.readConnections,
            readConnectionsDown: self.readConnectionsDown,
            readConnectionsHeight: self.readConnectionsHeight,
          }
        },

        /**
         * #getter
         * Per group, which junctions draw in the strip below coverage (by
         * `junctionKey`). The single sashimi side decision: `sashimiDownArcLanes`
         * reads it to reserve the strip and `sashimiArcSections` reads it to
         * place each arc, so the space reserved and the arcs drawn into it can't
         * disagree. Memoized because the 'auto' assignment is O(junctions²) per
         * lane.
         *
         * refNames come from `loadedRegions` — keyed by displayedRegionIndex
         * like `rpcDataMap` and updated by the fetch, not by pan — so this stays
         * a tier-1 (fetch) derivation and the pileup doesn't re-lay-out as the
         * user scrolls. A region whose entry hasn't landed yet (the fetch sets
         * `rpcDataMap` and `loadedRegions` in separate actions, so one reaction
         * cycle sees the first without the second) falls back to a key unique to
         * that region rather than a shared '': two regions we can't yet prove
         * share a chromosome must not pool onto one bp number line, which is the
         * whole reason the refName is in the key.
         */
        get sashimiDownKeysByGroup() {
          return buildSashimiDownKeys(self.rpcDataMap, {
            minSashimiScore: self.minSashimiScore,
            mode: self.sashimiArcsMode,
            refNameFor: i => self.loadedRegions.get(i)?.refName ?? `#${i}`,
            hidden: self.hiddenGroupKeys,
          })
        },

        /**
         * #getter
         * Group keys whose junctions land in the strip below coverage, i.e. the
         * lanes that strip is reserved for. `belowCoverageBandsInput` only needs
         * whether any lane wants the strip, `sections` needs which.
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
            hasSashimiDownArcs: this.sashimiDownArcLanes.size > 0,
          }
        },

        /**
         * #getter
         * Per-group laid-out data: group key → (region index → laid-out data).
         * Each group lays out independently (own `maxRows` cap) so a dense group
         * can't starve the rest. When grouped, the default cap fits all sections
         * into the viewport (`fitGroupMaxRows`) so the stack doesn't tower and
         * need scrolling; a per-group height drag / expand still overrides it.
         *
         * Rows only — the per-read color arrays are baked one computed later, in
         * `laidOutByGroup`.
         */
        get laidOutByGroupUncolored() {
          return layoutGroupsToViewport(this.groupLayoutContext, {
            rowHeight: this.rowHeight,
            // Grow fits rows to the grow ceiling (content grows the track up to
            // it, then scrolls); fixed/fit fit to the drag-resizable slot. Both
            // read config slots, never the reactive `height` getter, so grow's
            // `height`→grownHeight→layout chain can't cycle.
            height: self.autoHeight ? self.growMaxHeight : self.fitTargetHeight,
            maxHeight: this.maxHeight,
            // A thunk, so the band heights only enter this computed's
            // dependencies when grouping actually spends them — see
            // `FitViewportInput.overhead`.
            overhead: () =>
              belowCoverageBandsGeometry(this.belowCoverageBandsInput).bottom,
            collapsedKeys: self.collapsedGroups,
            heightOverridesPx: self.groupMaxHeightOverrides,
          })
        },

        /**
         * #getter
         * Per-group laid-out data with the per-read color arrays baked on. Every
         * consumer reads this one; `laidOutByGroupUncolored` exists only to be
         * its layout half.
         *
         * The split is what keeps recoloring off the layout path. Nothing in
         * `readColorContext` can move a read's row, so folding those settings
         * into the layout computed made a color-scheme flip re-run the placement
         * pass, every per-feature Y remap and the modification Flatbush to change
         * two per-read arrays. Now the layout computed stays memoized across a
         * recolor, and because the overlay spreads its input, `readYs` survives
         * with it — which is the token the GPU renderer's upload memo reads to
         * rewrite only the read pass. Tag colors are baked here rather than in
         * the worker so `colorTagMap` stays a main-thread tier-2 setting (see
         * readTagColors).
         */
        get laidOutByGroup() {
          return applyReadColorsByGroup(
            this.laidOutByGroupUncolored,
            this.readColorContext,
          )
        },

        /**
         * #getter
         * The layout mechanics (grouping, sort, soft-clip) shared by the viewport
         * fit pass and any ad-hoc layout — e.g. `fittedFeatureHeight`, which lays
         * every group out uncapped to count rows. Kept apart from the fit policy
         * (row caps), which varies per call, and from the color inputs, which
         * invalidate a later tier.
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
            collapseGroupRows: this.collapseGroupRows,
          }
        },

        /**
         * #getter
         * The per-read color bake's inputs — see `laidOutByGroup` for why they
         * are not part of `groupLayoutContext`.
         */
        get readColorContext() {
          return {
            colorBy: this.colorBy,
            colorTagMap: self.colorTagMap,
            colorScheme: colorSchemeIndexFor(this.colorBy.type),
            readColorOpts: this.readColorOpts,
          }
        },

        /**
         * #getter
         * The non-scheme inputs to read classification. One bundle so the bake
         * (`overlayReadColorCategories`) and any ad-hoc `readColorCategory` call
         * can't be handed a different set.
         */
        get readColorOpts() {
          return {
            chainMode: self.isChainMode,
            flipStrandLongReadChains: self.flipStrandLongReadChains,
            colorSupplementaryChains: self.colorSupplementaryChains,
          }
        },

        /**
         * #getter
         * Group keys + labels in stacking order; a single entry (key '') when
         * ungrouped. Derived straight from the fetched `rpcDataMap` (not from the
         * layout pass), so group identity/order stays stable across relayouts.
         */
        get groupOrder() {
          const hidden = self.hiddenGroupKeys
          return orderedGroups(self.rpcDataMap).filter(g => !hidden.has(g.key))
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
         * #method
         * Which cap hid reads from a group's pileup, if any: `'budget'` for the
         * group's slice of the fit-to-viewport split, `'ceiling'` for the
         * display-wide `maxHeight`, `undefined` when nothing was hidden (or when
         * the user sized this group explicitly, which makes any clipping their
         * own doing).
         *
         * The two are different questions because different controls answer
         * them, and only one of them can be right: expanding a group banks an
         * override of `maxHeight` px, so a group ALREADY clipped at that ceiling
         * gets the identical cap back — not one extra read appears, while the
         * override silences the flag. A single-section grouping sat wholly in
         * that hole, since one group takes the ungrouped `maxRowsFor(maxHeight)`
         * cap and never a slice. A truncated group lays out exactly as many rows
         * as its cap, so comparing its rows to the ceiling recovers which cap
         * bound it without threading the caps back out of the layout pass.
         */
        groupClippedBy(key: string): 'budget' | 'ceiling' | undefined {
          const map = this.groupLaidOutMap(key)
          if (
            self.groupMaxHeightOverrides.has(key) ||
            !anyRegionTruncated(map)
          ) {
            return undefined
          }
          return groupMaxY(map) < maxRowsFor(this.maxHeight, this.rowHeight)
            ? 'budget'
            : 'ceiling'
        },

        /**
         * #method
         * True when a group's pileup was clipped by a cap the per-group expand
         * can actually raise. Drives the "show all" affordance on the section
         * label, which must not appear where it would do nothing.
         */
        isGroupTruncated(key: string) {
          return this.groupClippedBy(key) === 'budget'
        },

        /**
         * #method
         * True when THIS group's pileup was clipped by the display-wide
         * `maxHeight` and its overflow reads were collapsed. Drives the rule
         * drawn across the bottom of the clipped rows — see
         * `PileupTruncationRule`, which is per section because the notice marks
         * the place where the reads stop rather than a state of the whole track.
         *
         * The two suppressions are `pileupTruncated`'s, which is now this over
         * every group. In fit-to-display mode reads are already clamped to a 1px
         * floor and the overflow indicator flags the scroll instead; with the
         * pileup hidden nothing is drawn for the ceiling to clip.
         */
        isGroupCeilingClipped(key: string) {
          return (
            self.showPileup &&
            !self.fitHeightToDisplay &&
            this.groupClippedBy(key) === 'ceiling'
          )
        },

        /**
         * #getter
         * True when any pileup hit the display-wide `maxHeight` and overflow
         * reads were collapsed. Reads every group, not just an ungrouped one:
         * the ceiling is display-wide, so a stacked lane clipped by it is
         * exactly as unreachable as an ungrouped pileup would be, and the
         * per-label affordance deliberately steps aside for it.
         *
         * The display-wide answer; what is DRAWN is the per-section
         * `isGroupCeilingClipped`, which carries the suppressions this composes.
         */
        get pileupTruncated() {
          return this.groupOrder.some(g => this.isGroupCeilingClipped(g.key))
        },

        /**
         * #getter
         * Raw (un-laid-out) data regrouped as group key → (region idx → data),
         * insertion-ordered so the first key is the primary group. The arc
         * compute and the per-section sashimi overlay both read one group's raw
         * map from here; ungrouped is the single key `''`.
         *
         * Hidden lanes are already gone, like `groupOrder` — so a walk of every
         * entry here is a walk of every DRAWN lane, and no consumer has to
         * re-apply `hiddenGroupKeys`. See `buildRawDataByGroup`.
         */
        get rawDataByGroup() {
          return buildRawDataByGroup(self.rpcDataMap, self.hiddenGroupKeys)
        },

        /**
         * #getter
         * The fetched regions as `{refName,start,end,displayedRegionIndex}` —
         * the shape every per-read region scan takes (`computeArcsByGroup`,
         * `computeReadChains`). Regions whose fetch hasn't landed are dropped,
         * so a scan never has to test for a missing entry, and the list is
         * memoized once rather than rebuilt by each consumer.
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
         * The VIEW's displayed regions in the same shape, which is a different
         * list from `loadedRegionInfos` and answers a different question: not
         * "where did reads come from" but "where can a coordinate be drawn".
         *
         * The arc partition (`CrossRegionArc`) keys on this one, because its
         * criterion is whether `view.bpToPx` can project both feet and that
         * projector reads `displayedRegions`. Keying it on the fetched list
         * leaves the original bug alive for a displayed-but-unfetched partner —
         * see `ArcRegions`.
         *
         * `displayedRegions` changes on NAVIGATION and not on pan, so
         * `arcsByGroup` keeps the invalidation tier `loadedRegions`' own comment
         * exists to protect: panning within the fetched window still replays the
         * memo.
         */
        get displayedRegionInfos() {
          const view = self.lgv
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
         * Normalizer for a refName that arrives in the BAM's own spelling (an SA
         * tag's or RNEXT's `chr1`) rather than the assembly-canonical one a
         * fetched read carries (`1`). Undefined when no assembly is resolved,
         * where the consumers fall back to identity — `getCanonicalRefName2`
         * throws before `refNameAliases` load, hence the `initialized` gate. In
         * practice `rpcDataMap` only holds data once the assembly is loaded.
         *
         * Shared rather than resolved per consumer because both need it for the
         * same reason: without it a same-chromosome split junction reads as
         * inter-chromosomal, and a derivative path names refNames the view
         * doesn't have.
         */
        get canonicalRefName() {
          const firstRegion = self.loadedRegions.values().next().value
          const assembly = firstRegion
            ? getSession(self).assemblyManager.get(firstRegion.assemblyName)
            : undefined
          return assembly?.initialized
            ? (refName: string) => assembly.getCanonicalRefName2(refName)
            : undefined
        },

        /**
         * #getter
         * THE arc resolution, whole: both halves of what this fetch's reads say,
         * from one pass. Read it through `arcsByGroup` (what a per-region pass
         * draws) or `crossRegionArcsByGroup` (what only the overlay can), which
         * are its two faces and are documented there.
         *
         * One getter rather than two, because the split between them is a single
         * decision taken per connection inside `resolveArcs` — see
         * `CrossRegionArc`. Two getters resolving independently would each have
         * to re-derive it, and "which half is this arc in" would stop having one
         * answer.
         *
         * The heavy connection-resolution pass runs once per group (arcs are
         * pre-grouped by refName so each region lookup is O(1)); ungrouped is the
         * single-group case. Empty when read-connections are off, so the off-path
         * skips the per-read region scan entirely.
         *
         * `computeArcsByGroup` owns the whole fan-out rather than a loop here,
         * because the arc COLOR scale (`poolArcScale`: the insert-size band, and
         * whether the read set is paired at all) describes the fetch, not a lane
         * — the same rule the worker follows for `insertSizeStats` and this model
         * follows for `arcsYDomainBp`. Computing it needs every group's arcs in
         * hand, which a per-group loop can't provide.
         *
         * Hidden lanes never reach it, because `rawDataByGroup` has already
         * dropped them. They must be skipped, not just left unread: the
         * per-section consumers look this up by an already-filtered `groupOrder`
         * key, but the cross-group scans (`arcsYDomainBp`, `arcLegendCategories`)
         * walk every entry — so a hidden lane's arcs would size the read-cloud Y
         * axis the visible lanes share and key legend swatches for arcs nothing
         * draws, and its reads would shift `poolArcScale` for everyone. Skipping
         * also saves the whole per-read arc pass over a lane no section renders.
         */
        get arcsResult(): ArcsByGroupResult {
          if (self.readConnections === 'off' || self.rpcDataMap.size === 0) {
            return {
              byGroup: new Map(),
              crossRegionByGroup: new Map(),
              inkGroupKeys: new Set(),
              colorSlots: new Set(),
              maxFlatArcSpanBp: 0,
            }
          }
          const settings = {
            colorByType: self.arcColorByType,
            cloud: self.readConnections === 'cloud',
            drawInter: self.drawInter,
            drawLongRange: self.drawLongRange,
            drawProperPairArcs: self.drawProperPairArcs,
            minInterchromSupport: self.minInterchromSupport,
            // SA-tag / RNEXT refNames use the BAM's own naming, so a same-chr
            // split junction to an SA segment would otherwise be misclassified
            // inter-chromosomal. Undefined = no aliasing (identity).
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
         * The per-region GPU/Canvas2D upload feed. Every consumer that packs,
         * draws or hit-tests a region's arcs reads this; the arcs it does NOT
         * contain are the cross-region ones, which no per-region pass can draw
         * (`CrossRegionArc`) and which `crossRegionArcsByGroup` carries instead.
         */
        get arcsByGroup() {
          return this.arcsResult.byGroup
        },

        /**
         * #getter
         * Arcs whose two feet are in different displayed regions, per group.
         * Drawn by an SVG overlay across the whole view, because the per-region
         * passes map bp to x through the block's own range and would each
         * extrapolate the far foot to a place the other block is not — see
         * `CrossRegionArc` for the measurement. Empty in a single-region view.
         */
        get crossRegionArcsByGroup() {
          return this.arcsResult.crossRegionByGroup
        },

        /**
         * #getter
         * Whether there are reads to reconstruct FROM, as opposed to reads that
         * describe no rearrangement. An empty `derivativePathCandidates` means
         * either, and they call for opposite responses: widen the window, or
         * narrow it. A window too large for the track's byte budget renders as
         * `force load` with nothing behind it, and reporting that as "no path is
         * supported here" sends a reader looking for an event that was never
         * fetched.
         */
        get hasReadsForDerivativePaths() {
          return self.rpcDataMap.size > 0
        },

        /**
         * #getter
         * Derivative-allele paths the reads in view describe, most-supported
         * first. Each read's SA chain is already an ordered, oriented list of
         * reference intervals — a derivative path — so the proposal is a
         * grouping of those chains rather than any new analysis. Empty when no
         * reads are loaded, which `hasReadsForDerivativePaths` distinguishes.
         *
         * Deliberately NOT gated on `readConnections`: this reads the chains,
         * not the arcs, and a user who wants a reconstruction should not first
         * have to turn on a display option that draws something else.
         */
        get derivativePathCandidates(): DerivativeCandidate[] {
          if (!this.hasReadsForDerivativePaths) {
            return []
          }
          // Per group, then concatenated. Grouping (by HP tag, by strand, ...)
          // partitions reads for display and says nothing about which molecule
          // carries which junction, so it must not partition the evidence: a
          // path supported by four reads in two lanes is still supported by
          // four. Chaining within a group loses nothing, because a segment
          // sitting in another lane is named by the read's own SA tag and
          // `unpairedReadChain` folds it in from there.
          //
          // A HIDDEN lane is not that question and is already gone from
          // `rawDataByGroup`: those reads aren't partitioned away from the
          // evidence, they are excluded from the display outright (the
          // all-vs-all self-alignment lane), so counting their chains would rank
          // paths on reads the track never draws.
          //
          // `canonicalRefName` is the same normalizer the arcs use: an SA tag
          // names refNames in the BAM's own spelling, and a path whose segments
          // disagree with the view's refNames navigates nowhere.
          const chains = [...this.rawDataByGroup.values()].flatMap(byRegion =>
            computeReadChains(
              byRegion,
              this.loadedRegionInfos,
              this.canonicalRefName,
            ),
          )
          return computeDerivativePaths({ chains })
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
              groupKey,
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
          // Both below-coverage strips are reserved per lane: grouping routinely
          // leaves lanes with nothing bound for one (the 'Not split' lane of a
          // split-read grouping has no arc), and those carried an empty strip.
          // Empty when read-connections are off, so this costs nothing there.
          //
          // The band is reserved for INK, and a lane's ink can live entirely in
          // the cross-region overlay: an arc whose two feet are in different
          // displayed regions is held out of `arcsByGroup` on purpose
          // (`CrossRegionArc`), so a lane whose every arc crosses a seam — two
          // windows either side of a breakpoint, which is the view read
          // connections exist for — would reserve nothing and then have nowhere
          // to draw. `inkGroupKeys` is that question asked of the pass holding
          // both halves, which is this directory's `hasArcBandInk`-not-`numArcs`
          // rule met one level up.
          const arcInkLanes = self.arcsResult.inkGroupKeys
          const sashimiLanes = self.sashimiDownArcLanes
          const groups =
            order.length === 0
              ? // No data (or a grouped fetch over an empty region): the synthetic
                // section exists only so downstream getters see one section. It has
                // no laid-out rows by construction, hence maxY 0.
                [
                  {
                    key: '',
                    label: '',
                    maxY: 0,
                    hasArcs: false,
                    hasSashimiDownArcs: false,
                  },
                ]
              : order.map(({ key, label }) => ({
                  key,
                  label,
                  maxY: groupMaxYFor(key),
                  hasArcs: arcInkLanes.has(key),
                  hasSashimiDownArcs: sashimiLanes.has(key),
                }))
          return computeStackedSections(groups, {
            ...self.arcBandInput,
            rowHeight: self.rowHeight,
            showSashimiArcs: self.showSashimiArcs,
            sashimiHeight: self.sashimiArcsHeight,
            // Only when the chips are actually drawn — an ungrouped display
            // reserves nothing, so its geometry is untouched. `hasNamedGroups`
            // rather than the `showsGroupLabels` getter, which lives in a later
            // .views block; both read the same predicate so they can't drift.
            minSectionHeight: hasNamedGroups(self.groupOrder)
              ? GROUP_LABEL_HEIGHT
              : 0,
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
            // the arc-resize handle can anchor per group like coverage/pileup —
            // and whether this lane reserved that band at all, since a lane with
            // no arcs has none to resize.
            sashimiBandTop: sec.sashimiBandTop,
            hasArcsBand: sec.hasArcsBand,
            // The arcs' DRAW band, which is not the same question as
            // `hasArcsBand` (whether a strip was reserved): up-mode arcs
            // reserve nothing and draw over the coverage histogram. This is the
            // rect `buildSectionRenders` hands the renderers, in content space,
            // so the hover hit test measures against the band the arcs were
            // actually plotted into.
            arcBandTop: sec.arcBandTop,
            arcBandHeight: sec.arcBandHeight,
            arcDown: sec.arcDown,
            hasSashimiBand: sec.hasSashimiBand,
            pileupHeight: sec.pileupHeight,
            // The strip down to the next section, which is what the label chip
            // heads — see `Section.height`.
            height: sec.height,
          }))
        },

        /**
         * #getter
         * Per-section upload input, in stacking order: each section's laid-out
         * region map + arc feed, keyed by group so the renderers can namespace HAL
         * region keys per section.
         *
         * Both renderers pair the uploaded section `s` with the drawn section `s`
         * by INDEX (`sectionRegionKey(s, regionIdx)`), so this list and
         * `renderState.sections` must have the same length and order. Both now
         * derive from `sections`, making that structural — deriving this one from
         * `groupOrder` instead let the two disagree whenever `sections` synthesized
         * its no-data section (0 uploaded vs 1 drawn), which happens on an empty
         * grouped fetch. That mismatch was benign only because the per-section
         * region lookup missed and the draw skipped.
         */
        get sourceSections() {
          const arcsByGroup = self.arcsByGroup
          return this.renderSections.map(({ groupKey, laidOutPileupMap }) => ({
            groupKey,
            laidOutPileupMap,
            arcsRpcDataMap:
              arcsByGroup.get(groupKey) ?? new Map<number, ArcsUploadData>(),
          }))
        },

        /**
         * #getter
         * What the SVG connection overlay is responsible for drawing — see
         * `BezierArcScope`. Chain mode claims `crossRegion` even with the curved
         * connectors unticked, because it is the only pass that can join a
         * chain's two ends when they land in different displayed regions; the
         * per-region connecting line covers everything else.
         *
         * One getter rather than a check at each of the four consumers (the live
         * overlay, the SVG export, the legend, and the pair enumeration itself),
         * since a scope they disagreed on would draw a curve the key doesn't
         * name, or the reverse.
         */
        get bezierArcScope(): BezierArcScope {
          return self.showBezierConnections
            ? 'all'
            : self.isChainMode
              ? 'crossRegion'
              : 'none'
        },

        /**
         * #getter
         * Scroll/pan-invariant half of the bezier connection overlay: the linked
         * pairs of each section, resolved once per relayout. The read grouping +
         * connection resolution (`enumerateBezierPairs`) is the allocation-heavy
         * step; memoizing it here (this getter never reads `scrollTop`) keeps a
         * scroll frame down to the cheap per-pair screen projection in
         * `computePileupBezierArcsFromModel`. Narrowed by `bezierArcScope`, and
         * empty when that is `none`.
         */
        get bezierPairSections() {
          const scope = this.bezierArcScope
          return scope === 'none'
            ? []
            : this.renderSections.map(sec => ({
                topOffset: sec.topOffset,
                pileupHeight: sec.pileupHeight,
                pairs: enumerateBezierPairs(sec.laidOutPileupMap, scope),
              }))
        },

        /**
         * #getter
         * Connection types (LINKED_READ_COLOR_*) actually drawn as bezier/line
         * arcs in view, the input that lets the legend list only the connection
         * colors present. `bezierPairSections` is already narrowed to what the
         * overlay draws (`enumerateBezierPairs` applies the scope's own
         * predicate), so this scans the same list the curves come from rather
         * than re-deriving the skip rule beside it. Empty while the legend is
         * hidden so the scan is skipped.
         */
        get bezierConnectionColorTypes(): Set<number> {
          const present = new Set<number>()
          if (self.showLegend) {
            for (const sec of this.bezierPairSections) {
              for (const pair of sec.pairs) {
                present.add(pair.c.colorType)
              }
            }
          }
          return present
        },

        /**
         * #method
         * Legend swatches for the linked-read connection curves, empty unless the
         * overlay has something to draw (`bezierArcScope`) and at least one
         * connection is in view — including the cross-region connectors chain
         * mode draws without the curved-connector box ticked, since those are
         * colored by the same rules and a color on screen needs its key.
         */
        bezierLegendItems() {
          return bezierConnectionLegendItems(
            this.bezierConnectionColorTypes,
            self.colorPalette,
          )
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
        get sashimiArcSections(): SashimiArcSection[] {
          const view = self.lgv
          if (
            !self.showSashimiArcs ||
            !self.showCoverage ||
            !view.initialized
          ) {
            return []
          }
          const byGroup = self.rawDataByGroup
          const empty = new Map<number, PileupDataResult>()
          const noDownKeys: ReadonlySet<string> = new Set()
          const downKeys = self.sashimiDownKeysByGroup
          const bpToScreenX = makeBpToScreenX(view)
          return this.sections.sections.map(sec => {
            const arcs = computeSashimiArcs({
              rpcDataMap: byGroup.get(sec.groupKey) ?? empty,
              visibleRegions: view.visibleRegions,
              bpToScreenX,
              // Safe past the `view.initialized` gate above, which is the same
              // thing that makes the hosts' own `view.width` read safe — and it
              // is THEIR width: the overlay sizes its `<svg>` with it and the
              // export paints at `canvasWidth`, which `renderDisplaySvg`
              // resolves to `view.width` for every LGV display.
              viewWidthPx: view.width,
              coverageHeight: self.coverageHeight,
              sashimiArcsHeight: self.sashimiArcsHeight,
              minSashimiScore: self.minSashimiScore,
              downJunctionKeys: downKeys.get(sec.groupKey) ?? noDownKeys,
            })
            // Already ascending by score — `computeSashimiArcs` emits them that
            // way, and `computeOverlay.test.ts` pins it. The sort used to be
            // here, one call up from the array's producer, which is why it read
            // as missing to anyone looking at the producer.
            return {
              groupKey: sec.groupKey,
              ...splitArcsBySide(arcs),
              // Content-space band tops. Both consumers project them through
              // `bandScreenTop` — sticky when ungrouped, scrolled with the
              // section when grouped. That includes the SVG export, which since
              // it started honoring the display's scroll no longer reads them
              // as-is at scrollTop 0.
              coverageOverlayTop: sec.coverageTop + YSCALEBAR_LABEL_OFFSET,
              sashimiBandTop: sec.sashimiBandTop,
            }
          })
        },

        /**
         * #getter
         * What one row of this pileup is called, for UI text built from the
         * model alone (the group-label chips). The menu builders take the same
         * word as a call-site `noun` option. Subclasses that aren't showing
         * reads override it — LGVSyntenyDisplay draws PAF blocks, so its chips
         * must not offer to "show all reads".
         */
        get featureNoun() {
          return 'read'
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
         * Whether the stacked section labels + dividers are drawn. Deliberately
         * NOT `isGrouped`: grouping that happens to yield one section (a region
         * with reads on one strand, a tag with a single value) still reserves the
         * label offset (`prefersOffset`) and still wants its section named and
         * collapsible — otherwise it reads as an ungrouped track with mysterious
         * blank space above it. `isGrouped` stays about the scroll model (>1
         * section scrolls coverage with its section), which one section doesn't
         * change. Reads the fetched sections rather than `groupBy` — see
         * `hasNamedGroups` for why the setting is the wrong signal.
         */
        get showsGroupLabels() {
          return hasNamedGroups(self.groupOrder)
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
         * HeightModeMixin's grow hook: the full laid-out content height
         * (coverage + pileup + arcs), before the `growMaxHeight` cap. Independent
         * of `self.height` — `laidOutByGroup` fits to `growMaxHeight` in grow
         * mode (not the reactive `height`), and `featureHeight` is the configured
         * value there rather than the fitted pitch — which is what lets the
         * mixin's `height` return it without cycling. `grownHeight`, the `height`
         * override and the grow-aware `resizeHeight` all come from the mixin.
         */
        get growTargetHeight() {
          return this.sections.contentHeight
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
          const view = self.lgv
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
         * #getter
         * Read ids of the hovered chain's members, empty unless in chain mode.
         * Single source for the "is this a chain highlight" decision that both
         * `highlightBoxes` (which ids to box) and `HighlightOverlay` (how
         * strongly to shade them) read, so the two can't drift.
         */
        get highlightChainReadIds() {
          return self.isChainMode ? self.highlightedChainReadIds : []
        },

        /**
         * #getter
         * Screen boxes for the hovered read / chain, painted by the
         * `HighlightOverlay` div. Deliberately NOT part of `renderState`: the
         * hovered id changes on nearly every mousemove, and routing it through
         * the canvas would repaint the whole pileup each move.
         */
        get highlightBoxes() {
          const view = self.lgv
          const chainReadIds = this.highlightChainReadIds
          const ids =
            chainReadIds.length > 0
              ? chainReadIds
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
         * Content-space Y of a group's pileup relative to the reserved
         * below-coverage height, i.e. how far a read's row shifts because its
         * group is stacked below the others. 0 for the ungrouped/first section,
         * except when that lane drops its arc band (`hasArcs` false), where it
         * goes slightly negative — callers add `coverageDisplayHeight` back, so
         * the sum is the section's real `pileupTop` either way.
         */
        groupPileupOffset(groupKey: string) {
          const section = this.sections.sections.find(
            s => s.groupKey === groupKey,
          )
          return section === undefined
            ? 0
            : section.pileupTop - self.coverageDisplayHeight
        },

        /**
         * #method
         * Layout rect of a read, for cross-view overlays (BreakpointSplitView's
         * connection curves). Y is relative to the pileup's own top — the caller
         * adds the display's `coverageDisplayHeight` itself (see `computeOverlayY`)
         * — so a grouped read only needs its section's extra stacking offset on
         * top of its row. Without that offset every read outside the first section
         * anchored as if it were in the first one.
         */
        searchFeatureByID(
          featureId: string,
        ): [number, number, number, number] | undefined {
          const hit = self.findFeatureInRpcData(featureId)
          if (!hit) {
            return undefined
          }
          const { rpcData, idx, start, end, groupKey } = hit
          const yRow = rpcData.readYs[idx]
          if (yRow === undefined) {
            return undefined
          }
          const top = this.groupPileupOffset(groupKey) + yRow * self.rowHeight
          return [start, top, end, top + self.featureHeight]
        },

        /**
         * #method
         * Read ids sharing a chain with the read at `index` in `rpcData` — the
         * read's own included, since it is a member of its chain. Empty when the
         * read isn't part of a chain. Shared by hover-highlight and click-select
         * so the two paths can't drift.
         */
        readIdsSharingChain(rpcData: PileupDataResult, index: number) {
          const { readChainIndices, chainNames } = rpcData
          const chainIdx = readChainIndices?.[index]
          const name =
            chainIdx === undefined ? undefined : chainNames?.[chainIdx]
          return name === undefined
            ? []
            : (self.readIdsByChainName.get(name) ?? [])
        },

        // refName/assemblyName come from `loadedRegions` (the region this read
        // was actually fetched from) rather than from `view.displayedRegions`,
        // which needs a sentinel for a since-changed index and carries no
        // assembly, leaving `fetchFeatureDetails` to re-find one by refName.
        getFeatureInfoById(featureId: string) {
          const hit = self.findFeatureInRpcData(featureId)
          const region = hit && self.loadedRegions.get(hit.displayedRegionIndex)
          if (!hit || !region) {
            return undefined
          }
          const { idx, rpcData, start, end } = hit
          return {
            id: featureId,
            name: readNameAt(rpcData, idx),
            start,
            end,
            flags: rpcData.readFlags[idx],
            mapq: rpcData.readMapqs[idx],
            // The worker's own normalized strand, not a re-derivation from
            // SAM_FLAG_REVERSE. Identical for BAM/CRAM (whose `strand` IS that
            // flag), but a PAF/synteny block carries a real strand and no flags
            // at all — so the flag read reported every reverse-strand block as
            // `(+)` in the hover tooltip and in `hoveredFeature`. Same
            // reasoning as `strandKey` in shared/groupFeatures.ts.
            strand: rpcData.readStrands[idx] ?? 1,
            refName: region.refName,
            assemblyName: region.assemblyName,
          }
        },

        /**
         * #getter
         * Names one read color bucket for the hover, with the active scheme's
         * rewording already applied — the same `readCategoryLabelOverrides` the
         * legend box uses, so the tooltip and the swatch it sends the reader to
         * cannot say different things about one color.
         */
        get readCategoryLabel() {
          const overrides = readCategoryLabelOverrides(
            self.colorBy,
            framesUnpairedChainStrand(
              colorSchemeIndexFor(self.colorBy.type),
              self.readColorOpts,
            ),
          )
          return (c: ReadColorCategory) => readColorCategoryLabel(c, overrides)
        },
      }))
      .views(() => {
        // Per display instance, and deliberately NOT volatile: the only caller
        // is `crossRegionArcSections`, a computed getter that re-runs on every
        // pan frame, and writing to an observable from inside a computed is a
        // loop. A plain closure Map is invisible to MobX and dies with the
        // display — which a module-level map keyed by display id did not,
        // holding an entry for every display that ever hit the cap for as long
        // as the tab lived.
        const reportedCaps = new Map<string, number>()
        return {
          /**
           * #method
           * Warn that a lane's cross-region arcs were capped — once per NUMBER
           * rather than once per evaluation. `crossRegionArcSections` re-projects
           * every foot through `view.bpToPx`, so it reads `view.offsetPx` and
           * MobX re-evaluates it on every pan frame; that is correct and
           * necessary, but a bare `console.warn` in there fires per frame for as
           * long as a capped lane is on screen, which is a console nobody can
           * read anything else in.
           */
          reportArcCap(groupKey: string, dropped: number, kept: number) {
            if (reportedCaps.get(groupKey) !== dropped) {
              reportedCaps.set(groupKey, dropped)
              console.warn(
                `cross-region arcs: drawing the ${kept} best-supported of ${kept + dropped} in lane "${groupKey}"; turn off concordant-pair arcs to thin them`,
              )
            }
          },
        }
      })
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
            showCoverage: self.showCoverage,
            coverageHeight: self.coverageHeight,
            coverageYOffset: YSCALEBAR_LABEL_OFFSET,
            coverageMinDepth: self.coverageDepthDomain?.[0],
            coverageMaxDepth: self.coverageDepthDomain?.[1],
            coverageIsLog: self.coverageIsLog,
            coverageSnpMinFrequency: self.coverageSnpMinFrequency,
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
            // the mixin's resolved canvas box — see `canvasWidthPx` for why
            // this is not `view.width` and what SVG export does instead
            canvasWidth: self.canvasWidthPx,
            canvasHeight: self.height,
            selectedFeatureId: self.selectedFeatureId,
            // Chain selection is only valid in chain mode. Gating here makes a
            // stale selection unrenderable outside it by construction — render
            // correctness no longer depends on any clear-on-transition. The
            // renderers draw on `length > 0` with no
            // mode check, so this is the one place the invariant must hold.
            // (Hover highlight lives in `highlightBoxes` / `HighlightOverlay`,
            // not here, so a hover never triggers a canvas repaint.)
            selectedChainReadIds: self.isChainMode
              ? self.selectedChainReadIds
              : [],
            colors: palette,
            chainMode: self.isChainMode,
            showLinkedReadLines: self.showLinkedReadLines,
            collapseGroupRows: self.collapseGroupRows,
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
          // Maxed across every group and both halves by `computeArcsByGroup`, so
          // all sections share one Y-domain (the same comparability trick
          // coverage uses with coverageMaxDepth) and an arc that moved to the
          // overlay still sizes the axis it is plotted on. Ungrouped has one
          // group, so this reduces to the prior single-group max.
          //
          // The largest INSERT SIZE, not the largest drawn Y —
          // `insertSizeTickSections` labels its top tick with this number, so a
          // domain carrying the cloud's ±8% jitter printed a template length no
          // read has.
          return Math.max(1000, self.arcsResult.maxFlatArcSpanBp)
        },

        /**
         * #getter
         * The read cloud's insert-size ruler, ONE PER SECTION that reserves an
         * arc band, in stacking order. Empty outside read-cloud mode, which is
         * the only mode that puts |TLEN| on the band's Y axis.
         *
         * Per section for the same reason `CoverageScaleBars` is: arc strips are
         * reserved per section, so a grouped read cloud has N bands and a single
         * ruler can only sit beside one of them. It sat beside the first — the
         * values were right for every lane, since `arcsYDomainBp` is pooled
         * across groups, but every lane below the first had a plotted axis and
         * nothing labelling it.
         *
         * The band comes off `renderSections`, which carries `computeArcBand`'s
         * answer already placed at the section's own `coverageTop`, rather than
         * from a second `computeArcBand(self.arcBandInput)` call that could only
         * describe a section-relative band. So the tick `y`s are absolute CONTENT
         * y, and the one `bandScreenTop(0, …)` shift both hosts already apply
         * completes the projection — `bandScreenTop` being linear in its
         * argument, that is exactly `bandScreenTop(sec.arcBandTop, …)`.
         */
        get insertSizeTickSections() {
          const arcsYDomainBp = this.arcsYDomainBp
          if (arcsYDomainBp === undefined) {
            return []
          }
          return self.renderSections.flatMap(sec => {
            // A lane whose reads produced no arc reserves no band, so it gets no
            // ruler — the same gate the renderers use to skip the pass.
            const ticks =
              sec.arcBandHeight > 0
                ? computeInsertSizeTicks({
                    band: {
                      top: sec.arcBandTop,
                      height: sec.arcBandHeight,
                      down: sec.arcDown,
                    },
                    arcsYDomainBp,
                  })
                : undefined
            return ticks ? [{ groupKey: sec.groupKey, ticks }] : []
          })
        },

        /**
         * #getter
         * Per-section geometry for the arcs no per-region pass can draw — the
         * ones whose two feet are in different displayed regions
         * (`CrossRegionArc`). Band-local, like sashimi's: the overlay and the
         * SVG export each place the box at `bandScreenTop(bandTop, …)`, so this
         * does not depend on `scrollTop` and MobX replays it while a grouped
         * track scrolls.
         *
         * Empty in the single-region view, which is almost every view — the
         * partition upstream returns nothing there, so this costs one Map lookup
         * per section.
         */
        get crossRegionArcSections() {
          const view = self.lgv
          if (self.readConnections === 'off' || !view.initialized) {
            return []
          }
          const byGroup = self.crossRegionArcsByGroup
          const bpToScreenX = makeBpToScreenX(view)
          // Read once per resolve rather than per foot: the breakend feet need
          // it for both of their endpoints and this getter re-runs on every pan
          // frame, where `displayedRegions[i]` is a MobX array read.
          const reversedByRegion = view.displayedRegions.map(r => !!r.reversed)
          const pxPerBp = view.bpPerPx > 0 ? 1 / view.bpPerPx : 0
          return self.renderSections.flatMap(sec => {
            const arcs = byGroup.get(sec.groupKey)
            // A lane with no cross-region arcs reserves nothing and renders
            // nothing — the same gate the per-region passes use to skip.
            if (!arcs?.length || sec.arcBandHeight <= 0) {
              return []
            }
            const { domainBp, log } = arcYScale(
              this.arcsYDomainBp,
              arcAvailH(sec.arcBandHeight),
              pxPerBp,
            )
            return [
              {
                groupKey: sec.groupKey,
                bandTop: sec.arcBandTop,
                bandHeight: sec.arcBandHeight,
                arcs: computeCrossRegionArcs({
                  arcs,
                  bpToScreenX,
                  frame: {
                    arcsYDomainBp: domainBp,
                    arcsYLog: log,
                    // Band-local, so the host places the box rather than the
                    // path carrying the section's offset.
                    arcsTop: 0,
                    arcsH: sec.arcBandHeight,
                    pairedArcsDown: sec.arcDown,
                    // The VIEW's width — see `ComputeCrossRegionArcsOpts`, which
                    // says why this is the one consumer that must not use a
                    // block's.
                    screenWidthPx: view.width,
                  },
                  regionReversed: i => reversedByRegion[i] ?? false,
                  lineWidth: self.readConnectionsLineWidth,
                  colors: self.colorPalette,
                  // Said out loud rather than dropped silently, which is this
                  // repo's rule for a cap — but once per NUMBER, not once per
                  // evaluation: this getter re-runs on every pan frame, so see
                  // `reportArcCap`.
                  onCapped: (dropped, kept) => {
                    self.reportArcCap(sec.groupKey, dropped, kept)
                  },
                }),
              },
            ]
          })
        },
      }))
      .views(self => ({
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
        //
        // Lives in its own views block, after every field it reads, so it can
        // read them off `self`: a subclass overriding it captures the base as a
        // bare function (LGVSyntenyDisplay), which would lose a `this`.
        /**
         * #method
         */
        rpcProps() {
          return {
            filterBy: self.filterBy,
            // Only the part the worker reads, so switching between the schemes
            // the shader decides on its own (strand, mapq, insert size, pair
            // orientation …) leaves these props identical and repaints from the
            // data already in memory instead of refetching the region.
            colorBy: workerColorBy(self.colorBy),
            // Both mirror what `executeRenderAlignmentData` does with them in
            // chain mode — it forces soft clipping off and drops the sort tag —
            // so that the cache key names the fetch the worker will actually
            // perform. Sending the raw values instead made two settings that
            // cannot reach chain output invalidate every fetched region anyway:
            // "Show soft clipping" is a live checkbox in chain mode, so each
            // click dropped `rpcDataMap` and re-read the region to receive
            // byte-identical data, and a `sortedBy` carried in from before the
            // mode was entered kept a tag name in the key that only ever
            // extracted `sortTagValues` nothing reads (see `canSortReads`).
            sortTag: self.isChainMode ? undefined : self.sortTag,
            groupBy: self.groupBy,
            showSoftClipping: self.isChainMode ? false : self.showSoftClipping,
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
            // `readConnections` is deliberately NOT here. It was, briefly, to
            // let the worker skip the per-read SA tag walk with connections
            // off — but `derivativePathCandidates` reads the same chains and is
            // ungated by design, so the skip silently emptied the
            // "Reconstruct derivative allele" dialog on the default fetch. The
            // walk is unconditional again (`extractFeatureArrays` has the
            // measurements), which puts connections back where the rest of the
            // arc settings already are: a draw setting that repaints from data
            // already in memory.
            // Detail tier, for adapters that serve more than one (the tiered PIF
            // adapters behind LGVSyntenyDisplay, which overrides this to resolve
            // it). Declared here — undefined meaning "whatever the adapter picks"
            // — so every consumer of the props bag, notably the feature-details
            // fetch, can read the tier without knowing which subclass set it.
            lodMode: undefined as BaseOptions['lodMode'],
          }
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
      .views(self => ({
        /**
         * #getter
         * The legal range for any of the three drag-resizable bands stacked over
         * the pileup (coverage, read connections, sashimi).
         *
         * The ceiling is what makes the drag recoverable. `pileupViewportHeight`
         * floors at 0, so without one a band dragged past the display height
         * squashes the pileup to nothing *and* carries its own resize handle off
         * the bottom edge — leaving no way back except growing the track. Each
         * band is bounded against the display height individually; three of them
         * dragged large can still crowd the pileup, but every one of them stays
         * reachable, which is the property the user needs.
         */
        get resizableBandBounds() {
          return {
            max: Math.max(MIN_BAND_HEIGHT, self.height - MIN_BAND_HEIGHT),
          }
        },
      }))
      .actions(self => {
        const superSetError = self.setError
        const superSetHeightMode = self.setHeightMode
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
          self.hoveredArcHighlight = undefined
          if (self.highlightedChainReadIds.length > 0) {
            self.highlightedChainReadIds = []
          }
        }
        // Sashimi only renders over the coverage band, so the two settings are
        // tied in both directions. Kept here, not in the menu handlers, so the
        // invariant holds for every caller.
        function setShowSashimiArcs(show: boolean) {
          setConf(self, 'showSashimiArcs', show)
          if (show) {
            setConf(self, 'showCoverage', true)
          }
        }
        /**
         * #action
         * The other half of the sashimi/coverage tie. Without it, hiding coverage
         * left "Show sashimi arcs" ticked over a display drawing none — and the
         * worker skips the junction scan entirely when the band is off
         * (`runCoveragePipeline`), so the arcs the checkbox advertised had no
         * data behind them either.
         */
        function setShowCoverage(show: boolean) {
          setConf(self, 'showCoverage', show)
          if (!show) {
            setConf(self, 'showSashimiArcs', false)
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
          clearSelection() {
            const session = getSession(self)
            if (isFeature(session.selection)) {
              session.clearSelection()
            }
            if (self.selectedChainReadIds.length > 0) {
              self.selectedChainReadIds = []
            }
          },

          /**
           * #action
           */
          setSelectedChainReadIds(ids: string[]) {
            self.selectedChainReadIds = ids
          },

          /**
           * #action
           */
          setColorScheme(colorBy: ColorBy) {
            const current = self.colorBy
            // colorTagMap holds discovered values for whichever CPU-baked
            // scheme is active, so it only goes stale when that scheme (or the
            // tag it reads) changes. Re-picking the scheme already showing must
            // not clear it: setConf writes the same value, so nothing refetches
            // and the emptied map would leave the legend blank until the next
            // pan.
            const sameValues =
              colorBy.type === current.type &&
              (colorBy.type !== 'tag' || colorBy.tag === current.tag)
            if (!sameValues) {
              self.colorTagMap = {}
            }
            setConf(self, 'colorBy', colorBy)
          },

          /**
           * #action
           */
          updateColorTagMap(uniqueTag: string[]) {
            const { map, added } =
              self.colorBy.type === 'mateRefName'
                ? updateQueryNameColorMap(self.colorTagMap, uniqueTag)
                : updateColorTagMapPure(self.colorTagMap, uniqueTag)
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
            setConf(self, 'filterBy', filterBy)
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
            const view = self.lgv
            const { centerLineInfo } = view
            // basePair / insertion / softclip / hardclip / tag use sortPos
            // to pick which reads to sort first; position / strand ignore
            // it and produce a sensible layout without a center line.
            const needsPos = type !== 'position' && type !== 'strand'
            if (centerLineInfo && centerLineInfo.offset >= 0) {
              this.setSortSlot({
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
                this.setSortSlot({
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
           * Commit a sort, the single place the `sortedBy` slot is written. Also
           * drops `largeFeaturesFirst`: the two are peer radios in one group
           * ("Longest reads first" is the layout-order flag, a sort is the slot),
           * so exactly one must hold state. Doing it here rather than at the menu
           * means a sort that *doesn't* land — no valid center line, a cancelled
           * tag dialog — leaves the previous ordering intact instead of silently
           * clearing it and unchecking every radio. `computeMultiRegionLayout`
           * would tolerate both being set (an explicit sort wins there anyway);
           * this keeps the menu's checkmarks honest.
           */
          setSortSlot(sortedBy: {
            type: string
            pos: number
            refName: string
            assemblyName: string
            tag?: string
          }) {
            setConf(self, 'largeFeaturesFirst', false)
            setConf(self, 'sortedBy', sortedBy)
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
            const view = self.lgv
            const assemblyName = view.assemblyNames[0]
            if (assemblyName) {
              this.setSortSlot({ type, pos, refName, assemblyName, tag })
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
            setConf(self, 'sortedBy', null)
          },

          /**
           * #action
           */
          setLargeFeaturesFirst(flag: boolean) {
            setConf(self, 'largeFeaturesFirst', flag)
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
            setConf(self, 'groupBy', groupBy ?? null)
            self.collapsedGroups.clear()
            self.groupMaxHeightOverrides.clear()
            self.scrollTop = 0
          },

          /**
           * #action
           * Draw each group as one row (overlap depth shows as tint shading)
           * rather than as its own stack. Clears the per-group height overrides:
           * an override means "this lane opted out of the collapse", which is
           * meaningless once every lane is a stack again.
           */
          setCollapseGroupRows(flag: boolean) {
            setConf(self, 'collapseGroupRows', flag)
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
           * Set the per-read pixel size. The track-sizing mode is a mostly
           * independent axis (changed via setHeightMode): grow keeps growing at
           * the new size. Fit is the exception — it derives the size, so a chosen
           * size would be dormant; picking one drops back to fixed so the pick
           * takes effect.
           */
          setFeatureHeight(height?: number) {
            if (self.fitHeightToDisplay) {
              setConf(self, 'heightMode', 'fixed')
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
           * that HeightModeMixin can't know about. The slot write and the scroll
           * reset are its `setHeightMode`, captured as super above.
           */
          setHeightMode(mode: HeightMode) {
            superSetHeightMode(mode)
            // Per-group height overrides are a drag opting one lane out of a
            // uniform fit/grow, so they go with the mode flip. Tied to the
            // explicit user action: a track that merely inherits the mode from a
            // session-wide default keeps its overrides.
            if (mode !== 'fixed') {
              self.groupMaxHeightOverrides.clear()
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

          setShowCoverage,

          /**
           * #action
           */
          setReadConnections(mode: ReadConnectionsMode) {
            setConf(self, 'readConnections', mode)
          },

          /**
           * #action
           */
          // Shared below-coverage band orientation for both read-connection
          // arcs and sashimi arcs. Single source of truth — there is no
          // per-feature direction to keep in sync.
          setReadConnectionsDown(down: boolean) {
            setConf(self, 'readConnectionsDown', down)
          },

          /**
           * #action
           */
          setDebugArcGeometry(on: boolean) {
            self.debugArcGeometry = on
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
          setReadConnectionsLineWidth(width: number) {
            setConf(self, 'readConnectionsLineWidth', width)
          },

          /**
           * #action
           */
          setDrawInter(draw: boolean) {
            setConf(self, 'drawInter', draw)
          },

          /**
           * #action
           */
          setDrawProperPairArcs(draw: boolean) {
            setConf(self, 'drawProperPairArcs', draw)
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
          setDrawLongRange(draw: boolean) {
            setConf(self, 'drawLongRange', draw)
          },

          /**
           * #action
           */
          setArcColorByType(type: ArcColorByType) {
            setConf(self, 'arcColorByType', type)
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
          setShowLegend(show: boolean | undefined) {
            setConf(self, 'showLegend', show)
          },

          /**
           * #action
           */
          setDrawSingletons(flag: boolean) {
            setConf(self, 'drawSingletons', flag)
          },

          /**
           * #action
           */
          setDrawProperPairs(flag: boolean) {
            setConf(self, 'drawProperPairs', flag)
          },

          /**
           * #action
           */
          setShowOnlySplitAlignments(flag: boolean) {
            setConf(self, 'showOnlySplitAlignments', flag)
          },

          /**
           * #action
           */
          setShowInterbaseIndicators(show: boolean) {
            setConf(self, 'showInterbaseIndicators', show)
          },

          /**
           * #action
           */
          setFlipStrandLongReadChains(flag: boolean) {
            setConf(self, 'flipStrandLongReadChains', flag)
          },

          /**
           * #action
           */
          setColorSupplementaryChains(flag: boolean) {
            setConf(self, 'colorSupplementaryChains', flag)
          },

          /**
           * #action
           */
          setLinkedReads(mode: LinkedReadsMode) {
            const prev = self.linkedReads
            setConf(self, 'linkedReads', mode)
            // `LINKED_READS_MODES` is a two-member enum, so this is the whole of
            // "the mode changed". The two separate guards this replaces —
            // leaving 'normal', and crossing 'off' — were written when a third
            // member ('bezier', now the orthogonal `showBezierConnections` flag)
            // made them distinct questions, and both reduce to this one.
            if (prev === mode) {
              return
            }
            // Forget chain hover (clearMouseoverState) and selection. A product
            // choice — selection doesn't survive a mode change — not a
            // render-safety mechanism: `renderState` already gates chain
            // highlights on `isChainMode`, so stale IDs can't render regardless.
            clearMouseoverState()
            if (self.selectedChainReadIds.length > 0) {
              self.selectedChainReadIds = []
            }
            const currentType = self.colorBy.type
            if (mode === 'off') {
              // Leaving pairs: pairing-only schemes no longer have meaning, so
              // reset colorBy back to inherit — falling back to the
              // session-wide color default, else the `normal` promotedBase.
              // This cleanly undoes the enter-pairs customization rather than
              // customizing `normal` over a default. Explicit non-pairing choices (tag,
              // methylation, base quality, ...) are preserved by the gate.
              if (PAIRING_COLOR_SCHEMES.has(currentType)) {
                setConf(self, 'colorBy', undefined)
              }
            } else if (currentType === 'normal') {
              // Entering pairs: nudge the plain default to the SV-signal
              // scheme, but don't clobber a scheme the user explicitly picked.
              setConf(self, 'colorBy', {
                type: 'insertSizeAndOrientation',
              })
            }
            // No explicit invalidation here: `linkedReads` is an `rpcProps()`
            // key, so `SettingsInvalidate` runs `clearAllRpcData` when this
            // action ends.
          },

          /**
           * #action
           * Toggle the paired-read connection overlay. A main-thread tier-2/4
           * setting (read in `laidOutPileupMap` + `renderState`), not in
           * `rpcProps` — toggling it never refetches.
           */
          setShowBezierConnections(flag: boolean) {
            setConf(self, 'showBezierConnections', flag)
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
           * The whole hover state in one action. Every branch of the pileup's
           * mousemove handler goes through here — including the plain-read
           * branch, which used to fire three or four separate setters per move
           * and was the only one that left `hoverCoverageBand` stale.
           * `highlightedChainReadIds` is empty outside chain mode.
           */
          setHoverState(state: {
            overCigarItem: boolean
            featureIdUnderMouse: string | undefined
            mouseoverExtraInformation: TooltipPayload | undefined
            hoverCoverageBand?: { topOffset: number; coverageHeight: number }
            // Optional and ALWAYS assigned, like `hoverCoverageBand`: a branch
            // with no arc to name clears the highlight by not mentioning one,
            // which is the property this single action exists to give.
            hoveredArcHighlight?: ArcHighlight
            highlightedChainReadIds: string[]
          }) {
            self.overCigarItem = state.overCigarItem
            self.featureIdUnderMouse = state.featureIdUnderMouse
            self.mouseoverExtraInformation = state.mouseoverExtraInformation
            self.hoverCoverageBand = state.hoverCoverageBand
            self.hoveredArcHighlight = state.hoveredArcHighlight
            // Write only on a real change. Assigning an equal array still
            // replaces the MST node, which invalidates `highlightBoxes` — an
            // O(reads) rebuild — so dragging the cursor along one chain would
            // recompute every box on every mousemove. MobX already skips the
            // no-op writes above, since those are primitives.
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
           * `openContextMenu` boxes the read the menu acts on and
           * `handleMouseLeave` holds that box while the menu is up, so this is
           * the only place the pin comes off — without it the box outlives the
           * menu until the cursor next crosses the pileup, which it need not do
           * at all when the item clicked opened a drawer widget. Mirrors canvas
           * LinearBasicDisplay.closeContextMenu.
           */
          closeContextMenu() {
            self.contextMenuAnchor = undefined
            self.contextMenuFeature = undefined
            self.contextMenuFeatureId = undefined
            self.contextMenuHit = undefined
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
          self.attachRenderingBackend<AlignmentsRenderingBackend>(backend, {
            upload: b => {
              b.sync({
                sections: self.sourceSections,
                // Read inside the upload autorun, not lifted into an action:
                // arc instances are packed at this width (arcLineWidth ×
                // support), so a change to it has to reach the pack.
                readConnectionsLineWidth: self.readConnectionsLineWidth,
              })
            },
            // size === 0 keeps first paint gated until data arrives, so the
            // loading overlay stays up (canvasDrawn stays false); an empty but
            // loaded region has size > 0 and paints an empty pileup. Keyed on the
            // per-REGION map, not on a group's laid-out map: a grouped fetch over a
            // region with no reads partitions to zero groups, so the first group's
            // map is empty even though the fetch is done — gating on that left the
            // loading overlay up forever (and hung any test waiting on first paint).
            render: b =>
              self.rpcDataMap.size === 0
                ? false
                : b.renderBlocks(self.renderBlocks, self.renderState),
          })
        },
      }))
      .actions(self => {
        // The one place a feature is resolved from an id. Menu items are offered
        // from the id alone (which the hit test knows synchronously) and land
        // here on click; opening the menu pre-warms `contextMenuFeature` through
        // the same call, so a click is normally already resolved.
        //
        // `onMiss` is passed at every call because an empty result means
        // different things to the two callers: the id came from the hit test, so
        // nothing coming back means the lookup itself failed (data evicted under
        // it, or a tier whose ids don't compare). A user-initiated item must say
        // so — silently doing nothing is the worst answer to a click — while the
        // speculative pre-warm stays quiet, since the user asked for nothing and
        // the menu just doesn't grow its feature items.
        //
        // This is `withFeatureDetails` bound to this display's own fetch: what
        // the pileup adds is only the read's region, resolved off the read
        // itself rather than a displayed-region index (see fetchFeatureDetails).
        // The three outcomes and what each does are the shared function's.
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
        // The default `withFeatureDetails` would apply anyway; named here
        // because the pre-warm below passes the OTHER answer, and a bare
        // omission would not read as a decision.
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
           * and whichever mark answered arrive as one `ContextMenuHit`, which is
           * how a consumer is stopped from reading a block without its hit (the
           * split-state class of bug that silently no-op'd position sorts). The
           * read feature is reset now and, when the hit carries one, populated by
           * an async RPC fetch — so "open the menu for this hit and its read"
           * stays a single call and a repositioned menu can't inherit the prior
           * read's items.
           *
           * Dropping the hover is part of opening, not a step the caller does
           * first: the tooltip must go, but the highlight box has to survive as
           * a pin on the menu's own read, and that is a clear-then-re-box order
           * no call site should have to know (or get right in a second one).
           */
          openContextMenu(args: {
            anchor: ContextMenuAnchor
            hit?: ContextMenuHit
            featureId?: string
          }) {
            self.clearMouseoverState()
            self.contextMenuAnchor = args.anchor
            self.contextMenuHit = args.hit
            self.contextMenuFeature = undefined
            self.contextMenuFeatureId = args.featureId
            // Pin the hover to the menu's target read so its highlight box
            // (highlightBoxes, keyed on featureIdUnderMouse) stays on while the
            // menu is open — the clear above dropped the tooltip, so this
            // re-boxes just the read the menu acts on. Undefined for
            // coverage/indicator hits, which have no read to box. Mirrors canvas
            // LinearBasicDisplay.openContextMenu.
            self.featureIdUnderMouse = args.featureId
            const { featureId } = args
            if (featureId !== undefined) {
              void withFeature(
                featureId,
                feat => {
                  // Only if the menu is still open over the read this fetch was
                  // for. A second right-click repositions the menu without
                  // closing it, and two lookups are then in flight: if the first
                  // resolves last it would otherwise publish the previous read's
                  // feature under the current read's menu, and the items built
                  // from it would act on the wrong read.
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
        // One RPC for both pileup and chain modes; the worker branches on
        // `linkedReads` (passed via rpcProps).
        function fetchFeaturesForRegion(
          adapterConfig: Record<string, unknown>,
          region: Region,
          ctx: FetchContext,
        ) {
          const session = getSession(self)
          const sequenceAdapter = getSequenceAdapter(session, region)
          const sessionId = getRpcSessionId(self)
          return session.rpcManager.call(sessionId, 'RenderAlignmentData', {
            adapterConfig,
            sequenceAdapter,
            regions: [region],
            ...self.rpcProps(),
            stopToken: ctx.stopToken,
            // this region's slot on the fetch's fan-out, so the N parallel
            // collapsed-intron fetches aggregate into one bar instead of
            // clobbering each other's progress text
            statusCallback: ctx.statusCallback,
          })
        }

        return {
          /**
           * #action
           */
          async fetchNeeded(
            needed: { region: Region; displayedRegionIndex: number }[],
          ) {
            await self.fetchRegions(needed, async (ctx: FetchContext) => {
              // `callEachRegion` rather than `fetchEachRegion`: the tag-map
              // union below is a cross-region decision, so this guards once
              // around the whole batch instead of per region.
              const results = await callEachRegion(needed, ctx, (region, c) =>
                fetchFeaturesForRegion(self.adapterConfig, region, c),
              )
              if (ctx.isStale()) {
                return
              }

              const newDataMap = new Map<number, GroupedAlignmentsResult>()
              self.setModificationsReady(true)
              for (const r of results) {
                newDataMap.set(r.displayedRegionIndex, r.result)
              }
              // newTagValues are discovered per group; union across every group
              // of every region so colorTagMap covers each section's reads —
              // and so this is ONE action. Called per region it was one action
              // per region, and each one assigns colorTagMap, which invalidates
              // laidOutByGroup and rebakes the read colors of every region
              // already loaded. A pan that turned up new values in three
              // regions paid that three times.
              const tagValues = results.flatMap(r =>
                r.result.groups.flatMap(g => g.data.newTagValues ?? []),
              )
              if (tagValues.length > 0) {
                self.updateColorTagMap(tagValues)
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
      .views(() => ({
        // #region byteGate
        /**
         * #getter
         * Opt into RegionTooLargeMixin's byte gate: `fetchRegions` measures the
         * region set with `CoreGetRegionByteEstimate` before downloading reads.
         */
        get measuresBytesPreFlight() {
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
                      current: self.arcColorByType,
                      setColor: (type: ArcColorByType) => {
                        self.setArcColorByType(type)
                      },
                    },
              supplementaryColoring: {
                isChainMode: self.isChainMode,
                flipStrandLongReadChains: self.flipStrandLongReadChains,
                setFlipStrandLongReadChains: (flag: boolean) => {
                  self.setFlipStrandLongReadChains(flag)
                },
                colorSupplementaryChains: self.colorSupplementaryChains,
                setColorSupplementaryChains: (flag: boolean) => {
                  self.setColorSupplementaryChains(flag)
                },
              },
              pin: (colorBy: ColorBy) => makePin(self, 'colorBy', colorBy),
            }),
            // Both reasons an ordering can't take effect live in
            // `canSortReads`; only the copy naming the one in force is here.
            getSortByMenuItem(self, {
              disabled: !self.canSortReads,
              disabledHelpText: self.isChainMode
                ? 'Chain rows are ordered by chain — turn off "View as pairs / link supplementary alignments" to sort reads'
                : 'Turn on "Show pileup" to sort reads',
            }),
            ...getFiltersMenuItems(self),
            getGroupByMenuItem(self),
            ...getReadsMenuItems(self),
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
          // Same gate as the track menu's "Sort by...": these write the same
          // slot, so they can't be offered where it is ignored.
          return getContextMenuItems(self, { sort: self.canSortReads })
        },
      }))
      // The derived, self-releasing too-large banner is opt-in via
      // `measuresBytesPreFlight` above: `fetchRegions` measures the region set
      // before it downloads and afterAttach clears the estimate on chromosome
      // nav. Byte-only — no density axis. The hover is dropped on the flip by
      // `installClearHoverOnViewportChange`, along with the three viewport axes.
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
         * Fills `BaseDisplay`'s hover-clear hook, which the fetch
         * foundation's reaction calls on every viewport change.
         *
         * The pileup is a sticky canvas, so a pan, a zoom or an internal
         * scroll under a stationary cursor fires no mousemove and no
         * mouseleave, and the highlight box and tooltip go on naming the read
         * that *was* there.
         */
        clearHoveredFeature() {
          self.clearMouseoverState()
        },

        afterAttach() {
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
          addDisposer(self, installGrowExitBake(self, self.lgv))

          // The scroll clamp (the shrink autorun and the bound on setScrollTop)
          // is TrackHeightMixin's, earned by overriding `scrollableHeight`.

          // Drop a lingering hover tooltip/highlight whenever the content moves
          // under a stationary cursor. Shared with the canvas display: see
          // installClearHoverOnViewportChange for why zoom is not the only axis.
        },
      }))
  )
}

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
