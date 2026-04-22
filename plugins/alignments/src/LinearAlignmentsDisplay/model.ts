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
  isSessionModelWithWidgets,
} from '@jbrowse/core/util'
import {
  addDisposer,
  getSnapshot,
  isAlive,
  types,
} from '@jbrowse/mobx-state-tree'
import {
  ConfigOverrideMixin,
  MultiRegionDisplayMixin,
  TrackHeightMixin,
} from '@jbrowse/plugin-linear-genome-view'
import { domainFromStats, getNiceDomain } from '@jbrowse/wiggle-core'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import EqualizerIcon from '@mui/icons-material/Equalizer'
import MenuOpenIcon from '@mui/icons-material/MenuOpen'
import SwapVertIcon from '@mui/icons-material/SwapVert'
import { autorun, observable } from 'mobx'

import { ArcsSubModel } from './ArcsSubModel.ts'
import { SashimiArcsSubModel } from './SashimiArcsSubModel.ts'
import { buildLaidOutChainMap } from './computeChainLayout.ts'
import { migrateAlignmentsSnapshot } from './migrateAlignmentsSnapshot.ts'
import { buildLaidOutPileupMap } from '../RenderPileupDataRPC/sortLayout.ts'
import { computeVisibleLabels } from './components/computeVisibleLabels.ts'
import {
  arcsToRegionResult,
  computeArcsFromPileupData,
} from '../shared/computeArcsFromPileupData.ts'
import { getReadDisplayLegendItems } from '../shared/legendUtils.ts'
import {
  getColorByMenuItem,
  getFeatureHeightMenuItem,
  getFiltersMenuItem,
  getGroupByMenuItem,
  getSetMaxHeightMenuItem,
  getShowMenuItem,
  getSortByMenuItem,
} from '../shared/menus/index.ts'
import { getColorForModification } from '../util.ts'
import { CIGAR_TYPE_LABELS } from './components/alignmentComponentUtils.ts'
import { openCigarWidget } from './components/openFeatureWidget.ts'

import type {
  ColorPalette,
  RenderState as AlignmentsRenderState,
} from './components/AlignmentsRenderer.ts'
import type { VisibleLabel } from './components/computeVisibleLabels.ts'
import type {
  CigarHitResult,
  IndicatorHitResult,
} from './components/hitTesting.ts'
import type { AlignmentsBackend } from './components/rendererTypes.ts'
import type { PileupDataResult } from '../RenderPileupDataRPC/types'
import type { LegendItem } from '../shared/legendUtils.ts'
import type {
  ColorBy,
  FilterBy,
  ModificationTypeWithColor,
  SortedBy,
} from '../shared/types'
import type { CoverageTicks } from '@jbrowse/alignments-core'
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

export {
  getInsertionType,
  insertionBarWidth as getInsertionRectWidthPx,
  textWidthForNumber,
} from './constants.ts'
export type { InsertionType } from './constants.ts'

export type { Region } from '@jbrowse/core/util'

function getSequenceAdapter(session: AbstractSessionModel, region: Region) {
  const assembly = region.assemblyName
    ? session.assemblyManager.get(region.assemblyName)
    : undefined
  const sequenceAdapterConfig = assembly?.configuration?.sequence?.adapter
  if (!sequenceAdapterConfig) {
    return undefined
  }
  const snap: unknown = getSnapshot(sequenceAdapterConfig)
  return snap as Record<string, unknown>
}

interface FetchFeatureDetailsSelf {
  adapterConfigSnapshot: Record<string, unknown>
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
  const adapterConfig = self.adapterConfigSnapshot
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
    { sessionId, adapterConfig, sequenceAdapter, regions: [region], featureId },
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

const SetMinMaxDialog = lazy(async () => {
  const { SetMinMaxDialog: Cmp } = await import('@jbrowse/plugin-wiggle')
  return { default: Cmp }
})

export const ColorScheme = {
  normal: 0,
  strand: 1,
  mappingQuality: 2,
  insertSize: 3,
  firstOfPairStrand: 4,
  pairOrientation: 5,
  insertSizeAndOrientation: 6,
  modifications: 7,
  tag: 8,
  baseQuality: 9,
  insertSizeGradient: 10,
} as const

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
          showLinkedReads: false,
          showCoverage: true,
          coverageHeight: 45,
          showMismatches: true,
          showInterbaseIndicators: true,
          showYScalebar: true,
          drawSingletons: true,
          drawProperPairs: true,
          flipStrandLongReadChains: true,
          arcsState: types.optional(ArcsSubModel, {}),
          sashimiArcsState: types.optional(SashimiArcsSubModel, {}),
          showArcs: false,
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
        mouseoverExtraInformation: undefined as string | undefined,
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
      .views(() => ({
        get featureWidgetType() {
          return {
            type: 'AlignmentsFeatureWidget',
            id: 'alignmentFeature',
          }
        },
      }))
      .views(self => ({
        get adapterConfigSnapshot() {
          return getConf(getContainingTrack(self), 'adapter') as Record<
            string,
            unknown
          >
        },

        get fetchSizeLimit() {
          return (
            self.userByteSizeLimit ||
            self.getConfWithOverride<number>('fetchSizeLimit')
          )
        },

        get selectedFeatureId() {
          const { selection } = getSession(self)
          if (isFeature(selection)) {
            return selection.id()
          }
          return undefined
        },

        get renderingMode(): 'pileup' | 'linkedRead' {
          return self.showLinkedReads ? 'linkedRead' : 'pileup'
        },

        get isChainMode() {
          return self.showLinkedReads
        },

        /**
         * Use custom component instead of block-based rendering
         */
        get DisplayMessageComponent() {
          return AlignmentsComponent
        },

        /**
         * Custom tooltip that prioritizes mouseoverExtraInformation for CIGAR items
         */
        get TooltipComponent() {
          return AlignmentsTooltip
        },

        /**
         * Get list of visible modification types
         */
        get visibleModificationTypes() {
          return [...self.visibleModifications.keys()]
        },

        get colorBy(): ColorBy {
          return self.getConfWithOverride<ColorBy>('colorBy')
        },

        get filterBy(): FilterBy {
          return self.getConfWithOverride<FilterBy>('filterBy')
        },

        get featureHeightSetting(): number {
          return self.getConfWithOverride<number>('featureHeight')
        },

        get noSpacingSetting(): boolean | undefined {
          return self.getOverride<boolean>('noSpacing')
        },

        get featureSpacing(): number {
          const noSpacing = self.getOverride<boolean>('noSpacing')
          if (noSpacing !== undefined) {
            return noSpacing ? 0 : 2
          }
          return self.getConfWithOverride<number>('featureSpacing')
        },

        get maxHeight(): number {
          return self.getConfWithOverride<number>('maxHeight')
        },

        /**
         * Chain index map: readName → array of feature indices
         * Used in linkedRead mode for chain-level highlighting
         * Cached as a MST getter so it only recomputes when rpcDataMap changes
         */
        get chainIdMap() {
          const map = new Map<number, string[]>()
          if (self.showLinkedReads) {
            for (const data of self.rpcDataMap.values()) {
              if (!data.readChainIndices) {
                continue
              }
              for (let i = 0; i < data.numReads; i++) {
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

        get mismatchAlpha(): boolean {
          return !!self.getOverride<boolean>('mismatchAlpha')
        },

        get showLegend(): boolean | undefined {
          return self.getOverride<boolean>('showLegend')
        },

        get regionTooLarge() {
          return self.regionTooLargeState
        },

        get sortedBy() {
          return self.getOverride<SortedBy>('sortedBy')
        },

        get coverageScaleType() {
          return self.getConfWithOverride<string>('scaleType')
        },

        get coverageAutoscaleType() {
          return self.getConfWithOverride<string>('autoscale')
        },

        get coverageMinScore() {
          const v = self.getConfWithOverride<number>('minScore')
          return v !== Number.MIN_VALUE ? v : undefined
        },

        get coverageMaxScore() {
          const v = self.getConfWithOverride<number>('maxScore')
          return v !== Number.MAX_VALUE ? v : undefined
        },

        get coverageNumStdDev() {
          return self.getConfWithOverride<number>('numStdDev')
        },

        get coverageIsLog() {
          return this.coverageScaleType === 'log'
        },

        // Coverage stats across visible content blocks. MobX-cached.
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

        // [min, max] domain for the coverage Y axis.
        get coverageDomain(): [number, number] | undefined {
          const stats = this.coverageStats
          if (!stats) {
            return undefined
          }
          const raw = domainFromStats(
            stats,
            this.coverageAutoscaleType,
            this.coverageNumStdDev,
          )
          return getNiceDomain({
            domain: raw,
            bounds: [this.coverageMinScore, this.coverageMaxScore],
            scaleType: this.coverageScaleType,
          })
        },

        get coverageTicks(): CoverageTicks | undefined {
          const domain = this.coverageDomain
          if (!domain) {
            return undefined
          }
          return computeCoverageTicks(
            domain[1],
            self.coverageHeight,
            this.coverageScaleType,
          )
        },

        get legendItems(): LegendItem[] {
          return getReadDisplayLegendItems(self.getOverride<ColorBy>('colorBy'))
        },

        /**
         * Pileup data with per-read Y rows applied from main-thread layout.
         *
         * Pileup or chain-mode layout derived from raw `rpcDataMap`.
         * Entries are shallow clones of the raw data with freshly
         * allocated `readYs/gapYs/mismatchYs/interbaseYs/modificationYs/
         * softclipBaseYs` (and, in chain mode, `connectingLinePositions`,
         * `connectingLineYs`, `chainFlatbushData`) and the layout `maxY`.
         *
         * MobX caches this so layout recomputes only when `rpcDataMap`,
         * `sortedBy`, `showSoftClipping`, or `renderingMode` change.
         */
        get laidOutPileupMap() {
          if (this.renderingMode === 'linkedRead') {
            return buildLaidOutChainMap(self.rpcDataMap)
          }
          return buildLaidOutPileupMap({
            dataMap: self.rpcDataMap,
            sortedBy: this.sortedBy,
            showSoftClipping: self.showSoftClipping,
          })
        },

        // Max pileup row across all laid-out regions. Drives
        // totalPileupHeight → scroll range.
        get maxY() {
          let max = 0
          for (const data of this.laidOutPileupMap.values()) {
            if (data.maxY > max) {
              max = data.maxY
            }
          }
          return max
        },
      }))
      // Views derived from colorBy, featureHeightSetting, featureSpacing above.
      .views(self => ({
        get modificationThreshold() {
          return self.colorBy.modifications?.threshold ?? 10
        },

        /**
         * Calculate color scheme index from colorBy setting
         */
        get colorSchemeIndex(): number {
          switch (self.colorBy.type) {
            case 'normal':
              return ColorScheme.normal
            case 'strand':
              return ColorScheme.strand
            case 'mappingQuality':
              return ColorScheme.mappingQuality
            case 'insertSize':
              return ColorScheme.insertSize
            case 'insertSizeGradient':
              return ColorScheme.insertSizeGradient
            case 'firstOfPairStrand':
            case 'stranded':
              return ColorScheme.firstOfPairStrand
            case 'pairOrientation':
              return ColorScheme.pairOrientation
            case 'insertSizeAndOrientation':
              return ColorScheme.insertSizeAndOrientation
            case 'modifications':
            case 'methylation':
              return ColorScheme.modifications
            case 'tag':
              return ColorScheme.tag
            case 'baseQuality':
              return ColorScheme.baseQuality
            default:
              return ColorScheme.normal
          }
        },

        get showModifications(): boolean {
          const t = self.colorBy.type
          return t === 'modifications' || t === 'methylation'
        },

        get totalPileupHeight() {
          return self.maxY * (self.featureHeightSetting + self.featureSpacing)
        },

        /**
         * Cached O(1) index: featureId → {displayedRegionIndex, idx}.
         * Recomputed by MobX only when rpcDataMap changes.
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
      // Delegates from submodels — expose arcsState.pairedArcsDown and
      // sashimiArcsState fields directly on the display for external consumers.
      .views(self => ({
        get pairedArcsDown() {
          return self.arcsState.pairedArcsDown
        },
        get showSashimiArcs() {
          return self.sashimiArcsState.showSashimiArcs
        },
        get sashimiArcsDown() {
          return self.sashimiArcsState.sashimiArcsDown
        },
        get sashimiArcsHeight() {
          return self.sashimiArcsState.sashimiArcsHeight
        },

        /**
         * Find a feature by ID in rpcDataMap, returning the displayedRegionIndex,
         * index, and rpcData entry. Shared by searchFeatureByID and
         * getFeatureInfoById.
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
         * Compatibility getter for BreakpointSplitView overlay which reads
         * display.scrollTop to position SVG curves. The WebGL display manages
         * Y scrolling via currentRangeY[0] rather than the inherited scrollTop.
         */
        get scrollTop() {
          return self.currentRangeY[0]
        },

        /**
         * Total pixel height consumed by coverage and arc sections above the
         * pileup reads. Used as the Y offset for pileup rendering.
         */
        get coverageDisplayHeight() {
          return (
            (self.showCoverage ? self.coverageHeight : 0) +
            (self.showArcs && self.pairedArcsDown ? self.arcsHeight : 0) +
            (self.showSashimiArcs && self.sashimiArcsDown && self.showCoverage
              ? self.sashimiArcsHeight
              : 0)
          )
        },
      }))
      // Layout views — depend on coverageDisplayHeight above via self.
      .views(self => ({
        get pileupViewportHeight() {
          return Math.max(0, self.height - self.coverageDisplayHeight)
        },

        get showOutlineSetting() {
          return self.getOverride<boolean>('showOutline') ?? self.isChainMode
        },

        get visibleLabels(): VisibleLabel[] {
          const view = getContainingView(self) as LGV
          if (!view.initialized) {
            return []
          }
          const contentBlocks = view.dynamicBlocks.contentBlocks
          const bpPerPx = view.bpPerPx
          const blocks = []
          for (const block of contentBlocks) {
            if (block.displayedRegionIndex === undefined) {
              continue
            }
            const data = self.laidOutPileupMap.get(block.displayedRegionIndex)
            if (data) {
              blocks.push({
                rpcData: data,
                blockStart: block.start,
                blockEnd: block.end,
                blockScreenOffsetPx: block.offsetPx - view.offsetPx,
                bpPerPx,
                reversed: block.reversed ?? false,
              })
            }
          }
          return computeVisibleLabels({
            blocks,
            height: self.height,
            featureHeightSetting: self.featureHeightSetting,
            featureSpacing: self.featureSpacing,
            showMismatches: self.showMismatches,
            topOffset: self.coverageDisplayHeight,
            rangeY: self.currentRangeY,
          })
        },

        /**
         * Return a LayoutRecord [left, top, right, bottom] for
         * BreakpointSplitView overlay compatibility.
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
          const rowHeight = self.featureHeightSetting + self.featureSpacing
          const left = start
          const right = end
          const top = yRow * rowHeight
          const bottom = top + self.featureHeightSetting
          return [left, top, right, bottom]
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
            strand: flags !== undefined && flags & 16 ? '-' : '+',
            refName:
              view.displayedRegions[displayedRegionIndex]?.refName ?? 'unknown',
          }
        },
      }))
      // scrollableHeight depends on pileupViewportHeight above.
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
        // field that selects between pileup and chain RPC
        // (showLinkedReads). Arc-only fields live on arcsState and
        // drive the arcs autorun below without refetching pileup. All
        // non-tag sort changes are handled main-thread by the
        // laidOutPileupMap getter.
        get rpcProps() {
          return {
            filterBy: self.filterBy,
            colorBy: self.colorBy,
            colorTagMap: self.colorTagMap,
            sortTag: this.sortTag,
            showSoftClipping: self.showSoftClipping,
            drawSingletons: self.drawSingletons,
            drawProperPairs: self.drawProperPairs,
            showLinkedReads: self.showLinkedReads,
          }
        },

        get renderState(): AlignmentsRenderState | undefined {
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
            showOutline: self.showOutlineSetting,
            showArcs: self.showArcs,
            arcsHeight: self.arcsHeight,
            pairedArcsDown: self.pairedArcsDown,
            pileupTopOffset: self.coverageDisplayHeight,
            canvasWidth: view.width,
            canvasHeight: self.height,
            highlightedFeatureId: self.featureIdUnderMouse,
            selectedFeatureId: self.selectedFeatureId,
            highlightedChainIds: self.highlightedChainIds,
            selectedChainIds: self.selectedChainIds,
            colors: palette,
            renderingMode: self.renderingMode,
            flipStrandLongReadChains: self.flipStrandLongReadChains,
            arcLineWidth: self.arcsState.lineWidth,
            bpRangeX: [0, 0],
          }
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
          // Return a minimal Feature-like object for tooltip support
          return {
            id: () => info.id,
            get: (key: string) => {
              switch (key) {
                case 'name':
                  return info.name || info.id
                case 'id':
                  return info.id
                case 'start':
                  return info.start
                case 'end':
                  return info.end
                case 'refName':
                  return info.refName
                case 'strand':
                  return info.strand === '-' ? -1 : 1
                case 'flags':
                  return info.flags
                case 'score':
                case 'MAPQ':
                  return info.mapq
                default:
                  return undefined
              }
            },
          } as Feature
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
        return {
          setError(error?: unknown) {
            superSetError(error)
            if (error) {
              self.featureIdUnderMouse = undefined
              self.mouseoverExtraInformation = undefined
            }
          },

          setRegionTooLarge(val: boolean, reason?: string) {
            superSetRegionTooLarge(val, reason)
            if (val) {
              self.featureIdUnderMouse = undefined
              self.mouseoverExtraInformation = undefined
            }
          },

          setRpcData(
            displayedRegionIndex: number,
            data: PileupDataResult | null,
          ) {
            if (data) {
              self.rpcDataMap.set(displayedRegionIndex, data)
              for (const modType of data.detectedModifications) {
                if (!self.visibleModifications.has(modType)) {
                  self.visibleModifications.set(modType, {
                    type: modType,
                    base: '',
                    strand: '',
                    color: getColorForModification(modType),
                  })
                }
              }
            } else {
              self.rpcDataMap.delete(displayedRegionIndex)
            }
          },

          clearDisplaySpecificData() {
            self.rpcDataMap.clear()
            self.arcsState.clearAllRpcData()
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

          clearMouseoverState() {
            self.featureIdUnderMouse = undefined
            self.mouseoverExtraInformation = undefined
            self.overCigarItem = false
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
            const colorPalette = [
              '#90caf9',
              '#f48fb1',
              '#a5d6a7',
              '#fff59d',
              '#ffab91',
              '#ce93d8',
              '#80deea',
              '#c5e1a5',
              '#ffe082',
              '#bcaaa4',
            ]
            const map = { ...self.colorTagMap }
            let totalKeys = Object.keys(map).length
            let added = false
            for (const value of uniqueTag) {
              if (!map[value]) {
                map[value] = colorPalette[totalKeys % colorPalette.length]!
                totalKeys++
                added = true
              }
            }
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
            if (!centerLineInfo) {
              return
            }
            const { refName, assemblyName, offset } = centerLineInfo
            const centerBp = Math.round(offset)
            if (centerBp < 0 || !refName) {
              return
            }
            self.setOverride('sortedBy', {
              type,
              pos: centerBp,
              refName,
              assemblyName,
              tag,
            })
          },

          setSortedByAtPosition(type: string, pos: number, refName: string) {
            const view = getContainingView(self) as LGV
            const assemblyName = view.assemblyNames[0]
            if (!assemblyName) {
              return
            }
            self.setOverride('sortedBy', {
              type,
              pos,
              refName,
              assemblyName,
            })
          },

          clearSelected() {
            self.clearOverride('sortedBy')
          },

          setMaxHeight(n?: number) {
            self.setOverride('maxHeight', n)
          },

          setCoverageScaleType(val: string) {
            self.setOverride('scaleType', val)
          },

          setCoverageAutoscaleType(val: string) {
            self.setOverride('autoscale', val)
          },

          setCoverageMinScore(val?: number) {
            self.setOverride('minScore', val)
          },

          setCoverageMaxScore(val?: number) {
            self.setOverride('maxScore', val)
          },

          setFeatureHeight(height?: number) {
            self.setOverride('featureHeight', height)
            self.currentRangeY = [0, 0]
          },

          setNoSpacing(flag?: boolean) {
            self.setOverride('noSpacing', flag)
            self.currentRangeY = [0, 0]
          },

          /**
           * #action
           * Called by "Compact all tracks" in LGV/BreakpointSplitView/LinearComparativeView menus via duck-typing
           */
          setCompactness(level: 'normal' | 'compact' | 'super-compact') {
            if (level === 'compact') {
              self.setOverride('featureHeight', 3)
              self.setOverride('noSpacing', true)
            } else if (level === 'super-compact') {
              self.setOverride('featureHeight', 1)
              self.setOverride('noSpacing', true)
            } else {
              self.setOverride('featureHeight', 7)
              self.setOverride('noSpacing', false)
            }
            self.currentRangeY = [0, 0]
          },

          setShowSashimiArcs(show: boolean) {
            self.sashimiArcsState.setShowSashimiArcs(show)
          },

          setShowCoverage(show: boolean) {
            self.showCoverage = show
          },

          setCoverageHeight(height: number) {
            self.coverageHeight = height
          },

          setShowArcs(show: boolean) {
            self.showArcs = show
          },

          setArcsHeight(height: number) {
            self.arcsHeight = height
          },

          setSashimiArcsDown(flag: boolean) {
            self.sashimiArcsState.setSashimiArcsDown(flag)
          },

          setSashimiArcsHeight(height: number) {
            self.sashimiArcsState.setSashimiArcsHeight(height)
          },

          setArcsDown(flag: boolean) {
            self.arcsState.setArcsDown(flag)
          },

          setShowMismatches(show: boolean) {
            self.showMismatches = show
          },

          // Pileup and arcs are independent upload streams tracked within a
          // single autorun — each with its own identity-diff cache. Arcs
          // share the pileup backend's per-region slots, so only the pileup
          // stream prunes. `AlignmentsRenderState` includes color scheme,
          // scrollTop, hover highlights, etc.; the util's split autoruns
          // mean hover-only changes skip the upload cache walk.
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

          setShowLinkedReads(flag: boolean) {
            self.showLinkedReads = flag
            self.featureIdUnderMouse = undefined
            self.mouseoverExtraInformation = undefined
            self.overCigarItem = false
            if (self.highlightedChainIds.length > 0) {
              self.highlightedChainIds = []
            }
            if (flag) {
              self.clearOverride('showOutline')
              self.setOverride('colorBy', { type: 'insertSizeAndOrientation' })
            } else {
              self.setOverride('colorBy', { type: 'normal' })
            }
            self.invalidateLoadedRegions()
          },

          updateVisibleModifications(uniqueModifications: string[]) {
            for (const modType of uniqueModifications) {
              if (!self.visibleModifications.has(modType)) {
                self.visibleModifications.set(modType, {
                  type: modType,
                  base: '',
                  strand: '',
                  color: getColorForModification(modType),
                })
              }
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

          setMouseoverExtraInformation(extra?: string) {
            self.mouseoverExtraInformation = extra
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

          setContextMenuRefName(refName?: string) {
            self.contextMenuRefName = refName
          },

          selectFeature(feature: Feature) {
            const session = getSession(self)
            session.setSelection(feature)
            if (isSessionModelWithWidgets(session)) {
              const { type, id } = self.featureWidgetType
              session.showWidget(
                session.addWidget(type, id, {
                  featureData: feature.toJSON(),
                  view: getContainingView(self),
                  track: getContainingTrack(self),
                }),
              )
            }
            session.setSelection(feature)
          },
        }
      })
      .actions(self => ({
        startGpuBackendLifecycle(backend: AlignmentsBackend) {
          self.installGpuDisplay<AlignmentsBackend>(backend, {
            upload: b => {
              // Pileup + connecting lines: one entry per region from
              // self.laidOutPileupMap (Y arrays filled from main-thread
              // layout, or pass-through rpcDataMap for chain mode).
              const active: number[] = []
              for (const [
                displayedRegionIndex,
                data,
              ] of self.laidOutPileupMap) {
                active.push(displayedRegionIndex)
                if (data.numReads === 0) {
                  continue
                }
                b.uploadRegion(displayedRegionIndex, data)
                if (
                  data.connectingLinePositions &&
                  data.connectingLineYs &&
                  data.numConnectingLines
                ) {
                  b.uploadConnectingLinesForRegion(displayedRegionIndex, {
                    connectingLinePositions: data.connectingLinePositions,
                    connectingLineYs: data.connectingLineYs,
                    numConnectingLines: data.numConnectingLines,
                  })
                }
              }
              b.pruneRegions(active)
              // Arcs: independent source. Changes here re-fire the whole
              // upload pass (including pileup), which is fine because the
              // backend treats identity-stable pileup uploads as idempotent.
              for (const [displayedRegionIndex, data] of self.arcsState
                .rpcDataMap) {
                b.uploadArcsFromTypedArraysForRegion(displayedRegionIndex, {
                  arcX1: data.arcX1,
                  arcX2: data.arcX2,
                  arcColorTypes: data.arcColorTypes,
                  arcIsArc: data.arcIsArc,
                  numArcs: data.numArcs,
                  linePositions: data.linePositions,
                  lineYs: data.lineYs,
                  lineColorTypes: data.lineColorTypes,
                  numLines: data.numLines,
                })
              }
            },
            render: b => {
              const state = self.renderState
              if (!state) {
                return false
              }
              return b.renderBlocks(self.renderBlocks, state)
            },
          })
        },
      }))
      .actions(self => ({
        async selectFeatureById(featureId: string) {
          const session = getSession(self)
          try {
            const feat = await fetchFeatureDetails(self, featureId)
            if (isAlive(self) && feat) {
              self.selectFeature(feat)
            }
          } catch (e) {
            console.error(e)
            session.notifyError(`${e}`, e)
          }
        },

        async setContextMenuFeatureById(featureId: string) {
          const session = getSession(self)
          try {
            const feat = await fetchFeatureDetails(self, featureId)
            if (isAlive(self) && feat) {
              self.setContextMenuFeature(feat)
            }
          } catch (e) {
            console.error(e)
            session.notifyError(`${e}`, e)
          }
        },
      }))
      .actions(self => {
        async function fetchPileupData(
          adapterConfig: Record<string, unknown>,
          sequenceAdapter: Record<string, unknown> | undefined,
          region: Region,
          stopToken: StopToken,
        ) {
          const sessionId = getRpcSessionId(self)
          return getSession(self).rpcManager.call(
            sessionId,
            'RenderPileupData',
            {
              sessionId,
              adapterConfig,
              sequenceAdapter,
              regions: [region],
              ...self.rpcProps,
              stopToken,
              statusCallback: (msg: string) => {
                if (isAlive(self)) {
                  self.setStatusMessage(msg)
                }
              },
            },
          )
        }

        async function fetchChainData(
          adapterConfig: Record<string, unknown>,
          sequenceAdapter: Record<string, unknown> | undefined,
          region: Region,
          stopToken: StopToken,
        ) {
          const sessionId = getRpcSessionId(self)
          return getSession(self).rpcManager.call(
            sessionId,
            'RenderChainData',
            {
              sessionId,
              adapterConfig,
              sequenceAdapter,
              regions: [region],
              ...self.rpcProps,
              stopToken,
              statusCallback: (msg: string) => {
                if (isAlive(self)) {
                  self.setStatusMessage(msg)
                }
              },
            },
          )
        }

        async function fetchFeaturesForRegion(
          adapterConfig: Record<string, unknown>,
          region: Region,
          displayedRegionIndex: number,
          stopToken: StopToken,
        ) {
          const session = getSession(self)
          const sequenceAdapter = getSequenceAdapter(session, region)

          const result = await (self.renderingMode === 'linkedRead'
            ? fetchChainData(adapterConfig, sequenceAdapter, region, stopToken)
            : fetchPileupData(
                adapterConfig,
                sequenceAdapter,
                region,
                stopToken,
              ))

          return {
            displayedRegionIndex,
            result,
            region: {
              refName: region.refName,
              start: region.start,
              end: region.end,
              assemblyName: region.assemblyName,
            },
          }
        }

        function computeAndSetArcs(
          regions: { region: Region; displayedRegionIndex: number }[],
        ) {
          const allRegionInfos: {
            refName: string
            start: number
            end: number
            displayedRegionIndex: number
          }[] = []
          const addedDisplayedRegionIndices = new Set<number>()
          for (const [displayedRegionIndex, loaded] of self.loadedRegions) {
            allRegionInfos.push({
              refName: loaded.refName,
              start: loaded.start,
              end: loaded.end,
              displayedRegionIndex,
            })
            addedDisplayedRegionIndices.add(displayedRegionIndex)
          }
          for (const { region, displayedRegionIndex } of regions) {
            if (!addedDisplayedRegionIndices.has(displayedRegionIndex)) {
              allRegionInfos.push({ ...region, displayedRegionIndex })
            }
          }
          const { arcs, lines } = computeArcsFromPileupData(
            self.rpcDataMap,
            allRegionInfos,
            {
              colorByType: self.arcsState.colorByType,
              drawInter: self.arcsState.drawInter,
              drawLongRange: self.arcsState.drawLongRange,
            },
          )
          for (const ri of allRegionInfos) {
            const data = self.rpcDataMap.get(ri.displayedRegionIndex)
            if (!data) {
              continue
            }
            const result = arcsToRegionResult(
              arcs,
              lines,
              ri.refName,
              self.height,
            )
            self.arcsState.setRpcData(ri.displayedRegionIndex, result)
          }
        }

        const superAfterAttach = self.afterAttach

        return {
          async fetchFeatures(region: Region, displayedRegionIndex = 0) {
            self.onFetchNeeded([{ region, displayedRegionIndex }])
          },

          getByteEstimateConfig() {
            const view = getContainingView(self) as LGV
            return {
              adapterConfig: self.adapterConfigSnapshot,
              fetchSizeLimit:
                self.getConfWithOverride<number>('fetchSizeLimit'),
              userByteSizeLimit: self.userByteSizeLimit,
              visibleBp: view.visibleBp,
            }
          },

          async onFetchNeeded(
            needed: { region: Region; displayedRegionIndex: number }[],
          ) {
            await self.fetchRegions(needed, async (ctx: FetchContext) => {
              const promises = needed.map(({ region, displayedRegionIndex }) =>
                fetchFeaturesForRegion(
                  self.adapterConfigSnapshot,
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
              for (const r of results) {
                if (r.result.newTagValues) {
                  if (self.updateColorTagMap(r.result.newTagValues)) {
                    newTagColorsAdded = true
                  }
                }
                self.setModificationsReady(true)
                self.setSimplexModifications(r.result.simplexModifications)
                newDataMap.set(r.displayedRegionIndex, r.result)
              }
              // Layout (pileup or chain) is derived by the
              // `laidOutPileupMap` getter from `rpcDataMap`. Just commit
              // raw results here.
              for (const [displayedRegionIndex, data] of newDataMap) {
                self.setRpcData(displayedRegionIndex, data)
              }
              if (self.showArcs) {
                computeAndSetArcs(needed)
              }
              if (newTagColorsAdded && self.colorBy.type === 'tag') {
                self.invalidateLoadedRegions()
              }
            })
          },

          afterAttach() {
            superAfterAttach()

            // Recompute arcs when any arc-affecting setting changes (no
            // RPC refetch needed — arcs are derived from existing pileup
            // data). `computeAndSetArcs` reads arcsState.colorByType /
            // drawInter / drawLongRange internally, so those deps are
            // tracked transitively — no manual `void` pokes needed.
            // `delay: 50` batches rapid fires from per-region setRpcData
            // calls during a single fetch into one recompute.
            addDisposer(
              self,
              autorun(
                () => {
                  if (!self.showArcs || self.rpcDataMap.size === 0) {
                    return
                  }
                  const view = getContainingView(self) as LGV
                  computeAndSetArcs(
                    view.visibleRegions.map(vr => ({
                      region: vr,
                      displayedRegionIndex: vr.displayedRegionIndex,
                    })),
                  )
                },
                {
                  name: 'LinearAlignmentsDisplay:recomputeArcs',
                  delay: 50,
                },
              ),
            )
          },
        }
      })
      .views(self => ({
        /**
         * Track menu items
         */
        trackMenuItems() {
          const colorByMenu = getColorByMenuItem(self, {
            showLinkedReads: self.showLinkedReads,
            includeModifications: true,
            includeTagOption: true,
            arcsState: self.arcsState,
          })

          const items: MenuItem[] = [
            getShowMenuItem(self),
            getFiltersMenuItem(self, { showPairFilters: self.isChainMode }),
            getSortByMenuItem(self),
            colorByMenu,
            getGroupByMenuItem(self),
            {
              label: 'Arcs...',
              type: 'subMenu' as const,
              subMenu: [
                {
                  label: 'Paired arcs',
                  type: 'subMenu' as const,
                  subMenu: [
                    {
                      label: 'Off',
                      type: 'radio' as const,
                      checked: !self.showArcs,
                      onClick: () => {
                        self.setShowArcs(false)
                      },
                    },
                    {
                      label: 'Pointing up',
                      type: 'radio' as const,
                      checked: self.showArcs && !self.pairedArcsDown,
                      onClick: () => {
                        self.setShowArcs(true)
                        self.setArcsDown(false)
                      },
                    },
                    {
                      label: 'Pointing down',
                      type: 'radio' as const,
                      checked: self.showArcs && self.pairedArcsDown,
                      onClick: () => {
                        self.setShowArcs(true)
                        self.setArcsDown(true)
                      },
                    },
                  ],
                },
                {
                  label: 'Sashimi arcs',
                  type: 'subMenu' as const,
                  subMenu: [
                    {
                      label: 'Off',
                      type: 'radio' as const,
                      checked: !self.showSashimiArcs,
                      onClick: () => {
                        self.setShowSashimiArcs(false)
                      },
                    },
                    {
                      label: 'Pointing up',
                      type: 'radio' as const,
                      checked: self.showSashimiArcs && !self.sashimiArcsDown,
                      onClick: () => {
                        self.setShowSashimiArcs(true)
                        self.setSashimiArcsDown(false)
                      },
                    },
                    {
                      label: 'Pointing down',
                      type: 'radio' as const,
                      checked: self.showSashimiArcs && self.sashimiArcsDown,
                      onClick: () => {
                        self.setShowSashimiArcs(true)
                        self.setSashimiArcsDown(true)
                      },
                    },
                  ],
                },
              ],
            },
            getFeatureHeightMenuItem(self),
            getSetMaxHeightMenuItem(self),
            {
              label: 'Coverage score',
              icon: EqualizerIcon,
              type: 'subMenu' as const,
              subMenu: [
                {
                  label: 'Scale type',
                  type: 'subMenu' as const,
                  subMenu: [
                    {
                      label: 'Linear scale',
                      type: 'radio' as const,
                      checked: self.coverageScaleType === 'linear',
                      onClick: () => {
                        self.setCoverageScaleType('linear')
                      },
                    },
                    {
                      label: 'Log scale',
                      type: 'radio' as const,
                      checked: self.coverageScaleType === 'log',
                      onClick: () => {
                        self.setCoverageScaleType('log')
                      },
                    },
                  ],
                },
                {
                  label: 'Autoscale type',
                  type: 'subMenu' as const,
                  subMenu: (
                    [
                      ['local', 'Local'],
                      ['localsd', 'Local ± 3σ'],
                    ] as const
                  ).map(([val, label]) => ({
                    label,
                    type: 'radio' as const,
                    checked: self.coverageAutoscaleType === val,
                    onClick: () => {
                      self.setCoverageAutoscaleType(val)
                    },
                  })),
                },
                {
                  label: 'Set min/max score',
                  onClick: () => {
                    getSession(self).queueDialog(handleClose => [
                      SetMinMaxDialog,
                      {
                        model: {
                          minScore: self.coverageMinScore ?? Number.MIN_VALUE,
                          maxScore: self.coverageMaxScore ?? Number.MAX_VALUE,
                          scaleType: self.coverageScaleType,
                          setMinScore: (v?: number) => {
                            self.setCoverageMinScore(v)
                          },
                          setMaxScore: (v?: number) => {
                            self.setCoverageMaxScore(v)
                          },
                        },
                        handleClose,
                      },
                    ])
                  },
                },
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
                  const session = getSession(self)
                  if (isSessionModelWithWidgets(session)) {
                    const featureWidget = session.addWidget(
                      'AlignmentsFeatureWidget',
                      'alignmentFeature',
                      {
                        featureData: feat.toJSON(),
                        view: getContainingView(self),
                        track: getContainingTrack(self),
                      },
                    )
                    session.showWidget(featureWidget)
                    session.setSelection(feat)
                  }
                },
              },
              {
                label: 'Copy info to clipboard',
                icon: ContentCopyIcon,
                onClick: async () => {
                  const { uniqueId, ...rest } = feat.toJSON()
                  const session = getSession(self)
                  const { default: copy } = await import('copy-to-clipboard')
                  copy(JSON.stringify(rest, null, 4))
                  session.notify('Copied to clipboard', 'success')
                },
              },
            )
          }

          return items
        },
      }))
      .actions(self => {
        const superReload = self.reload
        return {
          async reload() {
            self.clearAllRpcData()
            superReload()
          },
          async renderSvg(opts?: ExportSvgDisplayOptions) {
            const { renderSvg } = await import('./renderSvg.tsx')
            return renderSvg(self as LinearAlignmentsDisplayModel, opts)
          },
        }
      })
  )
}

export type LinearAlignmentsDisplayStateModel = ReturnType<
  typeof stateModelFactory
>
export type LinearAlignmentsDisplayModel =
  Instance<LinearAlignmentsDisplayStateModel>
