import { lazy } from 'react'

import {
  computeCoverageTicks,
  computeVisibleMaxDepth,
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
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import MenuOpenIcon from '@mui/icons-material/MenuOpen'
import SwapVertIcon from '@mui/icons-material/SwapVert'
import { autorun, observable } from 'mobx'

import { ArcsSubModel } from './ArcsSubModel.ts'
import { SashimiArcsSubModel } from './SashimiArcsSubModel.ts'
import { migrateAlignmentsSnapshot } from './migrateAlignmentsSnapshot.ts'
import {
  computeLayout,
  computeSortedLayout,
} from '../RenderPileupDataRPC/sortLayout.ts'
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
} from '../shared/menuItems.ts'
import { getColorForModification } from '../util.ts'
import { CIGAR_TYPE_LABELS } from './components/alignmentComponentUtils.ts'
import { openCigarWidget } from './components/openFeatureWidget.ts'
import {
  INTERBASE_HARDCLIP,
  INTERBASE_INSERTION,
  INTERBASE_SOFTCLIP,
} from '../shared/types.ts'

import type { ColorPalette } from './components/AlignmentsRenderer.ts'
import type { VisibleLabel } from './components/computeVisibleLabels.ts'
import type {
  CigarHitResult,
  IndicatorHitResult,
} from './components/hitTesting.ts'
import type { PileupDataResult } from '../RenderPileupDataRPC/types'
import type { LegendItem } from '../shared/legendUtils.ts'
import type { ColorBy, FilterBy, SortedBy } from '../shared/types'
import type {
  FeatureData,
  GapData,
  HardclipData,
  InsertionData,
  MismatchData,
  SoftclipData,
} from '../shared/webglRpcTypes.ts'
import type { CoverageTicks } from '@jbrowse/alignments-core'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { MenuItem } from '@jbrowse/core/ui'
import type { Feature } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type {
  ExportSvgDisplayOptions,
  FetchContext,
  LinearGenomeViewModel,
  MultiRegionRegion as Region,
  MultiRegionRegionWithNumber as RegionWithNumber,
} from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

export {
  getInsertionType,
  insertionBarWidth as getInsertionRectWidthPx,
  textWidthForNumber,
} from './constants.ts'
export type { InsertionType } from './constants.ts'

export type { MultiRegionRegion as Region } from '@jbrowse/plugin-linear-genome-view'

function getSequenceAdapter(session: any, region: Region) {
  const assembly = region.assemblyName
    ? session.assemblyManager.get(region.assemblyName)
    : undefined
  const sequenceAdapterConfig = assembly?.configuration?.sequence?.adapter
  return sequenceAdapterConfig
    ? (getSnapshot(sequenceAdapterConfig) as Record<string, unknown>)
    : undefined
}

interface FetchFeatureDetailsSelf {
  adapterConfigSnapshot: Record<string, unknown>
  loadedRegions: Map<number, Region>
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
      .preProcessSnapshot((snap: any) => {
        if (!snap) {
          return snap
        }
        return migrateAlignmentsSnapshot(snap)
      })
      .volatile(() => ({
        featureIdUnderMouse: undefined as undefined | string,
        mouseoverExtraInformation: undefined as string | undefined,
        contextMenuFeature: undefined as Feature | undefined,
        contextMenuCoord: undefined as [number, number] | undefined,
        contextMenuCigarHit: undefined as CigarHitResult | undefined,
        contextMenuIndicatorHit: undefined as IndicatorHitResult | undefined,
        contextMenuRefName: undefined as string | undefined,
        rpcDataMap: new Map<number, PileupDataResult>(),
        webglRef: null as unknown,
        currentRangeY: [0, 600] as [number, number],
        maxY: 0,
        highlightedChainIds: [] as string[],
        selectedChainIds: [] as string[],
        colorTagMap: {} as Record<string, string>,
        visibleModifications: observable.map<string, any>({}),
        simplexModifications: new Set<string>(),
        modificationsReady: false,
        overCigarItem: false,
        colorPalette: null as ColorPalette | null,
        visibleMaxDepth: 0,
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
         * Override to prevent block rendering - we handle our own rendering
         * This must be a method (not a getter) that returns notReady: true
         */
        renderProps() {
          return { notReady: true }
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

        get coverageTicks(): CoverageTicks | undefined {
          if (!self.showCoverage || self.visibleMaxDepth === 0) {
            return undefined
          }
          return computeCoverageTicks(self.visibleMaxDepth, self.coverageHeight)
        },

        get legendItems(): LegendItem[] {
          return getReadDisplayLegendItems(self.getOverride<ColorBy>('colorBy'))
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
         * Cached O(1) index: featureId → {regionNumber, idx}.
         * Recomputed by MobX only when rpcDataMap changes.
         */
        get readIdIndexMap() {
          const map = new Map<string, { regionNumber: number; idx: number }>()
          for (const [regionNumber, rpcData] of self.rpcDataMap) {
            for (let i = 0; i < rpcData.readIds.length; i++) {
              const id = rpcData.readIds[i]
              if (id !== undefined) {
                map.set(id, { regionNumber, idx: i })
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
         * Find a feature by ID in rpcDataMap, returning the regionNumber,
         * index, and rpcData entry. Shared by searchFeatureByID and
         * getFeatureInfoById.
         */
        findFeatureInRpcData(featureId: string) {
          const entry = self.readIdIndexMap.get(featureId)
          if (!entry) {
            return undefined
          }
          const { regionNumber, idx } = entry
          const rpcData = self.rpcDataMap.get(regionNumber)
          if (!rpcData) {
            return undefined
          }
          const startOffset = rpcData.readPositions[idx * 2]
          const endOffset = rpcData.readPositions[idx * 2 + 1]
          if (startOffset !== undefined && endOffset !== undefined) {
            return { regionNumber, idx, rpcData, startOffset, endOffset }
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
            if (block.regionNumber === undefined) {
              continue
            }
            const data = self.rpcDataMap.get(block.regionNumber)
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
          const { rpcData, idx, startOffset, endOffset } = hit
          const yRow = rpcData.readYs[idx]
          if (yRow === undefined) {
            return undefined
          }
          const rowHeight = self.featureHeightSetting + self.featureSpacing
          const left = rpcData.regionStart + startOffset
          const right = rpcData.regionStart + endOffset
          const top = yRow * rowHeight
          const bottom = top + self.featureHeightSetting
          return [left, top, right, bottom]
        },

        getFeatureInfoById(featureId: string) {
          const hit = self.findFeatureInRpcData(featureId)
          if (!hit) {
            return undefined
          }
          const { regionNumber, idx, rpcData, startOffset, endOffset } = hit
          const view = getContainingView(self) as LGV
          const flags = rpcData.readFlags[idx]
          return {
            id: featureId,
            name: rpcData.readNames[idx] ?? '',
            start: rpcData.regionStart + startOffset,
            end: rpcData.regionStart + endOffset,
            flags,
            mapq: rpcData.readMapqs[idx],
            strand: flags !== undefined && flags & 16 ? '-' : '+',
            refName: view.displayedRegions[regionNumber]?.refName ?? 'unknown',
          }
        },
      }))
      // scrollableHeight depends on pileupViewportHeight above.
      .views(self => ({
        get scrollableHeight() {
          return Math.max(0, self.totalPileupHeight - self.pileupViewportHeight)
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

          setRpcData(regionNumber: number, data: PileupDataResult | null) {
            const next = new Map(self.rpcDataMap)
            if (data) {
              next.set(regionNumber, data)
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
              next.delete(regionNumber)
            }
            self.rpcDataMap = next
          },

          clearDisplaySpecificData() {
            self.rpcDataMap = new Map()
            self.arcsState.clearAllRpcData()
            self.currentRangeY = [0, 0]
            self.setRegionTooLarge(false)
          },

          setWebGLRef(ref: unknown) {
            self.webglRef = ref
          },

          setOverCigarItem(flag: boolean) {
            self.overCigarItem = flag
          },

          setColorPalette(palette: ColorPalette | null) {
            self.colorPalette = palette
          },

          setVisibleMaxDepth(d: number) {
            self.visibleMaxDepth = d
          },
          setMaxY(y: number) {
            self.maxY = y
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

          setFeatureHeight(height?: number) {
            self.setOverride('featureHeight', height)
            self.currentRangeY = [0, 0]
          },

          setNoSpacing(flag?: boolean) {
            self.setOverride('noSpacing', flag)
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
              filterBy: self.filterBy,
              colorBy: self.colorBy,
              colorTagMap: self.colorTagMap,
              sortedBy:
                self.sortedBy?.type === 'tag' ? self.sortedBy : undefined,
              showSoftClipping: self.showSoftClipping,
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
              filterBy: self.filterBy,
              colorBy: self.colorBy,
              colorTagMap: self.colorTagMap,
              drawSingletons: self.drawSingletons,
              drawProperPairs: self.drawProperPairs,
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
          regionNumber: number,
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
            regionNumber,
            result,
            region: {
              refName: region.refName,
              start: region.start,
              end: region.end,
              assemblyName: region.assemblyName,
            },
          }
        }

        function reconstructFromArrays(data: PileupDataResult) {
          const features: FeatureData[] = []
          for (let i = 0; i < data.numReads; i++) {
            features.push({
              id: data.readIds[i]!,
              name: data.readNames[i]!,
              start: data.regionStart + data.readPositions[i * 2]!,
              end: data.regionStart + data.readPositions[i * 2 + 1]!,
              flags: data.readFlags[i]!,
              mapq: data.readMapqs[i]!,
              avgBaseQuality: data.readAvgBaseQualities[i] ?? 30,
              insertSize: data.readInsertSizes[i]!,
              pairOrientation: data.readPairOrientations[i]!,
              strand: data.readStrands[i]!,
            })
          }

          const mismatches: MismatchData[] = []
          if (data.mismatchReadIndices) {
            for (let i = 0; i < data.numMismatches; i++) {
              mismatches.push({
                featureId: data.readIds[data.mismatchReadIndices[i]!]!,
                position: data.regionStart + data.mismatchPositions[i]!,
                base: data.mismatchBases[i]!,
                strand: data.mismatchStrands[i]!,
              })
            }
          }

          const gaps: GapData[] = []
          if (data.gapReadIndices) {
            for (let i = 0; i < data.numGaps; i++) {
              gaps.push({
                featureId: data.readIds[data.gapReadIndices[i]!]!,
                start: data.regionStart + data.gapPositions[i * 2]!,
                end: data.regionStart + data.gapPositions[i * 2 + 1]!,
                type: data.gapTypes[i] === 0 ? 'deletion' : 'skip',
                strand: 0,
                featureStrand: 0,
              })
            }
          }

          const insertions: InsertionData[] = []
          const softclips: SoftclipData[] = []
          const hardclips: HardclipData[] = []
          if (data.interbaseReadIndices) {
            for (let i = 0; i < data.numInterbases; i++) {
              const readIdx = data.interbaseReadIndices[i]!
              const featureId = data.readIds[readIdx]!
              const position = data.regionStart + data.interbasePositions[i]!
              const length = data.interbaseLengths[i]!
              const interbaseType = data.interbaseTypes[i]!
              if (interbaseType === INTERBASE_INSERTION) {
                insertions.push({
                  featureId,
                  position,
                  length,
                  sequence: data.interbaseSequences[i],
                })
              } else if (interbaseType === INTERBASE_SOFTCLIP) {
                const readStartOffset = data.readPositions[readIdx * 2]!
                const ibPosOffset = data.interbasePositions[i]!
                const isLeftClip = ibPosOffset === readStartOffset
                const clipStart = isLeftClip ? position - length : position
                softclips.push({ featureId, position, clipStart, length })
              } else if (interbaseType === INTERBASE_HARDCLIP) {
                hardclips.push({ featureId, position, length })
              }
            }
          }

          return {
            features,
            mismatches,
            gaps,
            insertions,
            softclips,
            hardclips,
          }
        }

        function fillYArraysFromLayout(
          data: PileupDataResult,
          layoutMap: Map<string, number>,
          maxY: number,
        ) {
          const yLookup = new Uint16Array(data.numReads)
          for (let i = 0; i < data.numReads; i++) {
            yLookup[i] = layoutMap.get(data.readIds[i]!) ?? 0
            data.readYs[i] = yLookup[i]!
          }

          if (data.gapReadIndices) {
            for (let i = 0; i < data.numGaps; i++) {
              data.gapYs[i] = yLookup[data.gapReadIndices[i]!]!
            }
          }
          if (data.mismatchReadIndices) {
            for (let i = 0; i < data.numMismatches; i++) {
              data.mismatchYs[i] = yLookup[data.mismatchReadIndices[i]!]!
            }
          }
          if (data.interbaseReadIndices) {
            for (let i = 0; i < data.numInterbases; i++) {
              data.interbaseYs[i] = yLookup[data.interbaseReadIndices[i]!]!
            }
          }
          if (data.modificationReadIndices) {
            for (let i = 0; i < data.numModifications; i++) {
              data.modificationYs[i] =
                yLookup[data.modificationReadIndices[i]!]!
            }
          }
          if (data.softclipBaseReadIndices) {
            for (let i = 0; i < data.numSoftclipBases; i++) {
              data.softclipBaseYs[i] =
                yLookup[data.softclipBaseReadIndices[i]!]!
            }
          }

          data.maxY = maxY
        }

        function computeAndAssignLayoutForData(
          rpcDataMap: Map<number, PileupDataResult>,
          sortedBy?: SortedBy,
          showSoftClipping?: boolean,
        ) {
          const entries = [...rpcDataMap.entries()].filter(
            ([, d]) => d.numReads > 0,
          )
          if (entries.length === 0) {
            return
          }

          if (entries.length === 1) {
            const [regionNumber, data] = entries[0]!
            const {
              features,
              mismatches,
              gaps,
              insertions,
              softclips,
              hardclips,
            } = reconstructFromArrays(data)

            const { layoutMap, maxY } =
              sortedBy && sortedBy.type !== 'tag'
                ? computeSortedLayout(
                    features,
                    mismatches,
                    gaps,
                    { insertions, softclips, hardclips },
                    undefined,
                    sortedBy,
                    showSoftClipping ? softclips : undefined,
                  )
                : computeLayout(
                    features,
                    showSoftClipping ? softclips : undefined,
                  )

            fillYArraysFromLayout(data, layoutMap, maxY)
            self.setRpcData(regionNumber, data)
          } else {
            const allFeatures = new Map<
              string,
              { start: number; end: number; strand: number }
            >()
            for (const [, data] of entries) {
              for (let i = 0; i < data.numReads; i++) {
                const id = data.readIds[i]!
                if (!allFeatures.has(id)) {
                  allFeatures.set(id, {
                    start: data.regionStart + data.readPositions[i * 2]!,
                    end: data.regionStart + data.readPositions[i * 2 + 1]!,
                    strand: data.readStrands[i]!,
                  })
                }
              }
            }

            const features: FeatureData[] = [...allFeatures.entries()].map(
              ([id, f]) => ({
                id,
                name: '',
                start: f.start,
                end: f.end,
                flags: 0,
                mapq: 0,
                avgBaseQuality: 30,
                insertSize: 0,
                pairOrientation: 0,
                strand: f.strand,
              }),
            )

            const { layoutMap, maxY } = computeLayout(features)

            for (const [regionNumber, data] of entries) {
              fillYArraysFromLayout(data, layoutMap, maxY)
              self.setRpcData(regionNumber, data)
            }
          }
        }

        function computeAndSetArcs(regions: RegionWithNumber[]) {
          const allRegionInfos: {
            refName: string
            start: number
            end: number
            regionNumber: number
          }[] = []
          const addedRegionNumbers = new Set<number>()
          for (const [regionNumber, loaded] of self.loadedRegions) {
            allRegionInfos.push({
              refName: loaded.refName,
              start: loaded.start,
              end: loaded.end,
              regionNumber,
            })
            addedRegionNumbers.add(regionNumber)
          }
          for (const { region, regionNumber } of regions) {
            if (!addedRegionNumbers.has(regionNumber)) {
              allRegionInfos.push({ ...region, regionNumber })
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
            const data = self.rpcDataMap.get(ri.regionNumber)
            if (!data) {
              continue
            }
            const result = arcsToRegionResult(
              arcs,
              lines,
              ri.refName,
              data.regionStart,
              self.height,
            )
            self.arcsState.setRpcData(ri.regionNumber, result)
          }
        }

        let prevInvalidationKey: string | undefined
        const superAfterAttach = self.afterAttach

        return {
          async fetchFeatures(region: Region, regionNumber = 0) {
            self.onFetchNeeded([{ region, regionNumber }])
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

          onFetchNeeded(needed: RegionWithNumber[]) {
            self.withFetchLifecycle(needed, async (ctx: FetchContext) => {
              const promises = needed.map(({ region, regionNumber }) =>
                fetchFeaturesForRegion(
                  self.adapterConfigSnapshot,
                  region,
                  regionNumber,
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
                newDataMap.set(r.regionNumber, r.result)
              }
              if (
                self.renderingMode !== 'linkedRead' &&
                self.sortedBy?.type !== 'tag'
              ) {
                computeAndAssignLayoutForData(
                  newDataMap,
                  self.sortedBy,
                  self.showSoftClipping,
                )
              } else {
                for (const [regionNumber, data] of newDataMap) {
                  self.setRpcData(regionNumber, data)
                }
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

            // Debounced autorun: compute visible max depth from only visible bins.
            addDisposer(
              self,
              autorun(
                () => {
                  if (!self.showCoverage) {
                    return
                  }
                  const view = getContainingView(self) as LGV
                  if (!view.initialized) {
                    return
                  }
                  const maxDepth = computeVisibleMaxDepth(
                    view.dynamicBlocks.contentBlocks,
                    b => self.rpcDataMap.get(b.regionNumber!),
                  )
                  self.setVisibleMaxDepth(maxDepth)
                },
                {
                  delay: 400,
                  name: 'LinearAlignmentsDisplay:visibleMaxDepth',
                },
              ),
            )

            // Autorun: invalidate data when any setting that affects the
            // worker-side RPC result changes (displayedRegions handled by mixin)
            addDisposer(
              self,
              autorun(
                () => {
                  const key = JSON.stringify({
                    filterBy: self.filterBy,
                    showLinkedReads: self.showLinkedReads,
                    showArcs: self.showArcs,
                    drawInter: self.arcsState.drawInter,
                    drawLongRange: self.arcsState.drawLongRange,
                    drawSingletons: self.drawSingletons,
                    drawProperPairs: self.drawProperPairs,
                    colorType: self.colorBy.type,
                    colorTag: self.colorBy.tag,
                    showSoftClipping: self.showSoftClipping,
                  })
                  if (
                    prevInvalidationKey !== undefined &&
                    key !== prevInvalidationKey
                  ) {
                    self.setError(undefined)
                    self.clearAllRpcData()
                  }
                  prevInvalidationKey = key
                },
                { name: 'LinearAlignmentsDisplay:invalidateData' },
              ),
            )

            // Autorun: recompute arcs when arc color scheme changes (no
            // RPC refetch needed — arcs are derived from pileup data)
            let prevArcColorByType: string | undefined
            addDisposer(
              self,
              autorun(
                () => {
                  const colorByType = self.arcsState.colorByType
                  if (prevArcColorByType === undefined) {
                    prevArcColorByType = colorByType
                    return
                  }
                  if (colorByType === prevArcColorByType) {
                    return
                  }
                  prevArcColorByType = colorByType
                  if (self.showArcs && self.rpcDataMap.size > 0) {
                    const view = getContainingView(self) as LGV
                    computeAndSetArcs(
                      view.mergedVisibleRegions.map(vr => ({
                        region: vr,
                        regionNumber: vr.regionNumber,
                      })),
                    )
                  }
                },
                { name: 'LinearAlignmentsDisplay:recomputeArcColors' },
              ),
            )

            // Autorun: recompute layout when sort changes (no RPC refetch needed
            // for non-tag sorts). Tag sort falls through to refetch.
            let prevSortKey: string | undefined
            addDisposer(
              self,
              autorun(
                () => {
                  const sortedBy = self.sortedBy
                  const showSoftClipping = self.showSoftClipping
                  const sortKey = JSON.stringify({ sortedBy, showSoftClipping })
                  if (prevSortKey === undefined) {
                    prevSortKey = sortKey
                    return
                  }
                  if (sortKey === prevSortKey) {
                    return
                  }
                  prevSortKey = sortKey

                  if (
                    self.rpcDataMap.size === 0 ||
                    self.renderingMode === 'linkedRead'
                  ) {
                    return
                  }

                  if (sortedBy?.type === 'tag') {
                    self.clearAllRpcData()
                    return
                  }

                  computeAndAssignLayoutForData(
                    self.rpcDataMap,
                    sortedBy,
                    showSoftClipping,
                  )
                },
                { name: 'LinearAlignmentsDisplay:sortLayout' },
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
            getFeatureHeightMenuItem(self),
            getShowMenuItem(self),
            getSetMaxHeightMenuItem(self),
            getFiltersMenuItem(self, { showPairFilters: self.isChainMode }),
            getSortByMenuItem(self),
            colorByMenu,
            getGroupByMenuItem(self),
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
