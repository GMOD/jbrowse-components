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
import {
  attachLinkedReadLines,
  buildLaidOutChainMap,
} from './computeChainLayout.ts'
import { ColorScheme } from './constants.ts'
import { computeInsertSizeTicks } from './insertSizeTicks.ts'
import { migrateAlignmentsSnapshot } from './migrateAlignmentsSnapshot.ts'
import { overlayReadTagColors } from './readTagColors.ts'
import { buildLaidOutPileupMap } from '../RenderAlignmentDataRPC/sortLayout.ts'
import { computeHighlightBoxes } from './components/computeHighlightBoxes.ts'
import { computeVisibleLabels } from './components/computeVisibleLabels.ts'
import {
  arcsToRegionResult,
  computeArcsFromPileupData,
  groupArcsByRef,
} from '../features/arcs/compute.ts'
import { getReadDisplayLegendItems } from '../shared/legendUtils.ts'
import { getColorForModification } from '../util.ts'
import { CIGAR_TYPE_LABELS } from './components/alignmentComponentUtils.ts'
import { openCigarWidget } from './components/openFeatureWidget.ts'
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
import { computeArcBand } from './renderers/rendererTypes.ts'

import type { LinearAlignmentsDisplayConfigModel } from './configSchema.ts'
import type { LinkedReadsMode, ReadConnectionsMode } from './constants.ts'
import type { ColorPalette } from './renderers/AlignmentsRenderer.ts'
import type { CigarHitResult } from '../shared/hitTestTypes.ts'
import type { TooltipPayload } from './components/tooltipUtils.ts'
import type { PileupDataResult } from '../RenderAlignmentDataRPC/types'
import type { CompactnessLevel } from './menus/featureSize.ts'
import type { AlignmentsRenderingBackend } from './renderers/rendererTypes.ts'
import type { ArcsUploadData } from '../features/arcs/types.ts'
import type { IndicatorHitResult } from '../features/indicator/types.ts'
import type {
  ArcColorByType,
  ColorBy,
  FilterBy,
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

// Max pileup rows the layout may produce before overflow reads collapse to the
// bottom. Hard-capped below the Uint16 ceiling so row indices (stored in
// `readYs`) and the overflow sentinel never wrap.
export function maxRowsFor(maxHeight: number, rowHeight: number) {
  return Math.max(
    1,
    Math.min(65534, Math.floor(maxHeight / Math.max(1, rowHeight))),
  )
}

// colorBy.type → shader colorScheme index. Aliases listed explicitly:
//   stranded → firstOfPairStrand
//   methylation → modifications (same shader path, different config)
//   perBaseQuality / perBaseLetter → normal (the per-base overlay paints
//     colored rects on top of a neutral read body; shader uses normal coloring
//     for the background pass).
const COLOR_BY_TO_SCHEME: Record<string, number> = {
  normal: ColorScheme.normal,
  strand: ColorScheme.strand,
  mappingQuality: ColorScheme.mappingQuality,
  insertSize: ColorScheme.insertSize,
  insertSizeGradient: ColorScheme.insertSizeGradient,
  firstOfPairStrand: ColorScheme.firstOfPairStrand,
  stranded: ColorScheme.firstOfPairStrand,
  pairOrientation: ColorScheme.pairOrientation,
  insertSizeAndOrientation: ColorScheme.insertSizeAndOrientation,
  modifications: ColorScheme.modifications,
  methylation: ColorScheme.modifications,
  bisulfite: ColorScheme.modifications,
  tag: ColorScheme.tag,
  perBaseQuality: ColorScheme.normal,
  // Like perBaseQuality, the read body uses the normal shader path; the
  // per-base nucleotide quads paint over it (see showPerBaseLetter).
  perBaseLetter: ColorScheme.normal,
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
          'readConnectionsLineWidth',
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
          linkedReads: types.optional(
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
          showBezierConnections: false,
          /**
           * #property
           */
          showCoverage: true,
          /**
           * #property
           */
          coverageHeight: 45,
          /**
           * #property
           */
          showMismatches: true,
          /**
           * #property
           */
          showInterbaseIndicators: true,
          /**
           * #property
           */
          drawSingletons: true,
          /**
           * #property
           */
          drawProperPairs: true,
          /**
           * #property
           */
          flipStrandLongReadChains: true,
          /**
           * #property
           */
          drawInter: true,
          /**
           * #property
           */
          drawLongRange: true,
          /**
           * #property
           */
          arcColorByType: types.optional(
            arcColorByTypes,
            'insertSizeAndOrientation',
          ),
          /**
           * #property
           * read-connection rendering mode (mate pairs + split reads),
           * orthogonal to direction
           */
          readConnections: types.optional(
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
          readConnectionsDown: false,
          /**
           * #property
           */
          // Direction is the shared below-coverage band orientation
          // (`readConnectionsDown`), so sashimi stores only its own
          // visibility — one source of truth for direction, nothing to sync.
          showSashimiArcs: types.optional(types.boolean, true),
          /**
           * #property
           */
          sashimiArcsHeight: 40,
          /**
           * #property
           */
          readConnectionsHeight: 40,
          /**
           * #property
           */
          showSoftClipping: false,
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
          rpcDataMap: observable.map<number, PileupDataResult>(),
          /**
           * #volatile
           * pileup vertical scroll offset in px. Also read by the
           * BreakpointSplitView overlay to position its SVG curves.
           */
          scrollTop: 0,
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
           */
          colorPalette: null as ColorPalette | null,
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
        get hasPairedReads() {
          return [...self.rpcDataMap.values()].some(
            d => d.insertSizeStats !== undefined,
          )
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
         */
        get chainIdMap() {
          const map = new Map<number, string[]>()
          if (self.linkedReads !== 'off') {
            for (const data of self.rpcDataMap.values()) {
              if (!data.readChainIndices) {
                continue
              }
              for (let i = 0; i < data.readIds.length; i++) {
                const chainIdx = data.readChainIndices[i]!
                let ids = map.get(chainIdx)
                if (!ids) {
                  ids = []
                  map.set(chainIdx, ids)
                }
                const id = data.readIds[i]
                if (id !== undefined) {
                  ids.push(id)
                }
              }
            }
          }
          return map
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
          const override = self.getOverride<boolean>('showLegend')
          return override !== undefined
            ? override
            : this.legendItems().length > 1
        },

        /**
         * #getter
         */
        get sortedBy() {
          return self.getOverride<SortedBy>('sortedBy')
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
          return computeVisibleCoverageStats(view.coarseDynamicBlocks, b =>
            b.displayedRegionIndex === undefined
              ? undefined
              : self.rpcDataMap.get(b.displayedRegionIndex),
          )
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
         * #method
         */
        legendItems() {
          return getReadDisplayLegendItems(
            this.colorBy,
            self.visibleModifications,
          )
        },

        /**
         * #getter
         */
        get laidOutPileupMap() {
          const base =
            self.linkedReads === 'normal'
              ? buildLaidOutChainMap(self.rpcDataMap)
              : buildLaidOutPileupMap({
                  dataMap: self.rpcDataMap,
                  sortedBy: this.sortedBy,
                  showSoftClipping: self.showSoftClipping,
                  maxRows: maxRowsFor(
                    self.getConfWithOverride('maxHeight'),
                    self.getConfWithOverride('featureHeight') +
                      self.getConfWithOverride('featureSpacing'),
                  ),
                })
          const laidOut = self.showLinkedReadLines
            ? attachLinkedReadLines(base)
            : base
          // Tag colors are baked here (not in the worker) so colorTagMap stays
          // a main-thread tier-2 setting — see readTagColors.ts.
          return overlayReadTagColors(laidOut, this.colorBy, self.colorTagMap)
        },

        /**
         * #getter
         */
        get maxY() {
          let max = 0
          for (const data of this.laidOutPileupMap.values()) {
            if (data.maxY > max) {
              max = data.maxY
            }
          }
          return max
        },

        /**
         * #getter
         * True when any displayed region hit `maxRows` and overflow reads were
         * collapsed — drives the "max height reached" indicator.
         */
        get pileupTruncated() {
          for (const data of this.laidOutPileupMap.values()) {
            if (data.truncated) {
              return true
            }
          }
          return false
        },

        // The heavy work — running `computeArcsFromPileupData` over every
        // pileup region — is cached here. Arcs/lines are pre-grouped by refName
        // so the per-region arcsRpcDataMap lookup is O(1) instead of filtering
        // every arc per displayed region.
        /**
         * #getter
         */
        get arcsComputed() {
          if (self.readConnections === 'off' || self.rpcDataMap.size === 0) {
            return undefined
          }
          const regionInfos = [...self.loadedRegions.entries()]
            .filter(([idx]) => self.rpcDataMap.has(idx))
            .map(([displayedRegionIndex, r]) => ({
              refName: r.refName,
              start: r.start,
              end: r.end,
              displayedRegionIndex,
            }))
          const { arcs, lines } = computeArcsFromPileupData(
            self.rpcDataMap,
            regionInfos,
            {
              colorByType: self.arcColorByType,
              samplot: self.readConnections === 'samplot',
              drawInter: self.drawInter,
              drawLongRange: self.drawLongRange,
            },
          )
          return { ...groupArcsByRef(arcs, lines), regionInfos }
        },

        /**
         * #getter
         */
        get arcsRpcDataMap() {
          const computed = this.arcsComputed
          if (!computed) {
            return new Map()
          }
          const { arcsByRef, linesByRef, regionInfos } = computed
          const out = new Map<number, ArcsUploadData>()
          for (const ri of regionInfos) {
            out.set(
              ri.displayedRegionIndex,
              arcsToRegionResult(
                arcsByRef.get(ri.refName) ?? [],
                linesByRef.get(ri.refName) ?? [],
              ),
            )
          }
          return out
        },
      }))
      .views(self => ({
        /**
         * #getter
         */
        get modificationThreshold() {
          return self.colorBy.modifications?.threshold ?? 10
        },

        /**
         * #getter
         */
        get colorSchemeIndex() {
          return COLOR_BY_TO_SCHEME[self.colorBy.type] ?? ColorScheme.normal
        },

        /**
         * #getter
         */
        get showModifications() {
          const t = self.colorBy.type
          return ['modifications', 'methylation', 'bisulfite'].includes(t)
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
          const map = new Map<
            string,
            { displayedRegionIndex: number; idx: number }
          >()
          for (const [displayedRegionIndex, rpcData] of self.rpcDataMap) {
            for (let i = 0; i < rpcData.readIds.length; i++) {
              const id = rpcData.readIds[i]
              if (id !== undefined) {
                map.set(id, { displayedRegionIndex, idx: i })
              }
            }
          }
          return map
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
          const { displayedRegionIndex, idx } = entry
          const rpcData = self.laidOutPileupMap.get(displayedRegionIndex)
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
         * True when any loaded region has splice junctions to draw as sashimi
         * arcs. Drives whether the below-coverage band reserves space.
         */
        get hasSashimiArcs() {
          return [...self.rpcDataMap.values()].some(d => d.sashimiX1.length > 0)
        },

        /**
         * #getter
         * Geometry of the bands stacked below coverage in arcs-down mode, top to
         * bottom: coverage → paired-end arcs → sashimi. Single source of truth so
         * the layout height, the renderers, and the three resize handles can't
         * drift apart. `arcsBandTop`/`sashimiBandTop` are each band's top edge;
         * `bottom` is where the pileup begins (== coverageDisplayHeight).
         */
        get belowCoverageBands() {
          const arcsOn = self.readConnections !== 'off'
          const coverageBand = self.showCoverage ? self.coverageHeight : 0
          // Arcs reserve their own band whenever they aren't overlaying the
          // coverage histogram: down mode always, and up mode when coverage is
          // hidden (nothing to overlay). The pileup then starts below them.
          const hasArcsBand =
            arcsOn && (self.readConnectionsDown || !self.showCoverage)
          const hasSashimiBand =
            self.showSashimiArcs &&
            self.readConnectionsDown &&
            self.showCoverage &&
            this.hasSashimiArcs
          const arcsBandTop = coverageBand
          const sashimiBandTop =
            arcsBandTop + (hasArcsBand ? self.readConnectionsHeight : 0)
          const bottom =
            sashimiBandTop + (hasSashimiBand ? self.sashimiArcsHeight : 0)
          return {
            hasArcsBand,
            hasSashimiBand,
            arcsBandTop,
            sashimiBandTop,
            bottom,
          }
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
         */
        get pileupViewportHeight() {
          return Math.max(0, self.height - self.coverageDisplayHeight)
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
            laidOutPileupMap: self.laidOutPileupMap,
            height: self.height,
            featureHeight: self.featureHeight,
            featureSpacing: self.featureSpacing,
            showMismatches: self.showMismatches,
            topOffset: self.coverageDisplayHeight,
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
                laidOutPileupMap: self.laidOutPileupMap,
                readIdIndexMap: self.readIdIndexMap,
                ids,
                height: self.height,
                featureHeight: self.featureHeight,
                featureSpacing: self.featureSpacing,
                topOffset: self.coverageDisplayHeight,
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
          return Math.max(0, self.totalPileupHeight - self.pileupViewportHeight)
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
          const palette = self.colorPalette
          if (!view.initialized || !palette) {
            return undefined
          }
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
          let maxBp = 0
          for (const data of self.arcsRpcDataMap.values()) {
            if (data.maxFlatArcYBp > maxBp) {
              maxBp = data.maxFlatArcYBp
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
          if (self.highlightedChainIds.length > 0) {
            self.highlightedChainIds = []
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
            data: PileupDataResult | null,
          ) {
            if (data) {
              self.rpcDataMap.set(displayedRegionIndex, data)
              for (const modType of data.detectedModifications) {
                addModification(modType)
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
          setColorPalette(palette: ColorPalette | null) {
            self.colorPalette = palette
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
          setShowSashimiArcs(show: boolean) {
            self.showSashimiArcs = show
            // Sashimi only renders over the coverage band, so making it
            // visible requires coverage. Keep this invariant in the action,
            // not in the menu handler, so it holds for every caller.
            if (show) {
              self.showCoverage = true
            }
          },

          /**
           * #action
           */
          toggleSashimiArcs() {
            const show = !self.showSashimiArcs
            self.showSashimiArcs = show
            if (show) {
              self.showCoverage = true
            }
          },

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
          setCoverageHeight(height: number) {
            self.coverageHeight = height
          },

          /**
           * #action
           */
          setReadConnectionsHeight(height: number) {
            self.readConnectionsHeight = height
          },

          /**
           * #action
           */
          setSashimiArcsHeight(height: number) {
            self.sashimiArcsHeight = height
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
          }) {
            self.overCigarItem = state.overCigarItem
            self.featureIdUnderMouse = state.featureIdUnderMouse
            self.mouseoverExtraInformation = state.mouseoverExtraInformation
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
                laidOutPileupMap: self.laidOutPileupMap,
                arcsRpcDataMap: self.arcsRpcDataMap,
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
              statusCallback: (msg: string) => {
                if (isAlive(self)) {
                  self.setStatusMessage(msg)
                }
              },
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

              const newDataMap = new Map<number, PileupDataResult>()
              self.setModificationsReady(true)
              for (const r of results) {
                if (r.result.newTagValues) {
                  self.updateColorTagMap(r.result.newTagValues)
                }
                newDataMap.set(r.displayedRegionIndex, r.result)
              }
              // Assigning colorTagMap (above) re-runs laidOutPileupMap, which
              // bakes readTagColors on the main thread — no refetch needed, so
              // there is no feedback loop. Order vs setRpcData no longer
              // matters: the laidOutPileupMap getter recomputes on either.
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
            getFiltersMenuItem(self, { showPairFilters: self.isChainMode }),
            getGroupByMenuItem(self),
            getReadsMenuItem(self),
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
                  openFeatureWidget(self, feat.toJSON(), {
                    widget: {
                      type: 'AlignmentsFeatureWidget',
                      id: 'alignmentFeature',
                    },
                  })
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
