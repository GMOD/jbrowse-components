import { lazy } from 'react'

import {
  YSCALEBAR_LABEL_OFFSET,
  computeCoverageTicks,
  computeVisibleCoverageStats,
} from '@jbrowse/alignments-core'
import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
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
import { getSnapshot, isAlive, types } from '@jbrowse/mobx-state-tree'
import {
  ConfigOverrideMixin,
  MultiRegionDisplayMixin,
  TrackHeightMixin,
} from '@jbrowse/plugin-linear-genome-view'
import { domainFromStats, getNiceDomain } from '@jbrowse/wiggle-core'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import MenuOpenIcon from '@mui/icons-material/MenuOpen'
import SwapVertIcon from '@mui/icons-material/SwapVert'
import { observable } from 'mobx'

import { updateColorTagMap as updateColorTagMapPure } from './colorTagUtils.ts'
import { readColorCategory } from './colorUtils.ts'
import {
  CIGAR_TYPE_LABELS,
  buildColorPaletteFromTheme,
} from './components/alignmentComponentUtils.ts'
import { computeHighlightBoxes } from './components/computeHighlightBoxes.ts'
import { computeVisibleLabels } from './components/computeVisibleLabels.ts'
import { openCigarWidget } from './components/openFeatureWidget.ts'
import { ColorScheme } from './constants.ts'
import {
  buildLaidOutByGroup,
  fitGroupMaxRows,
  groupMaxY,
} from './groupLayout.ts'
import {
  anyGroupHasSashimi,
  buildChainIdMap,
  buildRawDataByGroup,
  buildReadIdIndexMap,
  eachGroupData,
  orderedGroups,
} from './groupedDataMaps.ts'
import { computeInsertSizeTicks } from './insertSizeTicks.ts'
import {
  COMPACTNESS_PRESETS,
  getColorByMenuItem,
  getCoverageMenuItem,
  getFeatureHeightMenuItem,
  getFiltersMenuItem,
  getGroupByMenuItem,
  getReadConnectionsMenuItem,
  getReadsMenuItem,
  getSortByMenuItem,
} from './menus/index.ts'
import { migrateAlignmentsSnapshot } from './migrateAlignmentsSnapshot.ts'
import {
  belowCoverageBandsGeometry,
  buildSectionRenders,
  computeStackedSections,
} from './sectionLayout.ts'
import { computeArcsRegionMap } from '../features/arcs/compute.ts'
import { COLOR_SCHEMES, isModificationScheme } from '../shared/colorSchemes.ts'
import { getReadDisplayLegendItems } from '../shared/legendUtils.ts'
import { DEFAULT_MODIFICATION_THRESHOLD } from '../shared/types.ts'
import { getColorForModification } from '../util.ts'
import { computeArcBand } from './renderers/rendererTypes.ts'

import type { ReadColorCategory } from './colorUtils.ts'
import type { LinearAlignmentsDisplayConfigModel } from './configSchema.ts'
import type {
  LinkedReadsMode,
  ReadConnectionsMode,
  SashimiArcsMode,
} from './constants.ts'
import type { CompactnessLevel } from './menus/featureSize.ts'
import type { ColorPalette } from './renderers/AlignmentsRenderer.ts'
import type { SectionsLayout } from './sectionLayout.ts'
import type {
  GroupedAlignmentsResult,
  PileupDataResult,
} from '../RenderAlignmentDataRPC/types'
import type { ArcsUploadData } from '../features/arcs/types.ts'
import type { CigarHitResult } from '../shared/hitTestTypes.ts'
import type { ScrollModel } from './components/sectionScreen.ts'
import type { TooltipPayload } from './components/tooltipUtils.ts'
import type { AlignmentsRenderingBackend } from './renderers/rendererTypes.ts'
import type { IndicatorHitResult } from '../features/indicator/types.ts'
import type {
  ArcColorByType,
  ColorBy,
  ColorSchemeType,
  FilterBy,
  GroupBy,
  ModificationTypeWithColor,
  SortedBy,
} from '../shared/types'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { MenuItem } from '@jbrowse/core/ui'
import type { AbstractSessionModel, Feature, Region } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type {
  ExportSvgDisplayOptions,
  FetchContext,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

export type { ArcColorByType } from '../shared/types'

const arcColorByTypes = types.enumeration<ArcColorByType>('ArcColorByType', [
  'insertSizeAndOrientation',
  'insertSize',
  'orientation',
])

export {
  getInsertionType,
  insertionBarWidth as getInsertionRectWidthPx,
  textWidthForNumber,
} from './constants.ts'
export type { InsertionType } from './constants.ts'

export type { Region } from '@jbrowse/core/util'

function getSequenceAdapter(
  session: AbstractSessionModel,
  region: Region,
): Record<string, unknown> | undefined {
  const assembly = region.assemblyName
    ? session.assemblyManager.get(region.assemblyName)
    : undefined
  const sequenceAdapterConfig = assembly?.configuration?.sequence?.adapter
  if (!sequenceAdapterConfig) {
    return undefined
  }
  return getSnapshot(sequenceAdapterConfig)
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
      sessionId,
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

// Max pileup rows the layout may produce before overflow reads collapse to the
// bottom. Hard-capped below the Uint16 ceiling so row indices (stored in
// `readYs`) and the overflow sentinel never wrap.
export function maxRowsFor(maxHeight: number, rowHeight: number) {
  return Math.max(
    1,
    Math.min(65534, Math.floor(maxHeight / Math.max(1, rowHeight))),
  )
}

// colorBy.type → shader colorScheme index, resolved through the shared
// COLOR_SCHEMES registry (each scheme names a shader path) and ColorScheme (the
// path → index map). Total over ColorSchemeType via the registry, so no
// fallback is needed at the call sites.
function colorSchemeIndexFor(type: ColorSchemeType) {
  return ColorScheme[COLOR_SCHEMES[type].shaderScheme]
}

// Material UI 200-tone palette for color-by-tag values. The first value
// hit gets index 0, the eleventh wraps to index 0 again.

/**
 * #stateModel LinearAlignmentsDisplay
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
 *       colorBy: { type: 'methylation' },
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
  configSchema: AnyConfigurationSchemaType,
) {
  return (
    types
      .compose(
        'LinearAlignmentsDisplay',
        BaseDisplay,
        TrackHeightMixin(),
        MultiRegionDisplayMixin(),
        ConfigOverrideMixin<
          LinearAlignmentsDisplayConfigModel,
          // override-only keys (read via getOverride, no config-slot fallback)
          | 'mismatchAlpha'
          | 'showLowFreqMismatches'
          | 'showLegend'
          | 'sortedBy'
          | 'groupBy'
          | 'showOutline'
        >([
          'scaleType',
          'autoscale',
          'minScore',
          'maxScore',
          'numStdDev',
          'colorBy',
          'filterBy',
          'featureHeight',
          'featureSpacing',
          'maxHeight',
          'mismatchAlpha',
          'showLowFreqMismatches',
          'showLegend',
          'sortedBy',
          'groupBy',
          'readConnectionsLineWidth',
          'showSashimiLabels',
          'showOutline',
        ]),
        // Settings split two ways (see CLAUDE.md §"Settings: storage +
        // invalidation tiers"): "display options" (colorBy, filterBy, sortedBy,
        // showOutline, …) are config overrides so a config default can be added
        // later with no code change; the plain MST fields below are the
        // remaining toggles. Each setting also has a refetch/relayout/render
        // blast radius documented there.
        types.model({
          /**
           * #property
           */
          type: types.literal('LinearAlignmentsDisplay'),
          /**
           * #property
           */
          configuration: ConfigurationReference(configSchema),
          /**
           * #property
           */
          linkedReads: types.stripDefault(
            types.enumeration<LinkedReadsMode>('LinkedReadsMode', [
              'off',
              'normal',
            ]),
            'off',
          ),
          /**
           * #property
           * Draw paired-read connection curves (bezier overlay + GPU
           * straight lines for normal pairs). Orthogonal to `linkedReads`
           * layout, so curves work over an ordinary pileup or chain layout.
           */
          showBezierConnections: types.stripDefault(types.boolean, false),
          /**
           * #property
           */
          showCoverage: types.stripDefault(types.boolean, true),
          /**
           * #property
           * Draw the stacked-read pileup band. Turn off to keep only the
           * coverage histogram and read-connection arcs (the pileup band
           * collapses to zero height), e.g. an arcs-only structural-variant view.
           */
          showPileup: types.stripDefault(types.boolean, true),
          /**
           * #property
           */
          coverageHeight: types.stripDefault(types.number, 45),
          /**
           * #property
           */
          showMismatches: types.stripDefault(types.boolean, true),
          /**
           * #property
           */
          showInterbaseIndicators: types.stripDefault(types.boolean, true),
          /**
           * #property
           */
          drawSingletons: types.stripDefault(types.boolean, true),
          /**
           * #property
           */
          drawProperPairs: types.stripDefault(types.boolean, true),
          /**
           * #property
           */
          flipStrandLongReadChains: types.stripDefault(types.boolean, true),
          /**
           * #property
           */
          drawInter: types.stripDefault(types.boolean, true),
          /**
           * #property
           */
          drawLongRange: types.stripDefault(types.boolean, true),
          /**
           * #property
           */
          arcColorByType: types.stripDefault(
            arcColorByTypes,
            'insertSizeAndOrientation',
          ),
          /**
           * #property
           * read-connection rendering mode (mate pairs + split reads),
           * orthogonal to direction
           */
          readConnections: types.stripDefault(
            types.enumeration<ReadConnectionsMode>('ReadConnectionsMode', [
              'off',
              'arc',
              'samplot',
            ]),
            'off',
          ),
          /**
           * #property
           * draw read connections below the coverage band instead of over it
           */
          readConnectionsDown: types.stripDefault(types.boolean, false),
          /**
           * #property
           */
          showSashimiArcs: types.stripDefault(types.boolean, true),
          /**
           * #property
           * sashimi junction-arc placement, decoupled from the paired-end arc
           * direction: 'up' over coverage, 'down' in a reserved strip below it,
           * 'auto' splits arcs both ways to minimize overlap
           */
          sashimiArcsMode: types.stripDefault(
            types.enumeration<SashimiArcsMode>('SashimiArcsMode', [
              'up',
              'down',
              'auto',
            ]),
            'auto',
          ),
          /**
           * #property
           * hide sashimi junction arcs with fewer than this many supporting
           * reads (0 shows all)
           */
          minSashimiScore: types.stripDefault(types.number, 0),
          /**
           * #property
           */
          sashimiArcsHeight: types.stripDefault(types.number, 40),
          /**
           * #property
           */
          readConnectionsHeight: types.stripDefault(types.number, 40),
          /**
           * #property
           */
          showSoftClipping: types.stripDefault(types.boolean, false),
        }),
      )
      .preProcessSnapshot((snap: Record<string, unknown> | undefined) =>
        migrateAlignmentsSnapshot(snap),
      )
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
           */
          contextMenuRefName: undefined as string | undefined,
          /**
           * #volatile
           */
          // Region index → grouped worker result. Ungrouped fetches store a
          // single group (key ''); grouping (Stage 5) stores N. Every reader
          // iterates `.groups`, so the ungrouped path is the one-group case.
          rpcDataMap: observable.map<number, GroupedAlignmentsResult>(),
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
          visibleModifications: observable.map<
            string,
            ModificationTypeWithColor
          >({}),
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
          return self.getConfWithOverride('scaleType')
        },
        /**
         * #getter
         */
        get autoscaleType() {
          return self.getConfWithOverride('autoscale')
        },
        /**
         * #getter
         */
        get minScore() {
          return self.getConfWithOverride('minScore')
        },
        /**
         * #getter
         */
        get maxScore() {
          return self.getConfWithOverride('maxScore')
        },
        /**
         * #getter
         */
        get minScoreBound() {
          const v = self.getConfWithOverride('minScore')
          return v !== Number.MIN_VALUE ? v : undefined
        },
        /**
         * #getter
         */
        get maxScoreBound() {
          const v = self.getConfWithOverride('maxScore')
          return v !== Number.MAX_VALUE ? v : undefined
        },
        /**
         * #getter
         */
        get numStdDev() {
          return self.getConfWithOverride('numStdDev')
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
        get visibleModificationTypes() {
          return [...self.visibleModifications.keys()]
        },

        /**
         * #getter
         */
        get colorBy(): ColorBy {
          return self.getConfWithOverride('colorBy')
        },

        /**
         * #getter
         */
        get filterBy(): FilterBy {
          return self.getConfWithOverride('filterBy')
        },

        /**
         * #getter
         */
        get featureHeight() {
          return self.getConfWithOverride('featureHeight')
        },

        /**
         * #getter
         */
        get featureSpacing() {
          return self.getConfWithOverride('featureSpacing')
        },

        /**
         * #getter
         */
        get maxHeight() {
          return self.getConfWithOverride('maxHeight')
        },

        /**
         * #getter
         * Whether to draw the supporting-read count on each sashimi arc
         * (config slot `showSashimiLabels`, overridable from the track menu).
         */
        get showSashimiLabels() {
          return self.getConfWithOverride('showSashimiLabels')
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
        get mismatchAlpha() {
          return !!self.getOverride<boolean>('mismatchAlpha')
        },

        /**
         * #getter
         */
        get showLowFreqMismatches() {
          return !!self.getOverride<boolean>('showLowFreqMismatches')
        },

        /**
         * #getter
         */
        get showLegend() {
          // Opt-in: the floating color legend is hidden by default for every
          // color scheme (including modifications) and shown only on demand via
          // the "Show legend" track-menu item, rather than eagerly covering the
          // top of every alignments track.
          return self.getOverride<boolean>('showLegend') ?? false
        },

        /**
         * #getter
         */
        get sortedBy() {
          return self.getOverride<SortedBy>('sortedBy')
        },

        /**
         * #getter
         * In-track stacked grouping dimension (undefined = ungrouped). Sent to
         * the worker via rpcProps; the worker partitions one fetch into N
         * sections.
         */
        get groupBy() {
          return self.getOverride<GroupBy>('groupBy')
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
         * Whether a stacked group carries a pileup-height override — i.e. it's
         * been expanded past (or dragged off) the fit-to-viewport budget. Drives
         * the group label's expand/restore affordance.
         */
        isGroupExpanded(key: string) {
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
          return computeVisibleCoverageStats(covBlocks, b => b.cov)
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
         * #method
         */
        legendItems() {
          return getReadDisplayLegendItems(
            this.colorBy,
            this.colorLegendCategories,
            this.colorPalette,
            self.visibleModifications,
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
            sashimiArcsMode: self.sashimiArcsMode,
            sashimiArcsHeight: self.sashimiArcsHeight,
            hasSashimiArcs: anyGroupHasSashimi(
              self.rpcDataMap,
              self.minSashimiScore,
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
          const rowHeight = this.featureHeight + this.featureSpacing
          const order = this.groupOrder
          const maxHeightRows = maxRowsFor(this.maxHeight, rowHeight)
          const defaultMaxRows =
            order.length > 1
              ? fitGroupMaxRows({
                  height: self.height,
                  groupCount: order.length,
                  rowHeight,
                  overhead: belowCoverageBandsGeometry(
                    this.belowCoverageBandsInput,
                  ).bottom,
                  maxRows: maxHeightRows,
                })
              : maxHeightRows
          const maxRowsOverrides = new Map<string, number>()
          for (const [key, px] of self.groupMaxHeightOverrides) {
            maxRowsOverrides.set(key, maxRowsFor(px, rowHeight))
          }
          return buildLaidOutByGroup({
            order,
            rawByGroup: this.rawDataByGroup,
            isChainMode: self.isChainMode,
            sortedBy: this.sortedBy,
            showSoftClipping: self.showSoftClipping,
            maxRows: defaultMaxRows,
            maxRowsOverrides,
            showLinkedReadLines: self.showLinkedReadLines,
            colorBy: this.colorBy,
            colorTagMap: self.colorTagMap,
          })
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
         * single-section/ungrouped path (`totalPileupHeight`, `searchFeatureByID`,
         * and the no-data synthetic section in `sections`). Grouped layout sizes
         * each section from its own `groupMaxY`; don't use this as a cross-group
         * aggregate.
         */
        get maxY() {
          return groupMaxY(this.laidOutPileupMap)
        },

        /**
         * #getter
         * True when any group hit `maxHeight` and overflow reads were collapsed —
         * drives the "max height reached" / "show all" banner. Skipped when
         * grouped: there the default cap is the fit-to-viewport budget, not the
         * global `maxHeight`, so raising `maxHeight` wouldn't lift the truncation
         * — expanding the group does. Ungrouped (one group) still offers it.
         * Groups the user explicitly shrank (a per-group height drag) are also
         * skipped: that truncation is intentional.
         */
        get pileupTruncated() {
          if (this.groupOrder.length > 1) {
            return false
          }
          for (const [key, map] of this.laidOutByGroup) {
            if (self.groupMaxHeightOverrides.has(key)) {
              continue
            }
            for (const data of map.values()) {
              if (data.truncated) {
                return true
              }
            }
          }
          return false
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
          const settings = {
            colorByType: self.arcColorByType,
            samplot: self.readConnections === 'samplot',
            drawInter: self.drawInter,
            drawLongRange: self.drawLongRange,
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
        get totalPileupHeight() {
          return self.maxY * (self.featureHeight + self.featureSpacing)
        },

        /**
         * #getter
         */
        get readIdIndexMap() {
          return buildReadIdIndexMap(self.rpcDataMap)
        },
      }))
      .views(self => ({
        /**
         * #getter
         */
        get readConnectionsLineWidth() {
          return self.getConfWithOverride('readConnectionsLineWidth')
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
            rowHeight: self.featureHeight + self.featureSpacing,
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
            pileupHeight: sec.pileupHeight,
          }))
        },

        /**
         * #getter
         * Per-section sashimi band placement, in stacking order. Each entry pairs
         * a group's raw data (sashimi counts live per-group) with the
         * content-space tops of *both* sub-bands: `coverageOverlayTop` for arcs
         * drawn over the coverage histogram and `sashimiBandTop` for arcs in the
         * reserved strip below it. In 'auto' both are used at once; 'up'/'down'
         * use one. The overlay and SVG export both map over this so their
         * geometry can't drift; ungrouped is the single-section case (sticky band
         * below sticky coverage, raw map == the only group). Empty when sashimi
         * is off.
         */
        get sashimiSections() {
          if (!self.showSashimiArcs || !self.showCoverage) {
            return []
          }
          const mode = self.sashimiArcsMode
          const byGroup = self.rawDataByGroup
          const empty = new Map<number, PileupDataResult>()
          return this.sections.sections.map(sec => ({
            groupKey: sec.groupKey,
            rpcDataMap: byGroup.get(sec.groupKey) ?? empty,
            mode,
            // Content-space band tops; the overlay scrolls them for grouped, the
            // export reads them as-is (scrollTop 0).
            coverageOverlayTop: sec.coverageTop + YSCALEBAR_LABEL_OFFSET,
            sashimiBandTop: sec.sashimiBandTop,
          }))
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
         * Total scrollable content height. Ungrouped is just the pileup
         * (coverage is sticky); grouped is the full stacked-sections height.
         */
        get pileupContentHeight() {
          return this.isGrouped
            ? this.sections.contentHeight
            : self.totalPileupHeight
        },

        /**
         * #getter
         */
        get scalebarOverlapLeft() {
          const view = getContainingView(self) as {
            trackLabels?: string
          }
          if (view.trackLabels === 'overlapping') {
            const track = getContainingTrack(self)
            return measureText(getConf(track, 'name'), 12.8) + 100
          }
          return 0
        },

        /**
         * #getter
         */
        get showOutline() {
          return self.getOverride<boolean>('showOutline') ?? self.isChainMode
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
         * Screen boxes for the hovered read / chain, painted by the
         * `HighlightOverlay` div. Deliberately NOT part of `renderState`: the
         * hovered id changes on nearly every mousemove, and routing it through
         * the canvas would repaint the whole pileup each move.
         */
        get highlightBoxes() {
          const view = getContainingView(self) as LGV
          const chainIds =
            self.linkedReads === 'normal' ? self.highlightedChainIds : []
          const ids =
            chainIds.length > 0
              ? chainIds
              : self.featureIdUnderMouse
                ? [self.featureIdUnderMouse]
                : []
          return view.initialized
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
          const rowHeight = self.featureHeight + self.featureSpacing
          const top = yRow * rowHeight
          return [start, top, end, top + self.featureHeight]
        },

        /**
         * #method
         */
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
            drawSingletons: self.drawSingletons,
            drawProperPairs: self.drawProperPairs,
            linkedReads: self.linkedReads,
          }
        },

        /**
         * #getter
         */
        get renderState() {
          const view = getContainingView(self) as LGV
          if (!view.initialized) {
            return undefined
          }
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
            filterMismatchesByFrequency: !self.showLowFreqMismatches,
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
            readConnectionsLineWidth: self.readConnectionsLineWidth,
            arcsYDomainBp: this.arcsYDomainBp,
          }
        },

        // Floored at 1000bp to avoid near-zero division when all pairs are concordant.
        /**
         * #getter
         */
        get arcsYDomainBp() {
          if (self.readConnections !== 'samplot') {
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
          // arcsYDomainBp is only set in samplot mode, so this runs only then.
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
        const superSetRegionTooLarge = self.setRegionTooLarge
        function addModification(modType: string) {
          if (!self.visibleModifications.has(modType)) {
            self.visibleModifications.set(modType, {
              type: modType,
              base: '',
              strand: '',
              color: getColorForModification(modType),
            })
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
          self.showSashimiArcs = show
          // Sashimi only renders over the coverage band, so making it visible
          // requires coverage. Keep this invariant here, not in the menu
          // handler, so it holds for every caller.
          if (show) {
            self.showCoverage = true
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
          setRegionTooLarge(val: boolean, reason?: string) {
            superSetRegionTooLarge(val, reason)
            if (val) {
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
            self.setRegionTooLarge(false)
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
            if (self.scrollTop !== scrollTop) {
              self.scrollTop = scrollTop
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
            const current = self.getOverride<ColorBy>('colorBy')
            if (colorBy.type !== 'tag' || colorBy.tag !== current?.tag) {
              self.colorTagMap = {}
            }
            self.setOverride('colorBy', colorBy)
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
            self.setOverride('filterBy', filterBy)
          },

          /**
           * #action
           */
          setShowOutline(show: boolean | undefined) {
            self.setOverride('showOutline', show)
          },

          /**
           * #action
           */
          toggleSoftClipping() {
            self.showSoftClipping = !self.showSoftClipping
          },

          /**
           * #action
           */
          toggleMismatchAlpha() {
            self.setOverride(
              'mismatchAlpha',
              !self.getOverride<boolean>('mismatchAlpha'),
            )
          },

          /**
           * #action
           */
          toggleShowLowFreqMismatches() {
            self.setOverride(
              'showLowFreqMismatches',
              !self.showLowFreqMismatches,
            )
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
              self.setOverride('sortedBy', {
                type,
                pos: Math.round(centerLineInfo.offset),
                refName: centerLineInfo.refName,
                assemblyName: centerLineInfo.assemblyName,
                tag,
              })
            } else if (needsPos) {
              getSession(self).notify(
                'Cannot sort: the view center line is not over a valid position. Scroll so the center line is within a region and try again.',
                'warning',
              )
            } else {
              const assemblyName = view.assemblyNames[0]
              if (assemblyName) {
                self.setOverride('sortedBy', {
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
          setSortedByAtPosition(type: string, pos: number, refName: string) {
            const view = getContainingView(self) as LGV
            const assemblyName = view.assemblyNames[0]
            if (assemblyName) {
              self.setOverride('sortedBy', {
                type,
                pos,
                refName,
                assemblyName,
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
            self.clearOverride('sortedBy')
          },

          /**
           * #action
           * Set (or clear, when undefined) the in-track stacked grouping
           * dimension. A tier-1 refetch setting (in `rpcProps`) — the worker
           * re-partitions the fetch into N sections. Resets the Y scroll since
           * the stacked content height changes.
           */
          setGroupBy(groupBy?: GroupBy) {
            if (groupBy) {
              self.setOverride('groupBy', groupBy)
            } else {
              self.clearOverride('groupBy')
            }
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
            // keep scroll within the shrunken bounds
            self.scrollTop = Math.min(self.scrollTop, self.scrollableHeight)
          },

          /**
           * #action
           * Expand a fit-to-viewport group back to the full `maxHeight` cap (show
           * all its reads), or, if it already carries a height override (from
           * expand or a drag), drop the override to return it to the fit budget.
           * Expanding makes the stack overflow the viewport, which engages the
           * pileup scroll. Pairs with `isGroupExpanded`.
           */
          toggleGroupExpanded(key: string) {
            if (self.groupMaxHeightOverrides.has(key)) {
              self.groupMaxHeightOverrides.delete(key)
            } else {
              self.groupMaxHeightOverrides.set(key, self.maxHeight)
            }
            // keep scroll within the shrunken bounds
            self.scrollTop = Math.min(self.scrollTop, self.scrollableHeight)
          },

          /**
           * #action
           * Drag a stacked group's pileup band taller/shorter by `dy` px, capping
           * how many rows that group lays out; one row is the floor.
           *
           * The override accumulates continuously across drag frames. It must not
           * re-seed from the section's displayed `pileupHeight` each frame: that
           * height is row-snapped (`maxY * rowHeight`) and content-capped, so a
           * sub-row `dy` rounds away to nothing while a sub-row negative `dy`
           * snaps off a whole row — the drag stutters and biases toward shrinking.
           * Instead grow the stored px value directly, seeding from the displayed
           * height only on the first frame. When the override already runs past
           * the real content (displayed height < override), clamp back to one row
           * of headroom so reversing the drag responds immediately.
           */
          resizeGroupHeight(key: string, dy: number) {
            const rowHeight = self.featureHeight + self.featureSpacing
            const displayed =
              self.sections.sections.find(s => s.groupKey === key)
                ?.pileupHeight ?? 0
            const existing = self.groupMaxHeightOverrides.get(key)
            const base =
              existing === undefined
                ? displayed
                : Math.min(existing, displayed + rowHeight)
            self.groupMaxHeightOverrides.set(
              key,
              Math.max(rowHeight, base + dy),
            )
            // keep scroll within the shrunken bounds
            self.scrollTop = Math.min(self.scrollTop, self.scrollableHeight)
          },

          /**
           * #action
           */
          setScaleType(val: string) {
            self.setOverride('scaleType', val)
          },

          /**
           * #action
           */
          setAutoscale(val?: string) {
            self.setOverride('autoscale', val)
          },

          /**
           * #action
           */
          setMinScore(val?: number) {
            self.setOverride('minScore', val)
          },

          /**
           * #action
           */
          setMaxScore(val?: number) {
            self.setOverride('maxScore', val)
          },

          /**
           * #action
           */
          setFeatureHeight(height?: number) {
            self.setOverride('featureHeight', height)
            self.scrollTop = 0
          },

          /**
           * #action
           */
          setFeatureSpacing(spacing?: number) {
            self.setOverride('featureSpacing', spacing)
            self.scrollTop = 0
          },

          /**
           * #action
           */
          setMaxHeight(height?: number) {
            self.setOverride('maxHeight', height)
            self.scrollTop = 0
          },

          // duck-typed by LGV/BreakpointSplitView/LinearComparativeView "Compact all tracks"
          /**
           * #action
           */
          setCompactness(level: CompactnessLevel) {
            const { featureHeight, featureSpacing } = COMPACTNESS_PRESETS[level]
            self.setOverride('featureHeight', featureHeight)
            self.setOverride('featureSpacing', featureSpacing)
            self.scrollTop = 0
          },

          /**
           * #action
           */
          setShowSashimiArcs,

          /**
           * #action
           */
          setReadConnections(mode: ReadConnectionsMode) {
            self.readConnections = mode
          },

          /**
           * #action
           */
          // Shared below-coverage band orientation for both read-connection
          // arcs and sashimi arcs. Single source of truth — there is no
          // per-feature direction to keep in sync.
          setReadConnectionsDown(down: boolean) {
            self.readConnectionsDown = down
          },

          /**
           * #action
           */
          setShowCoverage(show: boolean) {
            self.showCoverage = show
          },

          /**
           * #action
           */
          setShowPileup(show: boolean) {
            self.showPileup = show
          },

          /**
           * #action
           */
          setCoverageHeight(height: number) {
            self.coverageHeight = Math.max(MIN_BAND_HEIGHT, height)
          },

          /**
           * #action
           */
          setReadConnectionsHeight(height: number) {
            self.readConnectionsHeight = Math.max(MIN_BAND_HEIGHT, height)
          },

          /**
           * #action
           */
          setSashimiArcsHeight(height: number) {
            self.sashimiArcsHeight = Math.max(MIN_BAND_HEIGHT, height)
          },

          /**
           * #action
           */
          setMinSashimiScore(score: number) {
            self.minSashimiScore = score
          },

          /**
           * #action
           */
          setSashimiArcsMode(mode: SashimiArcsMode) {
            self.sashimiArcsMode = mode
          },

          /**
           * #action
           */
          setShowSashimiLabels(show: boolean) {
            self.setOverride('showSashimiLabels', show)
          },

          /**
           * #action
           */
          setReadConnectionsLineWidth(width: number) {
            self.setOverride('readConnectionsLineWidth', width)
          },

          /**
           * #action
           */
          setDrawInter(draw: boolean) {
            self.drawInter = draw
          },

          /**
           * #action
           */
          setDrawLongRange(draw: boolean) {
            self.drawLongRange = draw
          },

          /**
           * #action
           */
          setColorByType(type: ArcColorByType) {
            self.arcColorByType = type
          },

          /**
           * #action
           */
          setShowMismatches(show: boolean) {
            self.showMismatches = show
          },

          /**
           * #action
           */
          setShowLegend(show: boolean | undefined) {
            self.setOverride('showLegend', show)
          },

          /**
           * #action
           */
          setDrawSingletons(flag: boolean) {
            self.drawSingletons = flag
          },

          /**
           * #action
           */
          setDrawProperPairs(flag: boolean) {
            self.drawProperPairs = flag
          },

          /**
           * #action
           */
          setShowInterbaseIndicators(show: boolean) {
            self.showInterbaseIndicators = show
          },

          /**
           * #action
           */
          setFlipStrandLongReadChains(flag: boolean) {
            self.flipStrandLongReadChains = flag
          },

          /**
           * #action
           */
          setLinkedReads(mode: LinkedReadsMode) {
            const prev = self.linkedReads
            self.linkedReads = mode
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
              if (mode === 'off') {
                self.setOverride('colorBy', { type: 'normal' })
              } else {
                self.setOverride('colorBy', {
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
            self.showBezierConnections = flag
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
          setContextMenuCoord(coord?: [number, number]) {
            self.contextMenuCoord = coord
          },

          /**
           * #action
           */
          setContextMenuCigarHit(hit?: CigarHitResult) {
            self.contextMenuCigarHit = hit
          },

          /**
           * #action
           */
          setContextMenuIndicatorHit(hit?: IndicatorHitResult) {
            self.contextMenuIndicatorHit = hit
          },

          /**
           * #action
           */
          clearContextMenu() {
            self.contextMenuCoord = undefined
            self.contextMenuFeature = undefined
            self.contextMenuCigarHit = undefined
            self.contextMenuIndicatorHit = undefined
          },

          /**
           * #action
           */
          setContextMenuRefName(refName?: string) {
            self.contextMenuRefName = refName
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
            render: b => {
              const state = self.renderState
              if (!state || self.laidOutPileupMap.size === 0) {
                return false
              }
              return b.renderBlocks(self.renderBlocks, state)
            },
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
           */
          async setContextMenuFeatureById(featureId: string) {
            await fetchAndDo(featureId, feat => {
              self.setContextMenuFeature(feat)
            })
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
              sessionId,
              adapterConfig,
              sequenceAdapter,
              regions: [region],
              ...self.rpcProps(),
              stopToken,
              statusCallback: self.makeStatusCallback(),
            },
          )

          return { displayedRegionIndex, result }
        }

        return {
          /**
           * #action
           */
          getByteEstimateConfig() {
            const view = getContainingView(self) as LGV
            return {
              adapterConfig: self.adapterConfig,
              fetchSizeLimit: self.getConfWithOverride('fetchSizeLimit'),
              userByteSizeLimit: self.userByteSizeLimit,
              visibleBp: view.visibleBp,
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
              arcColor:
                self.readConnections !== 'off'
                  ? {
                      current: self.arcColorByType,
                      setColor: (type: ArcColorByType) => {
                        self.setColorByType(type)
                      },
                    }
                  : undefined,
            }),
            getSortByMenuItem(self),
            getFiltersMenuItem(self),
            getGroupByMenuItem(self),
            getReadsMenuItem(self, { showPairFilters: self.isChainMode }),
            getFeatureHeightMenuItem(self),
            getCoverageMenuItem(self),
            getReadConnectionsMenuItem(self),
          ] satisfies MenuItem[]
        },

        /**
         * #method
         */
        contextMenuItems() {
          const feat = self.contextMenuFeature
          const cigarHit = self.contextMenuCigarHit
          const indicatorHit = self.contextMenuIndicatorHit
          const items: MenuItem[] = []

          if (cigarHit) {
            const typeLabel = CIGAR_TYPE_LABELS[cigarHit.type] ?? cigarHit.type
            const isInterbase = ['insertion', 'softclip', 'hardclip'].includes(
              cigarHit.type,
            )
            const sortType = isInterbase ? cigarHit.type : 'basePair'
            const sortLabel = isInterbase
              ? `Sort by ${typeLabel.toLowerCase()} at position`
              : 'Sort by base at position'
            items.push({
              label: typeLabel,
              type: 'subMenu',
              subMenu: [
                {
                  label: sortLabel,
                  icon: SwapVertIcon,
                  onClick: () => {
                    if (self.contextMenuRefName) {
                      self.setSortedByAtPosition(
                        sortType,
                        cigarHit.position,
                        self.contextMenuRefName,
                      )
                    }
                  },
                },
                {
                  label: `Open ${typeLabel.toLowerCase()} details`,
                  icon: MenuOpenIcon,
                  onClick: () => {
                    if (self.contextMenuRefName) {
                      openCigarWidget(self, cigarHit, self.contextMenuRefName)
                    }
                  },
                },
              ],
            })
          }

          if (indicatorHit) {
            items.push({
              label: 'Interbase',
              type: 'subMenu',
              subMenu: [
                {
                  label: `Sort by ${indicatorHit.indicatorType} at position`,
                  icon: SwapVertIcon,
                  onClick: () => {
                    if (self.contextMenuRefName) {
                      self.setSortedByAtPosition(
                        indicatorHit.indicatorType,
                        indicatorHit.position,
                        self.contextMenuRefName,
                      )
                    }
                  },
                },
              ],
            })
          }

          if (feat) {
            items.push(
              {
                label: 'Open feature details',
                icon: MenuOpenIcon,
                onClick: () => {
                  self.selectFeature(feat)
                },
              },
              {
                label: 'Copy info to clipboard',
                icon: ContentCopyIcon,
                onClick: async () => {
                  const session = getSession(self)
                  try {
                    const { uniqueId, ...rest } = feat.toJSON()
                    const { default: copy } =
                      await import('@jbrowse/core/util/copyToClipboard')
                    copy(JSON.stringify(rest, null, 4))
                    session.notify('Copied to clipboard', 'success')
                  } catch (e) {
                    console.error(e)
                    session.notifyError(`${e}`, e)
                  }
                },
              },
            )
          }

          return items
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
      }))
  )
}

export type LinearAlignmentsDisplayStateModel = ReturnType<
  typeof stateModelFactory
>
// interface (not type alias) breaks the circular reference TypeScript would
// encounter through React.lazy → PileupComponent → useAlignmentsBase → model
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface LinearAlignmentsDisplayModel extends Instance<LinearAlignmentsDisplayStateModel> {}
