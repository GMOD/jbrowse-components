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
import { buildLaidOutChainMap } from './computeChainLayout.ts'
import { ColorScheme } from './constants.ts'
import { computeInsertSizeTicks } from './insertSizeTicks.ts'
import { migrateAlignmentsSnapshot } from './migrateAlignmentsSnapshot.ts'
import { buildLaidOutPileupMap } from '../RenderPileupDataRPC/sortLayout.ts'
import { computeVisibleLabels } from './components/computeVisibleLabels.ts'
import {
  arcsToRegionResult,
  computeArcsFromPileupData,
  groupArcsByRef,
} from '../features/arcs/compute.ts'
import { getReadDisplayLegendItems } from '../shared/legendUtils.ts'
import {
  ARC_DIRECTION_OPTIONS,
  COMPACTNESS_PRESETS,
  LINKED_READS_OPTIONS,
  PAIRED_ARCS_OPTIONS,
  getColorByMenuItem,
  getCoverageMenuItem,
  getFiltersMenuItem,
  getGroupByMenuItem,
  getReadsMenuItem,
  getSortByMenuItem,
  radioModeMenuItem,
} from '../shared/menus/index.ts'
import { getColorForModification } from '../util.ts'
import { CIGAR_TYPE_LABELS } from './components/alignmentComponentUtils.ts'
import { openCigarWidget } from './components/openFeatureWidget.ts'

import type { ColorPalette } from './components/AlignmentsRenderer.ts'
import type {
  ArcDirection,
  LinkedReadsMode,
  PairedArcsMode,
} from './constants.ts'
import type { CigarHitResult } from '../shared/hitTestTypes.ts'
import type { AlignmentsBackend } from './components/rendererTypes.ts'
import type { TooltipPayload } from './components/tooltipUtils.ts'
import type { PileupDataResult } from '../RenderPileupDataRPC/types'
import type { ArcsDataResult } from '../features/arcs/compute.ts'
import type { IndicatorHitResult } from '../features/indicator/types.ts'
import type { CompactnessLevel } from '../shared/menus/featureSize.ts'
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

const AlignmentsComponent = lazy(
  () => import('./components/PileupComponent.tsx'),
)

const AlignmentsTooltip = lazy(
  () => import('./components/AlignmentsTooltip.tsx'),
)

export { ColorScheme } from './constants.ts'

// colorBy.type → shader colorScheme index. Aliases listed explicitly:
//   stranded → firstOfPairStrand
//   methylation → modifications (same shader path, different config)
//   perBaseQuality → normal (per-base quality paints colored rects on top
//     of a neutral read body via drawPerBaseQuality; shader uses normal
//     coloring for the background pass).
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
  tag: ColorScheme.tag,
  baseQuality: ColorScheme.baseQuality,
  perBaseQuality: ColorScheme.normal,
}

// Material UI 200-tone palette for color-by-tag values. The first value
// hit gets index 0, the eleventh wraps to index 0 again.

/**
 * State model factory for LinearAlignmentsDisplay
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
        ConfigOverrideMixin(),
        types.model({
          type: types.literal('LinearAlignmentsDisplay'),
          configuration: ConfigurationReference(configSchema),
          linkedReads: types.optional(
            types.enumeration<LinkedReadsMode>('LinkedReadsMode', [
              'off',
              'normal',
              'bezier',
            ]),
            'off',
          ),
          showCoverage: true,
          coverageHeight: 45,
          showMismatches: true,
          showInterbaseIndicators: true,
          showYScalebar: true,
          drawSingletons: true,
          drawProperPairs: true,
          flipStrandLongReadChains: true,
          lineWidthSetting: types.maybe(types.number),
          drawInter: true,
          drawLongRange: true,
          arcColorByType: types.optional(
            arcColorByTypes,
            'insertSizeAndOrientation',
          ),
          pairedArcs: types.optional(
            types.enumeration<PairedArcsMode>('PairedArcsMode', [
              'off',
              'up',
              'down',
              'samplot',
            ]),
            'off',
          ),
          sashimiArcs: types.optional(
            types.enumeration<ArcDirection>('SashimiArcsMode', [
              'off',
              'up',
              'down',
            ]),
            'up',
          ),
          sashimiArcsHeight: 40,
          arcsHeight: 40,
          showSoftClipping: false,
          jexlFilters: types.optional(types.array(types.string), []),
        }),
      )
      .preProcessSnapshot(
        // @ts-expect-error - MST's preProcessSnapshot typing can't verify the
        // return type against the model creation type
        (snap: Record<string, unknown> | undefined) =>
          migrateAlignmentsSnapshot(snap),
      )
      .volatile(() => ({
        featureIdUnderMouse: undefined as undefined | string,
        mouseoverExtraInformation: undefined as TooltipPayload | undefined,
        contextMenuFeature: undefined as Feature | undefined,
        contextMenuCoord: undefined as [number, number] | undefined,
        contextMenuCigarHit: undefined as CigarHitResult | undefined,
        contextMenuIndicatorHit: undefined as IndicatorHitResult | undefined,
        contextMenuRefName: undefined as string | undefined,
        rpcDataMap: observable.map<number, PileupDataResult>(),
        currentRangeY: [0, 600] as [number, number],
        highlightedChainIds: [] as string[],
        selectedChainIds: [] as string[],

        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
        colorTagMap: {} as Record<string, string>,
        visibleModifications: observable.map<string, ModificationTypeWithColor>(
          {},
        ),
        simplexModifications: new Set<string>(),
        modificationsReady: false,
        overCigarItem: false,
        colorPalette: null as ColorPalette | null,
      }))
      // `isChainMode` is its own getter — it's used in many places as a
      // domain concept ("are we drawing the chain layout?") that reads
      // better than the equivalent `linkedReads === 'normal'`.
      .views(self => ({
        get isChainMode() {
          return self.linkedReads === 'normal'
        },
      }))
      // Canonical ScoreScaleModel shape (shared with wiggle/manhattan) so the
      // coverage band reuses wiggle-core's score menu + SetMinMaxDialog with no
      // adapter shim. minScore/maxScore are raw (sentinels intact) for the
      // dialog; *Config strip the sentinels for domain bounds. Kept in its own
      // block so later getters reference them via `self`.
      .views(self => ({
        get scaleType() {
          return self.getConfWithOverride<string>('scaleType')
        },
        get autoscaleType() {
          return self.getConfWithOverride<string>('autoscale')
        },
        get minScore() {
          return self.getConfWithOverride<number>('minScore')
        },
        get maxScore() {
          return self.getConfWithOverride<number>('maxScore')
        },
        get minScoreConfig() {
          const v = self.getConfWithOverride<number>('minScore')
          return v !== Number.MIN_VALUE ? v : undefined
        },
        get maxScoreConfig() {
          const v = self.getConfWithOverride<number>('maxScore')
          return v !== Number.MAX_VALUE ? v : undefined
        },
        get numStdDev() {
          return self.getConfWithOverride<number>('numStdDev')
        },
      }))
      .views(self => ({
        get featureWidgetType() {
          return {
            type: 'AlignmentsFeatureWidget',
            id: 'alignmentFeature',
          }
        },

        get selectedFeatureId() {
          const { selection } = getSession(self)
          if (isFeature(selection)) {
            return selection.id()
          }
          return undefined
        },

        get DisplayMessageComponent() {
          return AlignmentsComponent
        },

        get TooltipComponent() {
          return AlignmentsTooltip
        },

        get visibleModificationTypes() {
          return [...self.visibleModifications.keys()]
        },

        get colorBy() {
          return self.getConfWithOverride<ColorBy>('colorBy')
        },

        get filterBy() {
          return self.getConfWithOverride<FilterBy>('filterBy')
        },

        get featureHeightSetting() {
          return self.getConfWithOverride<number>('featureHeight')
        },

        get featureSpacing() {
          return self.getConfWithOverride<number>('featureSpacing')
        },

        get maxHeight() {
          return self.getConfWithOverride<number>('maxHeight')
        },

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

        get mismatchAlpha() {
          return !!self.getOverride<boolean>('mismatchAlpha')
        },

        get showLegend() {
          return self.getOverride<boolean>('showLegend')
        },

        get sortedBy() {
          return self.getOverride<SortedBy>('sortedBy')
        },

        get coverageIsLog() {
          return self.scaleType === 'log'
        },

        get coverageStats() {
          if (!self.showCoverage) {
            return undefined
          }
          const view = getContainingView(self) as LGV
          if (!view.initialized) {
            return undefined
          }
          return computeVisibleCoverageStats(
            view.dynamicBlocks.contentBlocks,
            b => self.rpcDataMap.get(b.displayedRegionIndex!),
          )
        },

        get coverageDomain() {
          return this.coverageStats
            ? getNiceDomain({
                domain: domainFromStats(
                  this.coverageStats,
                  self.autoscaleType,
                  self.numStdDev,
                ),
                bounds: [self.minScoreConfig, self.maxScoreConfig],
                scaleType: self.scaleType,
              })
            : undefined
        },

        get coverageTicks() {
          return this.coverageDomain
            ? computeCoverageTicks(
                this.coverageDomain[1],
                self.coverageHeight,
                self.scaleType,
              )
            : undefined
        },

        get legendItems() {
          return getReadDisplayLegendItems(
            self.getOverride<ColorBy>('colorBy'),
            undefined,
            self.pairedArcs === 'samplot',
          )
        },

        get laidOutPileupMap() {
          if (self.linkedReads !== 'off') {
            return buildLaidOutChainMap(self.rpcDataMap, self.linkedReads)
          }
          return buildLaidOutPileupMap({
            dataMap: self.rpcDataMap,
            sortedBy: this.sortedBy,
            showSoftClipping: self.showSoftClipping,
          })
        },

        get maxY() {
          let max = 0
          for (const data of this.laidOutPileupMap.values()) {
            if (data.maxY > max) {
              max = data.maxY
            }
          }
          return max
        },

        // The heavy work — running `computeArcsFromPileupData` over every
        // pileup region — is cached here so that height changes (which only
        // affect the line-end Y values in the per-region pack) don't redo it.
        // Arcs/lines are also pre-grouped by refName so the per-region
        // arcsRpcDataMap lookup is O(1) instead of filtering every arc per
        // displayed region.
        get arcsComputed() {
          if (self.pairedArcs === 'off' || self.rpcDataMap.size === 0) {
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
              samplot: self.pairedArcs === 'samplot',
              drawInter: self.drawInter,
              drawLongRange: self.drawLongRange,
            },
          )
          return { ...groupArcsByRef(arcs, lines), regionInfos }
        },

        get arcsRpcDataMap() {
          const computed = this.arcsComputed
          if (!computed) {
            return new Map()
          }
          const { arcsByRef, linesByRef, regionInfos } = computed
          const out = new Map<number, ArcsDataResult>()
          for (const ri of regionInfos) {
            out.set(
              ri.displayedRegionIndex,
              arcsToRegionResult(
                arcsByRef.get(ri.refName) ?? [],
                linesByRef.get(ri.refName) ?? [],
                self.height,
              ),
            )
          }
          return out
        },
      }))
      .views(self => ({
        get modificationThreshold() {
          return self.colorBy.modifications?.threshold ?? 10
        },

        get colorSchemeIndex() {
          return COLOR_BY_TO_SCHEME[self.colorBy.type] ?? ColorScheme.normal
        },

        get showModifications() {
          const t = self.colorBy.type
          return t === 'modifications' || t === 'methylation'
        },

        get showPerBaseQuality() {
          return self.colorBy.type === 'perBaseQuality'
        },

        get totalPileupHeight() {
          return self.maxY * (self.featureHeightSetting + self.featureSpacing)
        },

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
        get lineWidth() {
          return self.lineWidthSetting ?? 1
        },

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
         * Compatibility getter for BreakpointSplitView overlay which reads
         * display.scrollTop to position SVG curves. The WebGL display manages
         * Y scrolling via currentRangeY[0] rather than the inherited scrollTop.
         */
        get scrollTop() {
          return self.currentRangeY[0]
        },

        get coverageDisplayHeight() {
          return (
            (self.showCoverage ? self.coverageHeight : 0) +
            (self.pairedArcs === 'down' ? self.arcsHeight : 0) +
            (self.sashimiArcs === 'down' && self.showCoverage
              ? self.sashimiArcsHeight
              : 0)
          )
        },
      }))
      .views(self => ({
        get pileupViewportHeight() {
          return Math.max(0, self.height - self.coverageDisplayHeight)
        },

        get scalebarOverlapLeft() {
          const view = getContainingView(self) as {
            trackLabelsSetting?: string
          }
          if (view.trackLabelsSetting === 'overlapping') {
            const track = getContainingTrack(self)
            return measureText(getConf(track, 'name'), 12.8) + 100
          }
          return 0
        },

        get showOutlineSetting() {
          return self.getOverride<boolean>('showOutline') ?? self.isChainMode
        },

        get visibleLabels() {
          const view = getContainingView(self) as LGV
          if (!view.initialized) {
            return []
          }
          return computeVisibleLabels({
            view,
            laidOutPileupMap: self.laidOutPileupMap,
            height: self.height,
            featureHeightSetting: self.featureHeightSetting,
            featureSpacing: self.featureSpacing,
            showMismatches: self.showMismatches,
            topOffset: self.coverageDisplayHeight,
            rangeY: self.currentRangeY,
          })
        },

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
          const rowHeight = self.featureHeightSetting + self.featureSpacing
          const top = yRow * rowHeight
          return [start, top, end, top + self.featureHeightSetting]
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
        get scrollableHeight() {
          return Math.max(0, self.totalPileupHeight - self.pileupViewportHeight)
        },

        // Only the tag NAME is sent to the worker (to extract per-read
        // sortTagValues). Wrapping as its own getter means rpcProps only
        // re-notifies when the tag itself changes — not when sort
        // position or sort type flips between non-tag flavors.
        get sortTag() {
          return self.sortedBy?.type === 'tag' ? self.sortedBy.tag : undefined
        },

        // Fields that invalidate the fetched pileup/chain data. Worker-
        // bound (filterBy, colorBy, …) plus the one main-thread decision
        // field that selects between pileup and chain RPC (linkedReads).
        // Arc-only fields (arcColorByType, drawInter, drawLongRange) are
        // NOT here — they are tracked by the arcsRpcDataMap computed
        // getter and do not require a refetch. Non-tag sort changes are
        // handled main-thread by laidOutPileupMap.
        rpcProps() {
          return {
            filterBy: self.filterBy,
            colorBy: self.colorBy,
            colorTagMap: self.colorTagMap,
            sortTag: this.sortTag,
            showSoftClipping: self.showSoftClipping,
            drawSingletons: self.drawSingletons,
            drawProperPairs: self.drawProperPairs,
            linkedReads: self.linkedReads,
          }
        },

        get renderState() {
          const view = getContainingView(self) as LGV
          const palette = self.colorPalette
          if (!view.initialized || !palette) {
            return undefined
          }
          return {
            rangeY: self.currentRangeY,
            colorScheme: self.colorSchemeIndex,
            featureHeight: self.featureHeightSetting,
            featureSpacing: self.featureSpacing,
            showCoverage: self.showCoverage,
            coverageHeight: self.coverageHeight,
            coverageYOffset: YSCALEBAR_LABEL_OFFSET,
            coverageMaxDepth: self.coverageDomain?.[1],
            coverageIsLog: self.coverageIsLog,
            showMismatches: self.showMismatches,
            showSoftClipping: self.showSoftClipping,
            showInterbaseIndicators: self.showInterbaseIndicators,
            showModifications: self.showModifications,
            showPerBaseQuality: self.showPerBaseQuality,
            showOutline: self.showOutlineSetting,
            pairedArcs: self.pairedArcs,
            arcsHeight: self.arcsHeight,
            pileupTopOffset: self.coverageDisplayHeight,
            canvasWidth: view.width,
            canvasHeight: self.height,
            highlightedFeatureId: self.featureIdUnderMouse,
            selectedFeatureId: self.selectedFeatureId,
            highlightedChainIds: self.highlightedChainIds,
            selectedChainIds: self.selectedChainIds,
            colors: palette,
            linkedReads: self.linkedReads,
            flipStrandLongReadChains: self.flipStrandLongReadChains,
            arcLineWidth: self.lineWidth,
            arcsYDomainBp: this.arcsYDomainBp,
          }
        },

        // Floored at 1000bp to avoid near-zero division when all pairs are concordant.
        get arcsYDomainBp() {
          if (self.pairedArcs !== 'samplot') {
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

        get insertSizeTicks() {
          const domain = this.arcsYDomainBp
          if (domain === undefined) {
            return undefined
          }
          // Samplot always overlays the coverage band pointing-up — the
          // arcsYDomainBp guard above ensures this getter only runs in
          // samplot mode. Fall back to 0 when coverage is hidden.
          return computeInsertSizeTicks({
            arcsYDomainBp: domain,
            arcsHeight: self.showCoverage ? self.coverageHeight : 0,
            pairedArcsDown: false,
            arcsTop: 0,
          })
        },
      }))
      .views(self => ({
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
        function setCurrentRangeY(rangeY: [number, number]) {
          const cur = self.currentRangeY
          if (cur[0] !== rangeY[0] || cur[1] !== rangeY[1]) {
            self.currentRangeY = rangeY
          }
        }
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
          clearMouseoverState,

          setError(error?: unknown) {
            superSetError(error)
            if (error) {
              clearMouseoverState()
            }
          },

          setRegionTooLarge(val: boolean, reason?: string) {
            superSetRegionTooLarge(val, reason)
            if (val) {
              clearMouseoverState()
            }
          },

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

          clearDisplaySpecificData() {
            self.rpcDataMap.clear()
            self.currentRangeY = [0, 0]
            self.setRegionTooLarge(false)
          },

          setOverCigarItem(flag: boolean) {
            self.overCigarItem = flag
          },

          setColorPalette(palette: ColorPalette | null) {
            self.colorPalette = palette
          },

          setScrollTop(scrollTop: number) {
            setCurrentRangeY([scrollTop, scrollTop + self.pileupViewportHeight])
          },

          setCurrentRangeY,

          setHighlightedChainIds(ids: string[]) {
            self.highlightedChainIds = ids
          },

          clearHighlights() {
            if (self.highlightedChainIds.length > 0) {
              self.highlightedChainIds = []
            }
          },

          clearSelection() {
            const session = getSession(self)
            if (isFeature(session.selection)) {
              session.clearSelection()
            }
            if (self.selectedChainIds.length > 0) {
              self.selectedChainIds = []
            }
          },

          setSelectedChainIds(ids: string[]) {
            self.selectedChainIds = ids
          },

          setColorScheme(colorBy: ColorBy) {
            const current = self.getOverride<ColorBy>('colorBy')
            if (colorBy.type !== 'tag' || colorBy.tag !== current?.tag) {
              self.colorTagMap = {}
            }
            self.setOverride('colorBy', colorBy)
          },

          updateColorTagMap(uniqueTag: string[]) {
            const { map, added } = updateColorTagMapPure(
              self.colorTagMap,
              uniqueTag,
            )
            self.colorTagMap = map
            return added
          },

          setFilterBy(filterBy: FilterBy) {
            self.setOverride('filterBy', filterBy)
          },

          setShowOutline(show: boolean | undefined) {
            self.setOverride('showOutline', show)
          },

          toggleSoftClipping() {
            self.showSoftClipping = !self.showSoftClipping
          },

          toggleMismatchAlpha() {
            self.setOverride(
              'mismatchAlpha',
              !self.getOverride<boolean>('mismatchAlpha'),
            )
          },

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

          clearSortedBy() {
            self.clearOverride('sortedBy')
          },

          setMaxHeight(n?: number) {
            self.setOverride('maxHeight', n)
          },

          setScaleType(val: string) {
            self.setOverride('scaleType', val)
          },

          setAutoscale(val?: string) {
            self.setOverride('autoscale', val)
          },

          setMinScore(val?: number) {
            self.setOverride('minScore', val)
          },

          setMaxScore(val?: number) {
            self.setOverride('maxScore', val)
          },

          setFeatureHeight(height?: number) {
            self.setOverride('featureHeight', height)
            self.currentRangeY = [0, 0]
          },

          setFeatureSpacing(spacing?: number) {
            self.setOverride('featureSpacing', spacing)
            self.currentRangeY = [0, 0]
          },

          // duck-typed by LGV/BreakpointSplitView/LinearComparativeView "Compact all tracks"
          setCompactness(level: CompactnessLevel) {
            const { featureHeight, featureSpacing } = COMPACTNESS_PRESETS[level]
            self.setOverride('featureHeight', featureHeight)
            self.setOverride('featureSpacing', featureSpacing)
            self.currentRangeY = [0, 0]
          },

          setSashimiArcs(mode: ArcDirection) {
            self.sashimiArcs = mode
          },

          setPairedArcs(mode: PairedArcsMode) {
            self.pairedArcs = mode
          },

          setShowCoverage(show: boolean) {
            self.showCoverage = show
          },

          setCoverageHeight(height: number) {
            self.coverageHeight = height
          },

          setArcsHeight(height: number) {
            self.arcsHeight = height
          },

          setSashimiArcsHeight(height: number) {
            self.sashimiArcsHeight = height
          },

          setLineWidth(width: number) {
            self.lineWidthSetting = width
          },

          setDrawInter(draw: boolean) {
            self.drawInter = draw
          },

          setDrawLongRange(draw: boolean) {
            self.drawLongRange = draw
          },

          setColorByType(type: ArcColorByType) {
            self.arcColorByType = type
          },

          setShowMismatches(show: boolean) {
            self.showMismatches = show
          },

          setShowYScalebar(show: boolean) {
            self.showYScalebar = show
          },

          setShowLegend(show: boolean | undefined) {
            self.setOverride('showLegend', show)
          },

          setDrawSingletons(flag: boolean) {
            self.drawSingletons = flag
          },

          setDrawProperPairs(flag: boolean) {
            self.drawProperPairs = flag
          },

          setShowInterbaseIndicators(show: boolean) {
            self.showInterbaseIndicators = show
          },

          setFlipStrandLongReadChains(flag: boolean) {
            self.flipStrandLongReadChains = flag
          },

          setLinkedReads(mode: LinkedReadsMode) {
            const prev = self.linkedReads
            self.linkedReads = mode
            // Chain IDs are only meaningful in 'normal' mode (chainIdMap is
            // unpopulated otherwise). Clear when leaving so neither backend
            // renders stale chain highlights in bezier/off.
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

          updateVisibleModifications(uniqueModifications: string[]) {
            for (const modType of uniqueModifications) {
              addModification(modType)
            }
          },

          setSimplexModifications(simplex: string[]) {
            const currentSet = self.simplexModifications
            if (
              simplex.length === currentSet.size &&
              simplex.every(s => currentSet.has(s))
            ) {
              return
            }
            self.simplexModifications = new Set(simplex)
          },

          setModificationsReady(flag: boolean) {
            self.modificationsReady = flag
          },

          setFeatureIdUnderMouse(feature?: string) {
            self.featureIdUnderMouse = feature
          },

          setMouseoverExtraInformation(extra?: TooltipPayload) {
            self.mouseoverExtraInformation = extra
          },

          setHoverState(state: {
            overCigarItem: boolean
            featureIdUnderMouse: string | undefined
            mouseoverExtraInformation: TooltipPayload | undefined
          }) {
            self.overCigarItem = state.overCigarItem
            self.featureIdUnderMouse = state.featureIdUnderMouse
            self.mouseoverExtraInformation = state.mouseoverExtraInformation
          },

          setContextMenuFeature(feature?: Feature) {
            self.contextMenuFeature = feature
          },

          setContextMenuCoord(coord?: [number, number]) {
            self.contextMenuCoord = coord
          },

          setContextMenuCigarHit(hit?: CigarHitResult) {
            self.contextMenuCigarHit = hit
          },

          setContextMenuIndicatorHit(hit?: IndicatorHitResult) {
            self.contextMenuIndicatorHit = hit
          },

          clearContextMenu() {
            self.contextMenuCoord = undefined
            self.contextMenuFeature = undefined
            self.contextMenuCigarHit = undefined
            self.contextMenuIndicatorHit = undefined
          },

          setContextMenuRefName(refName?: string) {
            self.contextMenuRefName = refName
          },

          selectFeature(feature: Feature) {
            openFeatureWidget(self, feature.toJSON(), {
              widget: self.featureWidgetType,
            })
          },
        }
      })
      .actions(self => ({
        startBackend(backend: AlignmentsBackend) {
          self.attachBackend<AlignmentsBackend>(backend, {
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
          async selectFeatureById(featureId: string) {
            await fetchAndDo(featureId, feat => {
              self.selectFeature(feat)
            })
          },
          async setContextMenuFeatureById(featureId: string) {
            await fetchAndDo(featureId, feat => {
              self.setContextMenuFeature(feat)
            })
          },
        }
      })
      .actions(self => {
        async function fetchAlignmentData(
          adapterConfig: Record<string, unknown>,
          sequenceAdapter: Record<string, unknown> | undefined,
          region: Region,
          stopToken: StopToken,
          method: 'RenderPileupData' | 'RenderChainData',
        ) {
          const sessionId = getRpcSessionId(self)
          return getSession(self).rpcManager.call(sessionId, method, {
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
          })
        }

        async function fetchFeaturesForRegion(
          adapterConfig: Record<string, unknown>,
          region: Region,
          displayedRegionIndex: number,
          stopToken: StopToken,
        ) {
          const session = getSession(self)
          const sequenceAdapter = getSequenceAdapter(session, region)

          const result = await fetchAlignmentData(
            adapterConfig,
            sequenceAdapter,
            region,
            stopToken,
            self.linkedReads !== 'off' ? 'RenderChainData' : 'RenderPileupData',
          )

          return { displayedRegionIndex, result }
        }

        return {
          getByteEstimateConfig() {
            const view = getContainingView(self) as LGV
            return {
              adapterConfig: self.adapterConfig,
              fetchSizeLimit:
                self.getConfWithOverride<number>('fetchSizeLimit'),
              userByteSizeLimit: self.userByteSizeLimit,
              visibleBp: view.visibleBp,
            }
          },

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
              let newTagColorsAdded = false
              self.setModificationsReady(true)
              for (const r of results) {
                if (r.result.newTagValues) {
                  if (self.updateColorTagMap(r.result.newTagValues)) {
                    newTagColorsAdded = true
                  }
                }
                self.setSimplexModifications(r.result.simplexModifications)
                newDataMap.set(r.displayedRegionIndex, r.result)
              }
              // Two loops are intentional: all updateColorTagMap calls must
              // complete before any setRpcData fires, so colorTagMap is fully
              // populated when the first render reads it.
              for (const [displayedRegionIndex, data] of newDataMap) {
                self.setRpcData(displayedRegionIndex, data)
              }
              if (newTagColorsAdded && self.colorBy.type === 'tag') {
                self.invalidateLoadedRegions()
              }
            })
          },
        }
      })
      .views(self => ({
        /**
         * Track menu items
         */
        trackMenuItems() {
          // Top-level shape, ordered by user frequency:
          //   1. Color by      — most-used (rebound on every visit to highlight a
          //      finding)
          //   2. Sort, filter, group — data subsetting + ordering operations
          //   3. Reads         — visual settings for the pileup body
          //   4. Coverage      — visual + scale settings for the coverage band
          //   5. Read connections — linked-reads / paired arcs / sashimi overlays
          const items: MenuItem[] = [
            getColorByMenuItem(self, {
              showLinkedReads: self.linkedReads !== 'off',
              modifications: self,
              includeTagOption: true,
              arcsState: self,
            }),
            {
              label: 'Sort, filter, group',
              icon: SwapVertIcon,
              type: 'subMenu' as const,
              subMenu: [
                getSortByMenuItem(self),
                getFiltersMenuItem(self, { showPairFilters: self.isChainMode }),
                getGroupByMenuItem(self),
              ],
            },
            getReadsMenuItem(self),
            getCoverageMenuItem(self),
            {
              label: 'Read connections',
              type: 'subMenu' as const,
              subMenu: [
                radioModeMenuItem(
                  'Linked reads',
                  LINKED_READS_OPTIONS,
                  self.linkedReads,
                  v => {
                    self.setLinkedReads(v)
                  },
                ),
                radioModeMenuItem(
                  'Paired arcs',
                  PAIRED_ARCS_OPTIONS,
                  self.pairedArcs,
                  v => {
                    self.setPairedArcs(v)
                  },
                ),
                radioModeMenuItem(
                  'Sashimi arcs',
                  ARC_DIRECTION_OPTIONS,
                  self.sashimiArcs,
                  v => {
                    self.setSashimiArcs(v)
                  },
                ),
              ],
            },
          ]

          return items
        },

        contextMenuItems() {
          const feat = self.contextMenuFeature
          const cigarHit = self.contextMenuCigarHit
          const indicatorHit = self.contextMenuIndicatorHit
          const items: MenuItem[] = []

          if (cigarHit) {
            const typeLabel = CIGAR_TYPE_LABELS[cigarHit.type] ?? cigarHit.type
            const isInterbase =
              cigarHit.type === 'insertion' ||
              cigarHit.type === 'softclip' ||
              cigarHit.type === 'hardclip'
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
                    const { default: copy } = await import('copy-to-clipboard')
                    await copy(JSON.stringify(rest, null, 4))
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
