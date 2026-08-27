import { lazy } from 'react'

import {
  computeCoverageTicks,
  coverageDepthDomain,
  computeVisibleCoverageStats,
} from '@jbrowse/alignments-core'
import {
  ConfigurationReference,
  getConf,
  makePin,
  resolveConf,
  setConf,
} from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import {
  canonicalizeViewRefName,
  getContainingTrack,
  getContainingView,
  getNotificationSink,
  getPaletteHost,
  getSession,
  isFeature,
  measureText,
  notifyFeatureDetailsMiss,
  openFeatureWidget,
  SimpleFeature,
  withFeatureDetails,
} from '@jbrowse/core/util'
import { basePaintedAt } from '@jbrowse/core/util/Base1DUtils'
import { MIN_BAND_HEIGHT, clampBandHeight } from '@jbrowse/core/util/bandHeight'
import { sameStrings } from '@jbrowse/core/util/sameStrings'
import HeightModeMixin, {
  installGrowExitBake,
} from '@jbrowse/display-kit/HeightModeMixin'
import LegendMixin from '@jbrowse/display-kit/LegendMixin'
import MultiRegionDisplayMixin, {
  fetchEachRegion,
} from '@jbrowse/display-kit/MultiRegionDisplayMixin'
import TrackHeightMixin from '@jbrowse/display-kit/TrackHeightMixin'
import { subPixelBinBp } from '@jbrowse/display-kit/subPixelBinBp'
import { addDisposer, types } from '@jbrowse/mobx-state-tree'
import { installUpload, oneCell } from '@jbrowse/render-core/installUpload'
import { regionDataMap } from '@jbrowse/render-core/regionDataMap'
import {
  ScoreScaleMixin,
  domainFromStats,
  resolveSymlogConstant,
  scaleTypeFromString,
  visibleStatsDomain,
} from '@jbrowse/wiggle-core'
import { YSCALEBAR_LABEL_OFFSET } from '@jbrowse/wiggle-core/constants'
import { autorun, observable, reaction } from 'mobx'

import { computeReadChains } from '../features/arcs/arcChains.ts'
import { arcColorLegendCategory } from '../features/arcs/arcColors.ts'
import { computeArcsByGroup } from '../features/arcs/compute.ts'
import { computeDerivativePaths } from '../features/derivativePaths/computePaths.ts'
import {
  bezierConnectionLegendItems,
  enumerateBezierPairs,
} from '../features/linkedReads/computeOverlay.ts'
import {
  COLOR_SCHEMES,
  isModificationScheme,
  isPerBaseScheme,
  normalizeColorBy,
  workerColorBy,
} from '../shared/colorSchemes.ts'
import {
  groupByForMode,
  groupKeySpaceOf,
  normalizeGroupBy,
} from '../shared/groupFeatures.ts'
import {
  arcKeyFoldsIntoReadKey,
  getArcLegendItems,
  getReadDisplayLegendItems,
  readCategoryLabelOverrides,
  readColorCategoryLabel,
} from '../shared/legendUtils.ts'
import {
  DEFAULT_MODIFICATION_THRESHOLD,
  normalizeFilterBy,
} from '../shared/types.ts'
import { getColorForModification } from '../util.ts'
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
import { configSlotViews } from './configSlotViews.ts'
import { ColorScheme } from './constants.ts'
import { GROUP_LABEL_HEIGHT } from './groupLabelStyle.ts'
import {
  applyChainStrandFrames,
  applyReadColorsByGroup,
  collectAcrossGroups,
  fittedReadPitch,
  layoutGroupsToViewport,
  nextGroupHeightOverride,
  someAcrossGroups,
} from './groupLayout.ts'
import {
  buildReadIdsByChainName,
  buildRawDataByGroup,
  buildReadIdIndexMap,
  buildSashimiDownKeys,
  hasNamedGroups,
  NO_HIDDEN_GROUPS,
  orderedGroups,
} from './groupedDataMaps.ts'
import {
  buildLanes,
  drawnLanesOf,
  laneExpandable,
  toSectionGroupInputs,
  zipLaneSections,
} from './lanes.ts'
import {
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
import {
  computeCrossRegionArcSections,
  computeInsertSizeTickSections,
  computeSashimiArcSections,
} from './overlaySections.ts'
import { chainReadIdsAt, findRead, readInfo } from './readLookup.ts'
import { shouldDrawOverlaps } from './renderers/rendererTypes.ts'
import { fetchFeatureDetails, fetchFeaturesForRegion } from './rpcCalls.ts'
import {
  belowCoverageBandsGeometry,
  buildSectionRenders,
  computeStackedSections,
  totalBelowCoverageOverhead,
} from './sectionLayout.ts'

import type {
  GroupedAlignmentsResult,
  WorkerPileupData,
} from '../RenderAlignmentDataRPC/types'
import type { ArcsByGroupResult } from '../features/arcs/compute.ts'
import type {
  DerivativeCandidate,
  DerivativePathEvidence,
} from '../features/derivativePaths/computePaths.ts'
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
import type { AlignmentLane } from './lanes.ts'
import type { ColorPalette } from './renderers/AlignmentsRenderer.ts'
import type { AlignmentsRenderingBackend } from './renderers/rendererTypes.ts'
import type {
  BelowCoverageBandsSettings,
  SectionsLayout,
} from './sectionLayout.ts'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { ContextMenuAnchor, MenuItem } from '@jbrowse/core/ui'
import type { Feature, Region } from '@jbrowse/core/util'
import type { HeightMode } from '@jbrowse/display-kit/heightMode'
import type { ExportSvgDisplayOptions } from '@jbrowse/display-kit/types'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// lazy so this eager state model does not pull the tooltip's @floating-ui
// dependency onto the startup path; the consumer renders it inside a Suspense
// boundary (AlignmentsDisplayComponent)
const AlignmentsTooltip = lazy(
  () => import('./components/AlignmentsTooltip.tsx'),
)

export { ColorScheme } from './constants.ts'
// Re-exported for the consumers that reach for a lane through the model — the
// group-label overlay, and the plugin's public surface.
export { laneExpandable }
export type { AlignmentLane }

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

// One identity for "no lane sizes itself", so `groupHeightOverrides` doesn't
// hand the layout a fresh map per evaluation.
const NO_GROUP_HEIGHT_OVERRIDES: ReadonlyMap<string, number> = new Map()

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
        LegendMixin(),
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
      // Track-menu toggles resolved from config slots — see `configSlotViews`.
      .views(configSlotViews)
      .volatile(() => {
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
          rpcDataMap: regionDataMap<GroupedAlignmentsResult>('rpcDataMap'),
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
           * volatile so it resets on reload. A key means nothing outside the
           * grouping that issued it — `''` is the ungrouped lane AND several
           * dimensions' catch-all bucket — so the whole set is dropped when
           * `groupKeySpace` moves (`AlignmentsGroupKeySpaceReset`).
           */
          collapsedGroups: observable.set<string>(),
          /**
           * #volatile
           * Per-group pileup height override in px (in-track grouping). Keyed by
           * group key, volatile like `collapsedGroups` and dropped alongside it
           * on a key-space change; absent keys fall back to the display-wide
           * `maxHeight`. Lets a dense section be shrunk independently.
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
        get view() {
          return getContainingView(self) as LinearGenomeViewModel
        },
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
          return NO_HIDDEN_GROUPS
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
         * Modification type code -> painted color, for every type the reads of
         * the LOADED regions declare. This is what the data CONTAINS; what is
         * actually drawn is filtered separately by isModificationTypeVisible
         * and by `presentModifications`, so don't rename this back to
         * "visible".
         *
         * Derived rather than accumulated, which is the whole point: it used to
         * be a volatile map that `setRpcData` added to and nothing ever
         * cleared, so it grew for the life of the tab and answered for every
         * locus the user had ever visited. The legend was narrowed off it after
         * the fact; the menu was not, and offered 6mA on a region carrying
         * none.
         *
         * Off `rpcDataMap` rather than the laid-out map, on purpose. This one
         * is about what the DATA holds — a type belonging to a hidden group is
         * still a type the user can reveal — and the menu is what asks. The
         * legend, which must not name a color no visible read paints, asks
         * `presentModifications` instead.
         *
         * Cheap despite running per fetch: the MM parse reports a handful of
         * type codes per group, so this is O(regions x groups) over arrays of
         * ~1-3 strings, and MobX memoizes it against `rpcDataMap`.
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
         * #getter
         * Whether the MM/ML header parse has an answer for what is on screen —
         * a fetch has landed, so an empty `detectedModifications` means "these
         * reads carry none" rather than "nothing has arrived yet". The
         * modifications menu shows "Loading modifications..." until this turns
         * true, and offers the submenu after.
         *
         * Derived, like the map it qualifies. It was a volatile flag that
         * `fetchNeeded` set true and nothing ever set back, so it outlived the
         * data it described: after `clearDisplaySpecificData` it still claimed
         * an answer for reads that were no longer loaded, and the menu skipped
         * "Loading modifications..." while the replacing fetch was in flight.
         * Reading the data is what the flag was always trying to say.
         *
         * The header parse is ungated (`extractModifications` reads MM headers
         * for every read whatever the scheme, and only mark PLACEMENT is
         * scheme-gated), so arrival of any fetch really does settle this.
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
         * Whether junctions with a non-canonical splice motif are dropped from
         * the sashimi arcs. Promotable like `showSashimiLabels`.
         */
        get hideNonCanonicalJunctions(): boolean {
          return resolveConf(self, 'hideNonCanonicalJunctions')
        },
        /**
         * #getter
         * "make the current non-canonical filter state the default for all
         * tracks" control (pin).
         */
        get hideNonCanonicalJunctionsDisplayTypeDefault() {
          return makePin(self, 'hideNonCanonicalJunctions')
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
          return buildReadIdsByChainName(
            self.rpcDataMap,
            self.isChainMode,
            self.hiddenGroupKeys,
          )
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
         * Lay out reads whose CIGAR carries a skip in the lowest pileup rows
         * (tier-2 relayout). Ignored while an explicit `sortedBy` position
         * sort is active.
         */
        get splicedReadsFirst(): boolean {
          return getConf(self, 'splicedReadsFirst')
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
         * The grouping the fetch will actually partition by, which is what the
         * worker resolves too (`executeRenderAlignmentData`): chain mode
         * degrades a per-read dimension to ungrouped without the slot moving,
         * so the slot alone never says which sections come back.
         */
        get effectiveGroupBy() {
          return groupByForMode(this.groupBy, self.isChainMode)
        },

        /**
         * #getter
         * Identity of the key space the fetched group keys live in, and so of
         * every collection this model keys by group key — see `groupKeySpaceOf`
         * for why a key alone cannot name its grouping.
         */
        get groupKeySpace() {
          return groupKeySpaceOf(this.effectiveGroupBy)
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
          return this.effectiveGroupBy !== undefined
        },

        /**
         * #getter
         * Whether each group draws as a single row, its overlap depth carried by
         * the tint layer rather than by stacking — "is the collapse IN EFFECT".
         * Reads `canCollapseGroupRows` rather than the slot alone, because the
         * slot can be a track-config default (LGVSyntenyDisplay sets one) that
         * either of that getter's conditions leaves inert: ungrouped it would
         * flatten the whole pileup onto one row, and chain mode lays true stacks
         * whatever the slot says (`collapsesRows`). Chain mode is reachable with
         * the slot already ticked and drops the menu row that would untick it,
         * so the two have to agree — the label chip words its height button off
         * this getter.
         */
        get collapseGroupRows(): boolean {
          return this.canCollapseGroupRows && getConf(self, 'collapseGroupRows')
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
         * Why an explicit read ordering cannot take effect, or `undefined` when
         * it can — one value carrying both the gate and the copy that names the
         * switch, so a surface cannot grey a control out without saying which
         * setting brings it back, and the two reasons cannot get out of step
         * with the condition that produced them.
         *
         * There has to be a pileup to order, and chain layout is handed neither
         * `sortedBy` nor `largeFeaturesFirst` (`buildLaidOutChainMap` takes
         * neither) because its rows are chains, ordered by chain distance.
         * Without this a chain-mode sort was a silent no-op, and the tag mode
         * additionally refetched the region to extract `sortTagValues` (it is in
         * `rpcProps`) that nothing reads.
         */
        get sortReadsBlockedReason(): string | undefined {
          return self.isChainMode
            ? 'Chain rows are ordered by chain — turn off "View as pairs / link supplementary alignments" to sort reads'
            : self.showPileup
              ? undefined
              : 'Turn on "Show pileup" to sort reads'
        },

        /**
         * #getter
         * Whether an explicit read ordering can take effect, and so whether the
         * ordering controls are live. The sibling of `canCollapseGroupRows`, and
         * read by both surfaces that can set an ordering — the track menu's
         * "Sort by..." and the context menu's position-anchored sorts — so the
         * two can't answer it differently.
         */
        get canSortReads() {
          return this.sortReadsBlockedReason === undefined
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
         *
         * The overrides IN EFFECT, so it cannot say a lane is sized while the
         * layout lays it out on the shared budget — see `groupHeightOverrides`.
         */
        hasGroupHeightOverride(key: string) {
          return this.groupHeightOverrides.has(key)
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
         * The per-lane pileup-height overrides IN EFFECT, which is not the set
         * banked. Fit derives one read pitch from every lane's FULL row count
         * (`fittedReadPitch`), so a lane the layout still caps at its own
         * override shows fewer rows than the pitch was solved for and leaves
         * exactly that much of the display blank — the one thing the mode
         * promises not to do.
         *
         * `setHeightMode` drops the overrides on the explicit switch, but the
         * resolved mode also moves without it (the promotable cascade, a track
         * reset), and there `canSizeGroupHeights` had already taken away both
         * surfaces that could clear one — leaving the lane clipped by a cap
         * `groupClippedBy` reports as `'override'`, which fires no affordance.
         * Inert rather than dropped, so returning to fixed restores what the
         * user set.
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
          return scaleTypeFromString(self.scaleType)
        },

        /**
         * #getter
         * The autoscaled depth domain, spanning every SHOWN group (each block
         * contributes one entry per group's coverage): a shared scale is what
         * makes stacked sections visually comparable, and ungrouped is the
         * one-group case. Hidden lanes are excluded — sizing the visible lanes'
         * axis against a lane the user hid is exactly the comparability this
         * scale exists to give.
         */
        get coverageDomain() {
          const hidden = self.hiddenGroupKeys
          return visibleStatsDomain({
            active: self.showCoverage,
            view: self.view,
            payloadFor: index => self.rpcDataMap.get(index),
            itemsFor: grouped =>
              grouped.groups
                .filter(({ key }) => !hidden.has(key))
                .map(({ data }) => data),
            accumulate: entries => computeVisibleCoverageStats(entries),
            range: stats =>
              domainFromStats(stats, self.autoscaleType, self.numStdDev),
            bounds: [self.minScoreBound, self.maxScoreBound],
            scaleType: self.scaleType,
          })
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
                // Raw slot; computeCoverageTicks resolves it from the same
                // domain `renderState` resolves it from, so the labels sit on
                // the bars rather than on a second symlog curve.
                getConf(self, 'symlogConstant'),
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
          if (self.showLegend) {
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
         * painting. The whole swatch list for those schemes, since their color
         * is a pure function of the value (`bakedValueColor`) and so needs no
         * discovered-value table to look up. It replaced one: `colorTagMap`
         * only ever grew, so after panning it held every value the track had
         * ever seen and keyed swatches for a chromosome the user had navigated
         * away from.
         *
         * `undefined` for schemes with no such values, which is what tells the
         * legend not to filter — distinct from the empty set, which means the
         * scheme has values and none are on screen. Same showLegend gate as the
         * category scan, for the same reason: it is O(reads).
         */
        get presentTagValues(): ReadonlySet<string> | undefined {
          const { type } = this.colorBy
          if (!self.showLegend || (type !== 'tag' && type !== 'mateRefName')) {
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
          if (!self.showLegend || !isModificationScheme(this.colorBy.type)) {
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
          return buildColorPaletteFromPalette(getPaletteHost(self).palette)
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
          if (self.showLegend && self.readConnections !== 'off') {
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
         * Whether the arc key folds into the read key — the overlay speaking
         * the reads' own vocabulary, in the categories both are actually
         * painting. `arcKeyFoldsIntoReadKey` holds the rule and the reasons the
         * scheme names alone do not settle it.
         */
        get arcColorsMatchReads() {
          return arcKeyFoldsIntoReadKey({
            arcColorByType: self.arcColorByType,
            readColorScheme: this.colorBy.type,
            arcCategories: this.arcLegendCategories,
            readCategories: this.colorLegendCategories,
          })
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
            detectedModifications: this.detectedModifications,
            presentTagValues: this.presentTagValues,
            presentModifications: this.presentModifications,
            refNamePosition: this.paintedRefNamePosition,
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
            hideNonCanonicalJunctions: this.hideNonCanonicalJunctions,
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
         * The settings half of the below-coverage band geometry — whether each
         * strip MAY be reserved and how tall it is, with neither data half
         * answered. Its two consumers answer those differently: the pooled
         * `belowCoverageBandsInput` asks once for the whole stack, the fit
         * budget once per lane.
         */
        get belowCoverageBandsSettings(): BelowCoverageBandsSettings {
          return {
            showCoverage: self.showCoverage,
            coverageHeight: self.coverageHeight,
            readConnections: self.readConnections,
            readConnectionsDown: self.readConnectionsDown,
            readConnectionsHeight: self.readConnectionsHeight,
            showSashimiArcs: self.showSashimiArcs,
            sashimiArcsHeight: self.sashimiArcsHeight,
          }
        },

        /**
         * #getter
         * Inputs to `belowCoverageBandsGeometry` — the settings above, plus
         * whether ANY lane has arcs or a sashimi junction bound for its strip.
         * Both data halves are pooled over the lanes, which
         * `computeStackedSections` asks per lane: the geometry here is the one
         * ungrouped answer, and there the lanes agree with it because there is
         * only the one. The grouped stack's own total is `totalBandOverhead`.
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
         * What the below-coverage strips cost the fit-to-viewport row budget
         * over the whole stack: every lane's own reserved bands, summed the way
         * `computeStackedSections` reserves them.
         *
         * Pre-layout by construction — `groupOrder` and the two lane sets are
         * all fetch-tier — which is what lets the layout spend it without
         * routing back through itself.
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
            // `FitViewportInput.totalOverhead`.
            totalOverhead: () => this.totalBandOverhead,
            collapsedKeys: self.collapsedGroups,
            heightOverridesPx: this.groupHeightOverrides,
          })
        },

        /**
         * #getter
         * Whether the unpaired chain-strand framing is live, as a BOOLEAN and in
         * its own computed. The boolean is the point: nine of the schemes give
         * one of two answers, so MobX's value comparison stops a scheme switch
         * from invalidating `laidOutByGroupFramed` unless the answer actually
         * moved. Reading `framesUnpairedChainStrand` inline there instead would
         * make the frame solve depend on `colorBy` itself and re-run on every
         * switch — which is what it used to do.
         */
        get framesChainStrand() {
          return framesUnpairedChainStrand(
            colorSchemeIndexFor(this.colorBy.type),
            this.readColorOpts,
          )
        },

        /**
         * #getter
         * The laid-out data with every chain's strand frame settled — see
         * `applyChainStrandFrames`, which says why the two passes are here and
         * not in the colour bake below.
         */
        get laidOutByGroupFramed() {
          return applyChainStrandFrames(
            this.laidOutByGroupUncolored,
            self.isChainMode,
            this.framesChainStrand,
          )
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
         * the worker so tag coloring stays a main-thread tier-2 setting (see
         * readTagColors).
         */
        get laidOutByGroup() {
          return applyReadColorsByGroup(
            this.laidOutByGroupFramed,
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
            splicedReadsFirst: this.splicedReadsFirst,
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
            colorScheme: colorSchemeIndexFor(this.colorBy.type),
            readColorOpts: this.readColorOpts,
            refNamePosition: this.paintedRefNamePosition,
          }
        },

        /**
         * #getter
         * Where a mate's reference sits in this assembly's own chromosome order,
         * for chromosome painting — the alignments twin of
         * `LinearSyntenyDisplay.paintedChromosomeOrder`, and the thing that lets
         * the palette be handed out rather than hashed into (`refNameColor`).
         *
         * It has to come from the ASSEMBLY rather than from the reads on screen,
         * or a chromosome's color would change with what else was in view.
         *
         * Canonicalizing first is not optional: a mate reference is `next_ref`,
         * which names a location this fetch did not ask for and so arrives in the
         * FILE's spelling (`1` against an assembly whose canonical name is
         * `chr1`) — see REFNAME_NAMESPACES.md. An uncanonicalized probe misses,
         * and a miss is SILENT: it falls back to the hash and paints a plausible
         * wrong color rather than raising anything.
         *
         * Undefined under every other scheme and until the assembly initializes,
         * where the fallback is the right answer rather than a failure.
         */
        get paintedRefNamePosition() {
          const assembly =
            this.colorBy.type === 'mateRefName'
              ? self.loadedAssembly
              : undefined
          return assembly
            ? (refName: string) =>
                assembly.refNameToIndex?.get(
                  assembly.getCanonicalRefName2(refName),
                )
            : undefined
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
          return orderedGroups(self.rpcDataMap, self.hiddenGroupKeys)
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
          return hasNamedGroups(this.groupOrder)
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
         * Normalizer for a refName that arrives in the BAM's own spelling (an SA
         * tag's or RNEXT's `chr1`) rather than the assembly-canonical one a
         * fetched read carries (`1`). Undefined when no assembly is resolved
         * (`loadedAssembly`), where the consumers fall back to identity.
         *
         * Shared rather than resolved per consumer because both need it for the
         * same reason: without it a same-chromosome split junction reads as
         * inter-chromosomal, and a derivative path names refNames the view
         * doesn't have.
         */
        get canonicalRefName() {
          const assembly = self.loadedAssembly
          return assembly
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
         * What one chain IS here, which is what the picker counts, floors and
         * words its rows by. A read pileup chains reads, needs two to call a
         * route agreed on, and reaches off-screen segments through SA tags.
         * `LGVSyntenyDisplay` overrides it: a locus carries one or two contigs,
         * and a PAF block names nothing the view has not fetched.
         */
        get derivativePathEvidence(): DerivativePathEvidence {
          return { noun: 'reads', minReads: 2, namesOffScreenSegments: true }
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
          // Every lane handed over at once, not chained lane by lane and
          // concatenated. Grouping (by HP tag, by strand, ...) partitions reads
          // for display and says nothing about which molecule carries which
          // junction, so it must not partition the evidence — and chaining per
          // lane does worse than partition it, it DOUBLES it, because each lane
          // rebuilds the whole chain from its own segment's SA tag.
          // `computeReadChains` carries the measurement.
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
          return computeDerivativePaths({
            chains: computeReadChains(
              this.rawDataByGroup.values(),
              this.loadedRegionInfos,
              this.canonicalRefName,
            ),
            minReads: this.derivativePathEvidence.minReads,
          })
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
          return buildReadIdIndexMap(self.rpcDataMap, self.hiddenGroupKeys)
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
          return findRead(self.readIdIndexMap, self.laidOutByGroup, featureId)
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
         * The stacked lanes, in stacking order: one `AlignmentLane` per drawn
         * group, ungrouped being the one-lane case.
         *
         * The single place a lane's key is turned into its data. Every per-lane
         * collection used to be looked up separately by each consumer — the raw
         * map, the laid-out map, the two arc feeds, the sashimi sides, the
         * collapse/override volatiles — so a lane's identity was a bare string
         * indexed into as many keyed collections as there were questions, each
         * with its own `?? empty` for a key that structurally cannot be missing.
         *
         * A projection, not a store: every field is read from the computed that
         * owns it, so the fetch/layout/recolor tiers upstream are untouched and
         * this adds no state to keep in step.
         */
        get lanes(): AlignmentLane[] {
          // Both below-coverage strips are reserved per lane: grouping routinely
          // leaves lanes with nothing bound for one (the 'Not split' lane of a
          // split-read grouping has no arc), and those carried an empty strip.
          // Empty when read-connections are off, so this costs nothing there.
          //
          // The two arc feeds come through their own named getters, which is
          // where the reason they ARE two lists lives, and the band-reservation
          // question is asked of the pass holding both halves
          // (`inkGroupKeys`) — this directory's `hasArcBandInk`-not-`numArcs`
          // rule met one level up.
          return buildLanes({
            order: self.groupOrder,
            rawByGroup: self.rawDataByGroup,
            laidOutByGroup: self.laidOutByGroup,
            arcsByGroup: self.arcsByGroup,
            crossRegionArcsByGroup: self.crossRegionArcsByGroup,
            arcInkKeys: self.arcsResult.inkGroupKeys,
            sashimiDownKeysByGroup: self.sashimiDownKeysByGroup,
            collapsedKeys: self.collapsedGroups,
            heightOverrideKeys: self.groupHeightOverrides,
            showPileup: self.showPileup,
            fitHeightToDisplay: self.fitHeightToDisplay,
          })
        },

        /**
         * #getter
         * The lanes actually laid out, or the one SYNTHETIC lane. `sections` has
         * to produce a section before any fetch lands — and a grouped fetch over
         * an empty region partitions to zero lanes — so the section pipeline is
         * never handed an empty list. Every collection on it is empty by
         * construction, `maxY` included.
         */
        get drawnLanes(): AlignmentLane[] {
          return drawnLanesOf(this.lanes)
        },

        /**
         * #method
         * One lane by group key, for the per-key questions a component asks with
         * a `groupKey` in hand. `undefined` for a key that isn't drawn.
         */
        laneFor(key: string) {
          return this.lanes.find(l => l.groupKey === key)
        },

        /**
         * #method
         * Which cap hid reads from a lane's pileup, or `undefined` when nothing
         * was hidden — including for a key that isn't drawn. A read of what the
         * layout pass recorded (`RowCapSource` names them), not a
         * re-derivation: the pass is handed its cap with the policy attached, so
         * the answer comes back out of the layout instead of being reconstructed
         * from a row count afterwards.
         *
         * Which cap it was decides what may be offered, and only one answer can
         * be right: expanding a lane banks an override of `maxHeight` px, so a
         * lane already clipped at that ceiling gets the identical cap back — not
         * one extra read appears, while the override silences the flag. The
         * reconstruction this replaced compared a lane's rows against the
         * ceiling, which is true whenever the two caps merely differ; a
         * single-section grouping sat wholly in that hole, since one lane takes
         * the ungrouped cap and never a slice.
         */
        groupClippedBy(key: string) {
          return this.laneFor(key)?.clippedBy
        },

        /**
         * #method
         * True when a lane's pileup was clipped by a cap the per-lane expand can
         * actually raise — the rule behind the "show all" affordance, which must
         * not appear where it would do nothing. The chip itself asks
         * `laneExpandable` off the section it already holds; this is the same
         * question for the callers that have only a key, like
         * `isGroupCeilingClipped` beside it.
         *
         * Two of the caps qualify: a lane's viewport slice, and the single row
         * `collapseGroupRows` gives it. Both expand into a true stack, because
         * banking an override opts the lane out of each.
         */
        isGroupTruncated(key: string) {
          return laneExpandable(this.laneFor(key))
        },

        /**
         * #method
         * True when THIS lane's pileup was clipped by the display-wide
         * `maxHeight` and its overflow reads were collapsed. Drives the rule
         * drawn across the bottom of the clipped rows — see
         * `PileupTruncationRule`, which is per section because the notice marks
         * the place where the reads stop rather than a state of the whole track.
         *
         * A lane field (`ceilingClipped`), so the overlay that walks sections
         * reads it off the section it already holds; this exists for the callers
         * that have only a key. The two display-wide suppressions live where the
         * field is built.
         */
        isGroupCeilingClipped(key: string) {
          return this.laneFor(key)?.ceilingClipped ?? false
        },

        /**
         * #getter
         * True when any pileup hit the display-wide `maxHeight` and overflow
         * reads were collapsed. Reads every lane, not just an ungrouped one: the
         * ceiling is display-wide, so a stacked lane clipped by it is exactly as
         * unreachable as an ungrouped pileup would be, and the per-label
         * affordance deliberately steps aside for it.
         *
         * The display-wide answer; what is DRAWN is the per-section
         * `isGroupCeilingClipped`, which carries the suppressions this composes.
         */
        get pileupTruncated() {
          return this.lanes.some(l => l.ceilingClipped)
        },

        /**
         * #getter
         * Single source of all vertical band geometry, one entry per lane.
         * `computeStackedSections` reproduces the prior ungrouped reserved layout
         * exactly for its single-section (N==1) case, so ungrouped is not a
         * special branch here — it is the one-lane call, over `drawnLanes` so a
         * display with no data still has a section. The sticky-coverage-vs-scroll
         * distinction lives downstream in `buildSectionRenders`, keyed off section
         * count.
         */
        get sections(): SectionsLayout {
          return computeStackedSections(toSectionGroupInputs(this.drawnLanes), {
            ...self.arcBandInput,
            rowHeight: self.rowHeight,
            showSashimiArcs: self.showSashimiArcs,
            sashimiHeight: self.sashimiArcsHeight,
            // Only when the chips are actually drawn — an ungrouped display
            // reserves nothing, so its geometry is untouched.
            minSectionHeight: self.showsGroupLabels ? GROUP_LABEL_HEIGHT : 0,
          })
        },

        /**
         * #getter
         * Every lane paired with its band geometry, in stacking order: the list
         * the overlays, the hit-test pipeline and both renderers all walk.
         *
         * The pairing is by INDEX and that is structural, not a coincidence —
         * `computeStackedSections` emits one section per lane in order, and both
         * lists come from `drawnLanes`. Deriving the two from different sources is
         * what used to let them disagree whenever a section was synthesized.
         *
         * Carrying the lane's own collections here is what retires the by-key
         * lookup every downstream pass used to do (`?? new Map()` for a key that
         * structurally cannot be missing, spelled once per consumer).
         */
        get renderSections() {
          return zipLaneSections(this.drawnLanes, this.sections.sections)
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
         * derive from `renderSections`, making that structural — deriving this one
         * from `groupOrder` instead let the two disagree whenever the section
         * pipeline synthesized its no-data lane (0 uploaded vs 1 drawn), which
         * happens on an empty grouped fetch. That mismatch was benign only because
         * the per-section region lookup missed and the draw skipped.
         */
        get sourceSections() {
          return this.renderSections.map(
            ({ groupKey, laidOutPileupMap, arcsRpcDataMap }) => ({
              groupKey,
              laidOutPileupMap,
              arcsRpcDataMap,
            }),
          )
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
                pairs: enumerateBezierPairs(
                  sec.laidOutPileupMap,
                  scope,
                  // The same normalizer the arcs and the derivative paths take,
                  // and what lets a junction name the off-screen segments it
                  // steps over in the view's own refName spelling rather than
                  // the BAM's. Its SA parse belongs to THIS getter's memo, not
                  // to the per-frame projection that reads the result.
                  self.canonicalRefName,
                ),
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
         * Per-section sashimi arcs, in stacking order. The overlay and the SVG
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
          const view = self.view
          if (
            !self.showSashimiArcs ||
            !self.showCoverage ||
            !view.initialized
          ) {
            return []
          }
          return computeSashimiArcSections({
            sections: this.renderSections,
            visibleRegions: view.visibleRegions,
            bpToScreenX: makeBpToScreenX(view),
            // Safe past the `view.initialized` gate above, which is the same
            // thing that makes the hosts' own `view.width` read safe.
            viewWidthPx: view.width,
            coverageHeight: self.coverageHeight,
            sashimiArcsHeight: self.sashimiArcsHeight,
            minSashimiScore: self.minSashimiScore,
            hideNonCanonicalJunctions: self.hideNonCanonicalJunctions,
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
          const view = self.host
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
          const section = this.renderSections.find(s => s.groupKey === groupKey)
          return section === undefined
            ? 0
            : section.topOffset - self.coverageDisplayHeight
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
        readIdsSharingChain(rpcData: WorkerPileupData, index: number) {
          return chainReadIdsAt(rpcData, index, self.readIdsByChainName)
        },

        getFeatureInfoById(featureId: string) {
          const hit = self.findFeatureInRpcData(featureId)
          const region = hit && self.loadedRegions.get(hit.displayedRegionIndex)
          return hit && region ? readInfo(hit, region, featureId) : undefined
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
         * display without scrolling — the fractional pitch, the 1px floor and the
         * Normal-pitch cap all being `fittedReadPitch`'s.
         *
         * The uncapped row count is taken against a fixed `maxHeight`-row cap,
         * independent of the current `featureHeight`, so the fit autorun that
         * writes `featureHeight` can't feed back into this. `fitTargetHeight` is
         * the slot, NOT the reactive `height` getter — the same anti-cycle rule
         * `laidOutByGroup` follows. Fit mode only, where the two are equal, but
         * the slot can never chain back through
         * height->grownHeight->layout->featureHeight if this ever moves.
         */
        get fittedFeatureHeight() {
          return fittedReadPitch({
            ctx: self.groupLayoutContext,
            maxHeight: self.maxHeight,
            collapsedKeys: self.collapsedGroups,
            fitTargetHeight: self.fitTargetHeight,
            totalOverhead: self.totalBandOverhead,
          })
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
            coverageScaleType: self.coverageScaleType,
            // Resolved here rather than in a getter: the raw slot means "derive
            // from the domain", and this is the one place the resolved domain
            // is in hand. Every backend then normalizes with this one number.
            coverageSymlogConstant: resolveSymlogConstant(
              self.coverageDepthDomain?.[0] ?? 0,
              self.coverageDepthDomain?.[1] ?? 0,
              getConf(self, 'symlogConstant'),
            ),
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
         * The read cloud's insert-size ruler, per section — see
         * `computeInsertSizeTickSections`. Empty outside read-cloud mode, which
         * is the only mode that puts |TLEN| on the band's Y axis.
         */
        get insertSizeTickSections() {
          const arcsYDomainBp = this.arcsYDomainBp
          return arcsYDomainBp === undefined
            ? []
            : computeInsertSizeTickSections(self.renderSections, arcsYDomainBp)
        },

        /**
         * #getter
         * Per-section geometry for the arcs no per-region pass can draw — see
         * `computeCrossRegionArcSections`, which owns the band-local contract
         * this shares with the sashimi and ruler walks.
         */
        get crossRegionArcSections() {
          const view = self.view
          if (self.readConnections === 'off' || !view.initialized) {
            return []
          }
          // Read once per resolve rather than per foot: the breakend feet need
          // it for both of their endpoints and this getter re-runs on every pan
          // frame, where `displayedRegions[i]` is a MobX array read.
          const reversedByRegion = view.displayedRegions.map(r => !!r.reversed)
          return computeCrossRegionArcSections({
            sections: self.renderSections,
            bpToScreenX: makeBpToScreenX(view),
            arcsYDomainBp: this.arcsYDomainBp,
            pxPerBp: view.bpPerPx > 0 ? 1 / view.bpPerPx : 0,
            regionReversed: i => reversedByRegion[i] ?? false,
            lineWidth: self.readConnectionsLineWidth,
            colors: self.colorPalette,
            screenWidthPx: view.width,
            // Once per NUMBER, not once per evaluation, since this getter
            // re-runs on every pan frame — see `reportArcCap`.
            onCapped: (groupKey, dropped, kept) => {
              self.reportArcCap(groupKey, dropped, kept)
            },
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
        // (readTagColors is baked in laidOutPileupMap from the per-read value
        // strings the worker already ships, so no discovered-value state exists
        // to put here and re-create the discover→assign→refetch loop with).
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
            // All three mirror what `executeRenderAlignmentData` does with them
            // in chain mode — it forces soft clipping off, drops the sort tag
            // and degrades a per-read grouping to ungrouped (`groupByForMode`,
            // which this getter is the main-thread half of) — so that the cache
            // key names the fetch the worker will actually perform. Sending the
            // raw values instead made settings that cannot reach chain output
            // invalidate every fetched region anyway: "Show soft clipping" is a
            // live checkbox in chain mode, so each click dropped `rpcDataMap`
            // and re-read the region to receive byte-identical data; a
            // `sortedBy` carried in from before the mode was entered kept a tag
            // name in the key that only ever extracted `sortTagValues` nothing
            // reads (see `canSortReads`); and a `groupBy` chain mode drops is
            // reachable the same way, from a session or the settings editor.
            sortTag: self.isChainMode ? undefined : self.sortTag,
            groupBy: self.effectiveGroupBy,
            showSoftClipping: self.isChainMode ? false : self.showSoftClipping,
            // showCoverage is here (not just renderState) because the worker
            // skips the entire coverage-band pipeline — including the per-bp GPU
            // depth buffer that overflows the device limit at whole-chromosome
            // scale — when the band is off. So toggling it refetches. The
            // pileup's low-frequency fade is unaffected (see runCoveragePipeline).
            showCoverage: self.showCoverage,
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
         * Genomic bp one per-base cell stands for in the worker's extract:
         * `subPixelBinBp` off the debounced zoom, and `1` in every color mode
         * that does not paint a wall of them.
         *
         * Per-base quality and per-base lettering emit one entry per aligned
         * base of EVERY read, so their extract grows with bases x depth where
         * every other pass grows with events — a force-loaded region at the byte
         * gate's ceiling builds millions of them in the worker before anything
         * is packed. Sampling one base per sub-pixel window bounds that by the
         * VIEWPORT rather than by the region, and costs nothing visible:
         * `subPixelBinBp` is 1 at every zoom where a base is still a pixel wide,
         * and above that the samples are half a pixel apart while the cells they
         * paint floor to a whole one, so the wall stays unbroken.
         *
         * Not an `rpcProps` field — see `perBaseBinBp` on the RPC args for why a
         * zoom-swinging value belongs at the call site, and `regionFetchKey`
         * below for what invalidates on it instead.
         */
        get perBaseBinBp() {
          const view = self.view
          return isPerBaseScheme(self.colorBy.type) && view.initialized
            ? subPixelBinBp(view.coarseBpPerPx)
            : 1
        },

        /**
         * #getter
         * The same bin off the LIVE zoom, and read by `dataSuperseded` alone.
         *
         * The debounced bin cannot answer "is the held data sampled finely
         * enough for what is on screen": it is the value the held data was
         * fetched under, so for the whole 500ms the debounce takes to catch up
         * the two agree by construction and a supersession test built on it can
         * only ever say no. That is half the window `dataSuperseded` exists to
         * cover — the debounce half, where the picture is already several
         * octaves coarser than the zoom it is drawn at — and it is the half an
         * export lands in, since a reader zooms and then reaches for the menu.
         *
         * It stays out of `regionFetchKey`, which drives the refetch, and the
         * reason is not that a live key would flip more often — the
         * quantization means it flips per octave either way, and wiggle keys on
         * live `bpPerPx` outright (ADR-008). It is that `FetchVisibleRegions`
         * runs on the leading edge, so a live key makes a fast multi-octave
         * gesture issue a refetch at each octave it passes through, and this is
         * the pipeline whose extract is the OOM the per-base bin exists to
         * bound. Latest-wins cancels the RPC, not worker work already running.
         */
        get livePerBaseBinBp() {
          const view = self.view
          return isPerBaseScheme(self.colorBy.type) && view.initialized
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
         * `MultiRegionDisplayMixin`'s per-region content axis: what a fetch
         * issued right now would produce. Only the per-base bin moves it, so in
         * every other color mode this is one constant string and a zoom never
         * refetches on its account; in the two per-base modes a bin flip
         * refetches the regions on screen and leaves the rest of the held data
         * alone, which is the whole reason the bin is not in `rpcProps`.
         *
         * Its own views block, after the getter it reads, for the reason
         * `rpcProps` has one.
         */
        get regionFetchKey() {
          return String(self.perBaseBinBp)
        },
      }))
      .views(self => ({
        /**
         * #getter
         * `MultiRegionDisplayMixin`'s supersession hook: the settled per-base bin
         * has not moved yet, but the live zoom has already left it, so the clear
         * is inevitable and not yet committed.
         *
         * **Only the debounce half is here.** Once the settled bin moves, the
         * stamp a region was fetched under stops matching `regionFetchKey` and
         * the foundation's own `isCacheValid` term in `dataCurrent` covers it —
         * this display carried that compare privately until the foundation took
         * it. What no key can state is the window before the debounce catches
         * up: the stamp IS the settled bin, so the two agree by construction
         * while the wall on screen is already several octaves coarser than the
         * zoom it is drawn at. That is the half an export lands in, since a
         * reader zooms and then reaches for the menu.
         *
         * A value compare, never a second spelling of the key. Restating the
         * key's string format on the live side would latch this true the day the
         * key grows a second axis, and a latched supersession is an export that
         * hangs to `awaitSvgReady`'s timeout rather than one that fails.
         */
        get dataSuperseded(): boolean {
          return self.perBaseBinBp !== self.livePerBaseBinBp
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
            setConf(self, 'colorBy', colorBy)
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
            const view = self.view
            const { centerLineInfo } = view
            // Every type routed here needs the position. `partitionBySort`
            // ranks by membership at `sortPos` whatever the type is, and
            // `sortOverlappingByIndex` only ever orders the reads that ranked
            // — strand included. There is no sort this action can reach that
            // lays out sensibly without a center line.
            if (centerLineInfo && !centerLineInfo.oob) {
              this.setSortSlot({
                type,
                // `offset` counts bp INTO the region; the worker compares this
                // against absolute `readPositions`, and on a reversed region
                // the base drawn here is mirrored. `basePaintedAt` is the pivot
                // the context-menu sort already goes through.
                pos: basePaintedAt(centerLineInfo, centerLineInfo.offset),
                refName: centerLineInfo.refName,
                assemblyName: centerLineInfo.assemblyName,
                tag,
              })
              // The sort anchors on the column under the center line, so reveal
              // it — the user sees exactly where the pileup is being ordered.
              view.setShowCenterLine(true)
            } else {
              // Reveal the center line the warning asks the user to reposition —
              // it's the thing they need to see to comply.
              view.setShowCenterLine(true)
              getNotificationSink(self).notify(
                'Cannot sort: the view center line is not over a valid position. Scroll so the center line is within a region and try again.',
                'warning',
              )
            }
          },

          /**
           * #action
           * Commit a sort, the single place the `sortedBy` slot is written. Also
           * drops the layout-order flags: they are peer radios in one group
           * ("Longest reads first" and "Spliced reads first" are flags, a sort
           * is the slot), so exactly one must hold state. Doing it here rather than at the menu
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
            setConf(self, 'splicedReadsFirst', false)
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
            const view = self.view
            const assemblyName = view.assemblyNames[0]
            if (assemblyName) {
              this.setSortSlot({ type, pos, refName, assemblyName, tag })
            } else {
              getNotificationSink(self).notify(
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
           */
          setSplicedReadsFirst(flag: boolean) {
            setConf(self, 'splicedReadsFirst', flag)
          },

          /**
           * #action
           * Set (or remove, when undefined) the in-track stacked grouping
           * dimension. A tier-1 refetch setting (in `rpcProps`) — the worker
           * re-partitions the fetch into N sections. Resets the Y scroll since
           * the stacked content height changes. Ungrouping stores an explicit
           * `null` override (not a cleared override) so it beats a configured
           * `groupBy` default rather than falling back to it.
           *
           * Doesn't drop the per-lane state: `AlignmentsGroupKeySpaceReset`
           * does that for this write and for the ones no action of this
           * display makes.
           */
          setGroupBy(groupBy?: GroupBy) {
            setConf(self, 'groupBy', groupBy ?? null)
            self.scrollTop = 0
          },

          /**
           * #action
           * Forget every collapse and height override. Each is keyed by group
           * key, and a group key only names a lane within the grouping that
           * issued it, so a key-space change invalidates all of them at once.
           */
          dropGroupLaneState() {
            self.collapsedGroups.clear()
            self.groupMaxHeightOverrides.clear()
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
            // One lookup: a `renderSections` entry is its lane plus its band
            // geometry, so the drawn height and the clip come off the same
            // object rather than out of two collections found by the same key.
            // A key that isn't drawn has no band to resize — the handle only
            // exists per drawn section — and the two zero-ish fallbacks this
            // replaces let a shrink-drag bank a one-row override on it.
            const section = self.renderSections.find(s => s.groupKey === key)
            if (!section) {
              return
            }
            const next = nextGroupHeightOverride({
              dy,
              rowHeight: self.rowHeight,
              displayedPx: section.pileupHeight,
              existingPx: self.groupMaxHeightOverrides.get(key),
              fullyShown: section.clippedBy === undefined,
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
          setReadConnections(mode?: ReadConnectionsMode) {
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
          setHideNonCanonicalJunctions(hide: boolean) {
            setConf(self, 'hideNonCanonicalJunctions', hide)
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
          installUpload(self, backend, {
            // A fresh object every run, so every run reaches the renderer: it
            // holds the memo of what it last sent (GPU_RENDERING.md, the
            // whole-map sync), and this layer's diff has nothing to add to it.
            cells: () =>
              oneCell('sources', {
                sections: self.sourceSections,
                // Read inside the upload autorun, not lifted into an action:
                // arc instances are packed at this width (arcLineWidth ×
                // support), so a change to it has to reach the pack.
                readConnectionsLineWidth: self.readConnectionsLineWidth,
              }),
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
        return {
          /**
           * #action
           */
          async fetchNeeded(
            needed: { region: Region; displayedRegionIndex: number }[],
          ) {
            await fetchEachRegion(self, needed, {
              call: (region, ctx) =>
                fetchFeaturesForRegion(self, self.adapterConfig, region, ctx),
              onResult: (displayedRegionIndex, result) => {
                self.setRpcData(displayedRegionIndex, result)
              },
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
         * the index estimate — so an over-budget region is refused before a
         * single read is downloaded.
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
            // The gate and the copy naming the switch are one value
            // (`sortReadsBlockedReason`), so this cannot grey the menu out
            // without saying what brings it back.
            getSortByMenuItem(self, {
              disabledHelpText: self.sortReadsBlockedReason,
            }),
            ...getFiltersMenuItems(self, { readCategories: true }),
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
      // `gateEnabled` above: the fetch RPC measures the region before it
      // downloads and afterAttach clears the estimate on chromosome nav.
      // Byte-only — no density axis. The hover is dropped on the flip by
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
          addDisposer(self, installGrowExitBake(self, self.host))

          // Drop the collapses and height overrides whenever the grouping key
          // space moves. A reaction rather than a line in `setGroupBy`, because
          // the effective grouping also moves with no action of this display
          // involved: Reset track settings drops the whole config delta, the
          // settings editor writes the `groupBy` slot directly, and entering
          // chain mode degrades a per-read dimension (`groupByForMode`). Left
          // behind, a key carries its meaning to a lane that never earned it —
          // and `''`, which every one of those routes can land on, is the
          // ungrouped lane, which draws no chip to expand itself again.
          addDisposer(
            self,
            reaction(
              () => self.groupKeySpace,
              () => {
                self.dropGroupLaneState()
              },
              { name: 'AlignmentsGroupKeySpaceReset' },
            ),
          )

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
