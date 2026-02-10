import { createElement, lazy } from 'react'

import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import {
  SimpleFeature,
  getContainingTrack,
  getContainingView,
  getRpcSessionId,
  getSession,
  isSessionModelWithWidgets,
} from '@jbrowse/core/util'
import {
  addDisposer,
  getSnapshot,
  isAlive,
  types,
} from '@jbrowse/mobx-state-tree'
import {
  TooLargeMessage,
  TrackHeightMixin,
} from '@jbrowse/plugin-linear-genome-view'
import { scaleLinear, scaleLog } from '@mui/x-charts-vendor/d3-scale'
import { autorun, observable } from 'mobx'

import { ArcsSubModel } from './ArcsSubModel.ts'
import { CloudSubModel } from './CloudSubModel.ts'
import { getReadDisplayLegendItems } from '../shared/legendUtils.ts'
import { getModificationsSubMenu } from '../shared/menuItems.ts'
import { getColorForModification } from '../util.ts'

import type { CloudTicks } from './components/CloudYScaleBar.tsx'
import type { CoverageTicks } from './components/CoverageYScaleBar.tsx'
import type { WebGLArcsDataResult } from '../RenderWebGLArcsDataRPC/types.ts'
import type { WebGLPileupDataResult } from '../RenderWebGLPileupDataRPC/types'
import type { LegendItem } from '../shared/legendUtils.ts'
import type { ColorBy, FilterBy } from '../shared/types'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { Feature } from '@jbrowse/core/util'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type {
  ExportSvgDisplayOptions,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

// Offset for Y scalebar labels (same as wiggle plugin)
export const YSCALEBAR_LABEL_OFFSET = 5

// Insertion rendering thresholds (shared between WebGL shader and component)
// Long insertions (>=10bp) show text box when zoomed in, small rectangle when zoomed out
export const LONG_INSERTION_MIN_LENGTH = 10
export const LONG_INSERTION_TEXT_THRESHOLD_PX = 15 // min pixels to show text box

// Insertion type classification - must match shader logic in WebGLRenderer.ts
export type InsertionType = 'large' | 'long' | 'small'

/**
 * Classify an insertion based on its length and current zoom level.
 * - 'large': length >= 10bp AND wide enough to show text (>= 15px)
 * - 'long': length >= 10bp but too zoomed out for text
 * - 'small': length < 10bp
 */
export function getInsertionType(
  length: number,
  pxPerBp: number,
): InsertionType {
  const isLongInsertion = length >= LONG_INSERTION_MIN_LENGTH
  if (isLongInsertion) {
    const insertionWidthPx = length * pxPerBp
    if (insertionWidthPx >= LONG_INSERTION_TEXT_THRESHOLD_PX) {
      return 'large'
    }
    return 'long'
  }
  return 'small'
}

/**
 * Calculate the pixel width needed to display a number as text.
 * Must match the textWidthForNumber function in the insertion vertex shader.
 */
export function textWidthForNumber(num: number): number {
  const charWidth = 6
  const padding = 10
  if (num < 10) {
    return charWidth + padding
  }
  if (num < 100) {
    return charWidth * 2 + padding
  }
  if (num < 1000) {
    return charWidth * 3 + padding
  }
  if (num < 10000) {
    return charWidth * 4 + padding
  }
  return charWidth * 5 + padding
}

/**
 * Get the rectangle width in pixels for an insertion marker.
 * Must match the shader logic in WebGLRenderer.ts.
 */
export function getInsertionRectWidthPx(
  length: number,
  pxPerBp: number,
): number {
  const type = getInsertionType(length, pxPerBp)
  if (type === 'large') {
    return textWidthForNumber(length)
  }
  if (type === 'long') {
    return 2 // small solid rectangle
  }
  return Math.min(pxPerBp, 1) // thin bar, subpixel when zoomed out
}

export interface Region {
  refName: string
  start: number
  end: number
  assemblyName?: string
}

function getDisplayStr(totalBytes: number) {
  if (Math.floor(totalBytes / 1000000) > 0) {
    return `${Number.parseFloat((totalBytes / 1000000).toPrecision(3))} Mb`
  }
  if (Math.floor(totalBytes / 1000) > 0) {
    return `${Number.parseFloat((totalBytes / 1000).toPrecision(3))} Kb`
  }
  return `${Math.floor(totalBytes)} bytes`
}

function getSequenceAdapter(session: any, region: Region) {
  const assembly = region.assemblyName
    ? session.assemblyManager.get(region.assemblyName)
    : undefined
  const sequenceAdapterConfig = assembly?.configuration?.sequence?.adapter
  return sequenceAdapterConfig ? getSnapshot(sequenceAdapterConfig) : undefined
}

const WebGLAlignmentsComponent = lazy(
  () => import('./components/WebGLAlignmentsComponent.tsx'),
)

const WebGLTooltip = lazy(() => import('./components/WebGLTooltip.tsx'))
const ColorByTagDialog = lazy(
  () => import('../shared/components/ColorByTagDialog.tsx'),
)
const SetFeatureHeightDialog = lazy(
  () => import('../shared/components/SetFeatureHeightDialog.tsx'),
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
} as const

/**
 * State model factory for LinearAlignmentsDisplay
 */
export default function stateModelFactory(
  configSchema: AnyConfigurationSchemaType,
) {
  return types
    .compose(
      'LinearAlignmentsDisplay',
      BaseDisplay,
      TrackHeightMixin(),
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
        renderingMode: types.optional(
          types.enumeration(['pileup', 'arcs', 'cloud', 'linkedRead']),
          'pileup',
        ),
        /**
         * #property
         */
        colorBySetting: types.frozen<ColorBy | undefined>(),
        /**
         * #property
         */
        filterBySetting: types.frozen<FilterBy | undefined>(),
        /**
         * #property
         */
        featureHeight: types.maybe(types.number),
        /**
         * #property
         */
        noSpacing: types.maybe(types.boolean),
        /**
         * #property
         */
        showSashimiArcs: true,
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
         * Show upside-down histogram bars for insertion/softclip/hardclip counts
         */
        showInterbaseCounts: true,
        /**
         * #property
         * Show triangular indicators at positions with significant interbase events
         */
        showInterbaseIndicators: true,
        /**
         * #property
         */
        showYScalebar: true,
        /**
         * #property
         */
        showLegend: types.maybe(types.boolean),
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
        arcsState: types.optional(ArcsSubModel, {}),
        /**
         * #property
         */
        cloudState: types.optional(CloudSubModel, {}),
        /**
         * #property
         * For backwards compatibility: migration from old LinearSNPCoverageDisplay
         */
        jexlFilters: types.optional(types.array(types.string), []),
      }),
    )
    .preProcessSnapshot((snap: any) => {
      if (!snap) {
        return snap
      }

      // Strip properties from old BaseLinearDisplayNoFeatureDensity snapshots

      const { blockState, showTooltips, ...cleaned } = snap
      snap = cleaned

      // Rewrite "height" from older snapshots to "heightPreConfig"
      // (previously handled by BaseLinearDisplayNoFeatureDensity)
      if (snap.height !== undefined && snap.heightPreConfig === undefined) {
        const { height, ...rest } = snap
        snap = { ...rest, heightPreConfig: height }
      }

      // Migrate LinearSNPCoverageDisplay snapshots to LinearAlignmentsDisplay
      if (snap.type === 'LinearSNPCoverageDisplay') {
        const {
          type,
          showArcs,
          minArcScore,
          showInterbaseCounts,
          showInterbaseIndicators,
          colorBySetting,
          filterBySetting,
          jexlFilters,
          ...rest
        } = snap

        return {
          ...rest,
          type: 'LinearAlignmentsDisplay',
          showSashimiArcs: showArcs ?? true,
          showInterbaseCounts: showInterbaseCounts ?? true,
          showInterbaseIndicators: showInterbaseIndicators ?? true,
          showCoverage: true,
          coverageHeight: 45,
          showMismatches: true,
          renderingMode: 'pileup',
          colorBySetting,
          filterBySetting,
          jexlFilters: jexlFilters ?? [],
        }
      }

      return snap
    })
    .volatile(() => ({
      featureIdUnderMouse: undefined as undefined | string,
      mouseoverExtraInformation: undefined as string | undefined,
      contextMenuFeature: undefined as Feature | undefined,
      userByteSizeLimit: undefined as number | undefined,
      regionTooLargeState: false,
      regionTooLargeReasonState: '',
      featureDensityStats: undefined as
        | undefined
        | { bytes?: number; fetchSizeLimit?: number },
      fetchToken: 0,
      rpcDataMap: new Map<number, WebGLPileupDataResult>(),
      loadedRegions: new Map<number, Region>(),
      isLoading: true,
      statusMessage: 'Loading',
      error: null as Error | null,
      webglRef: null as unknown,
      currentRangeY: [0, 600] as [number, number],
      maxY: 0,
      highlightedFeatureIndex: -1,
      selectedFeatureIndex: -1,
      highlightedChainIndices: [] as number[],
      selectedChainIndices: [] as number[],
      colorTagMap: {} as Record<string, string>,
      tagsReady: true,
      // From SharedModificationsMixin
      visibleModifications: observable.map<string, any>({}),
      simplexModifications: new Set<string>(),
      modificationsReady: false,
    }))
    .views(self => ({
      /**
       * Use custom component instead of block-based rendering
       */
      get DisplayMessageComponent() {
        return WebGLAlignmentsComponent
      },

      /**
       * Custom tooltip that prioritizes mouseoverExtraInformation for CIGAR items
       */
      get TooltipComponent() {
        return WebGLTooltip
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
        return self.colorBySetting ?? getConf(self, 'colorBy')
      },

      get modificationThreshold() {
        return this.colorBy.modifications?.threshold ?? 10
      },

      get filterBy(): FilterBy {
        return self.filterBySetting ?? getConf(self, 'filterBy')
      },

      get featureHeightSetting(): number {
        return self.featureHeight ?? getConf(self, 'featureHeight') ?? 7
      },

      get noSpacingSetting(): boolean | undefined {
        return self.noSpacing
      },

      get featureSpacing(): number {
        if (self.noSpacing !== undefined) {
          return self.noSpacing ? 0 : 2
        }
        return getConf(self, 'featureSpacing') ?? 1
      },

      get maxHeight(): number {
        return getConf(self, 'maxHeight') ?? 1200
      },

      /**
       * Backward-compat getter: returns first entry in rpcDataMap
       */
      get rpcData(): WebGLPileupDataResult | null {
        const iter = self.rpcDataMap.values().next()
        return iter.done ? null : iter.value
      },

      /**
       * Chain index map: readName → array of feature indices
       * Used in cloud/linkedRead modes for chain-level highlighting
       * Cached as a MST getter so it only recomputes when rpcDataMap changes
       */
      get chainIndexMap() {
        const map = new Map<string, number[]>()
        if (
          self.renderingMode === 'cloud' ||
          self.renderingMode === 'linkedRead'
        ) {
          for (const data of self.rpcDataMap.values()) {
            for (let i = 0; i < data.numReads; i++) {
              const name = data.readNames[i]
              if (name) {
                let indices = map.get(name)
                if (!indices) {
                  indices = []
                  map.set(name, indices)
                }
                indices.push(i)
              }
            }
          }
        }
        return map
      },

      /**
       * Backward-compat getter: returns first entry in loadedRegions
       */
      get loadedRegion(): Region | null {
        const iter = self.loadedRegions.values().next()
        return iter.done ? null : iter.value
      },

      get visibleBpRange(): [number, number] | null {
        try {
          const view = getContainingView(self) as LGV
          if (!view.initialized) {
            return null
          }
          const blocks = view.dynamicBlocks.contentBlocks
          const first = blocks[0]
          if (!first) {
            return null
          }
          const width = view.width
          const bpPerPx = view.bpPerPx
          const blockOffsetPx = first.offsetPx ?? 0
          const deltaPx = view.offsetPx - blockOffsetPx
          const deltaBp = deltaPx * bpPerPx

          const last = blocks[blocks.length - 1]
          if (first.refName === last?.refName) {
            const rangeStart = first.start + deltaBp
            const rangeEnd = rangeStart + width * bpPerPx
            return [rangeStart, rangeEnd]
          }

          const rangeStart = first.start + deltaBp
          const blockEndPx = blockOffsetPx + (first.widthPx ?? 0)
          const clippedEndPx = Math.min(view.offsetPx + width, blockEndPx)
          const rangeEnd =
            first.start + (clippedEndPx - blockOffsetPx) * bpPerPx
          return [rangeStart, rangeEnd]
        } catch {
          return null
        }
      },

      get visibleRegion() {
        try {
          const view = getContainingView(self) as LGV
          if (!view.initialized) {
            return null
          }
          const blocks = view.dynamicBlocks.contentBlocks
          const first = blocks[0]
          if (!first) {
            return null
          }

          const bpRange = this.visibleBpRange
          if (bpRange) {
            return {
              refName: first.refName,
              start: bpRange[0],
              end: bpRange[1],
              assemblyName: first.assemblyName,
            }
          }

          const regions = view.visibleRegions
          if (regions.length === 0) {
            return null
          }
          return {
            refName: regions[0]!.refName,
            start: regions[0]!.start,
            end: regions[0]!.end,
            assemblyName: regions[0]!.assemblyName,
          }
        } catch {
          return null
        }
      },

      /**
       * Calculate color scheme index from colorBy setting
       */
      get colorSchemeIndex(): number {
        const colorBy = this.colorBy
        switch (colorBy.type) {
          case 'normal':
            return ColorScheme.normal
          case 'strand':
            return ColorScheme.strand
          case 'mappingQuality':
            return ColorScheme.mappingQuality
          case 'insertSize':
            return ColorScheme.insertSize
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
          default:
            return ColorScheme.normal
        }
      },

      get showModifications(): boolean {
        const t = this.colorBy.type
        return t === 'modifications' || t === 'methylation'
      },

      get showLoading() {
        return self.isLoading || !this.visibleRegion
      },

      get regionTooLarge() {
        return self.regionTooLargeState
      },

      get regionTooLargeReason() {
        return self.regionTooLargeReasonState
      },

      regionCannotBeRenderedText(_region: any) {
        return self.regionTooLargeState ? 'Force load to see features' : ''
      },

      regionCannotBeRendered(_region: any) {
        return self.regionTooLargeState
          ? createElement(TooLargeMessage, { model: self as any })
          : null
      },

      get sortedBy() {
        return undefined
      },

      get coverageTicks(): CoverageTicks | undefined {
        if (!self.showCoverage) {
          return undefined
        }
        // Find max depth across all loaded regions
        let maxDepth = 0
        for (const data of self.rpcDataMap.values()) {
          if (data.coverageMaxDepth > maxDepth) {
            maxDepth = data.coverageMaxDepth
          }
        }
        if (maxDepth === 0) {
          return undefined
        }
        const height = self.coverageHeight
        // Add offset so tick labels at top/bottom don't get clipped
        const scale = scaleLinear()
          .domain([0, maxDepth])
          .range([height - YSCALEBAR_LABEL_OFFSET, YSCALEBAR_LABEL_OFFSET])
          .nice()

        // Use minimal ticks (just min/max) when height is small
        const niceDomain = scale.domain()
        const tickValues = height < 70 ? niceDomain : scale.ticks(4)
        const ticks = tickValues.map(value => ({
          value,
          y: scale(value),
        }))

        return { ticks, height, maxDepth }
      },

      get cloudTicks(): CloudTicks | undefined {
        if (self.renderingMode !== 'cloud' || !self.showYScalebar) {
          return undefined
        }
        const iter = self.rpcDataMap.values().next()
        const rpcData = iter.done ? undefined : iter.value
        const maxDistance = rpcData?.maxDistance
        if (!maxDistance || maxDistance <= 0) {
          return undefined
        }
        const pileupHeight =
          self.height - (self.showCoverage ? self.coverageHeight : 0)
        if (pileupHeight <= 0) {
          return undefined
        }
        const scale = scaleLog()
          .base(2)
          .domain([1, Math.max(2, maxDistance)])
          .range([0, pileupHeight - 20])
          .clamp(true)
        const ticks = scale.ticks(6).map(value => ({
          value,
          y: scale(value),
        }))
        return { ticks, height: pileupHeight, maxDistance }
      },

      get legendItems(): LegendItem[] {
        return getReadDisplayLegendItems(self.colorBySetting)
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
       * Effective coverage display height for BreakpointSplitView overlay
       * Y offset. Returns 0 when coverage is hidden.
       */
      get coverageDisplayHeight() {
        return self.showCoverage ? self.coverageHeight : 0
      },

      /**
       * Find a feature by ID in rpcDataMap, returning the regionNumber,
       * index, and rpcData entry. Shared by searchFeatureByID and
       * getFeatureInfoById.
       */
      findFeatureInRpcData(featureId: string) {
        for (const [regionNumber, rpcData] of self.rpcDataMap) {
          const idx = rpcData.readIds.indexOf(featureId)
          if (idx === -1) {
            continue
          }
          const startOffset = rpcData.readPositions[idx * 2]
          const endOffset = rpcData.readPositions[idx * 2 + 1]
          if (startOffset !== undefined && endOffset !== undefined) {
            return { regionNumber, idx, rpcData, startOffset, endOffset }
          }
        }
        return undefined
      },

      /**
       * Return a LayoutRecord [left, top, right, bottom] for
       * BreakpointSplitView overlay compatibility.
       */
      searchFeatureByID(
        featureId: string,
      ): [number, number, number, number] | undefined {
        const hit = this.findFeatureInRpcData(featureId)
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
        const hit = this.findFeatureInRpcData(featureId)
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
    .actions(self => ({
      setRegionTooLarge(val: boolean, reason?: string) {
        self.regionTooLargeState = val
        self.regionTooLargeReasonState = reason ?? ''
      },

      setFeatureDensityStats(stats?: {
        bytes?: number
        fetchSizeLimit?: number
      }) {
        self.featureDensityStats = stats
      },

      setFeatureDensityStatsLimit(stats?: {
        bytes?: number
        fetchSizeLimit?: number
      }) {
        if (stats?.bytes) {
          self.userByteSizeLimit = stats.bytes
        }
        self.regionTooLargeState = false
        self.regionTooLargeReasonState = ''
      },

      setRpcData(regionNumber: number, data: WebGLPileupDataResult | null) {
        const next = new Map(self.rpcDataMap)
        if (data) {
          next.set(regionNumber, data)
          // Update visible modifications from newly detected modifications
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

        // Update maxY to be max across all regions
        let maxY = 0
        for (const d of next.values()) {
          if (d.maxY > maxY) {
            maxY = d.maxY
          }
        }
        self.maxY = maxY
      },

      clearAllRpcData() {
        self.rpcDataMap = new Map()
        self.loadedRegions = new Map()
      },

      bumpFetchToken() {
        self.fetchToken++
      },

      setLoadedRegion(regionNumber: number, region: Region | null) {
        const next = new Map(self.loadedRegions)
        if (region) {
          next.set(regionNumber, region)
        } else {
          next.delete(regionNumber)
        }
        self.loadedRegions = next
      },

      setLoading(loading: boolean) {
        self.isLoading = loading
      },

      setStatusMessage(msg?: string) {
        self.statusMessage = msg ?? ''
      },

      setError(error: Error | null) {
        self.error = error
      },

      setWebGLRef(ref: unknown) {
        self.webglRef = ref
      },

      setMaxY(y: number) {
        self.maxY = y
        // Auto-resize height based on content
        const rowHeight = self.featureHeightSetting + self.featureSpacing
        const pileupHeight = y * rowHeight
        const totalHeight =
          (self.showCoverage ? self.coverageHeight : 0) + pileupHeight + 10
        // Clamp to maxHeight and ensure a minimum height
        const clampedHeight = Math.min(
          Math.max(totalHeight, 100),
          self.maxHeight,
        )
        self.setHeight(clampedHeight)
      },

      setCurrentRangeY(rangeY: [number, number]) {
        const cur = self.currentRangeY
        if (cur[0] !== rangeY[0] || cur[1] !== rangeY[1]) {
          self.currentRangeY = rangeY
        }
      },

      setHighlightedFeatureIndex(index: number) {
        self.highlightedFeatureIndex = index
      },

      setSelectedFeatureIndex(index: number) {
        self.selectedFeatureIndex = index
      },

      setHighlightedChainIndices(indices: number[]) {
        self.highlightedChainIndices = indices
      },

      clearHighlights() {
        if (self.highlightedFeatureIndex !== -1) {
          self.highlightedFeatureIndex = -1
        }
        if (self.highlightedChainIndices.length > 0) {
          self.highlightedChainIndices = []
        }
      },

      setSelectedChainIndices(indices: number[]) {
        self.selectedChainIndices = indices
      },

      setColorScheme(colorBy: ColorBy) {
        self.colorTagMap = {}
        self.colorBySetting = colorBy
        if (colorBy.tag) {
          self.tagsReady = false
        }
      },

      setTagsReady(flag: boolean) {
        self.tagsReady = flag
      },

      updateColorTagMap(uniqueTag: string[]) {
        const colorPalette = [
          '#BBCCEE',
          'pink',
          '#CCDDAA',
          '#EEEEBB',
          '#FFCCCC',
          'lightblue',
          'lightgreen',
          'tan',
          '#CCEEFF',
          'lightsalmon',
        ]
        const map = { ...self.colorTagMap }
        for (const value of uniqueTag) {
          if (!map[value]) {
            const totalKeys = Object.keys(map).length
            map[value] = colorPalette[totalKeys % colorPalette.length]!
          }
        }
        self.colorTagMap = map
      },

      setFilterBy(filterBy: FilterBy) {
        self.filterBySetting = filterBy
      },

      setFeatureHeight(height?: number) {
        self.featureHeight = height
      },

      setNoSpacing(flag?: boolean) {
        self.noSpacing = flag
      },

      setShowSashimiArcs(show: boolean) {
        self.showSashimiArcs = show
      },

      setShowCoverage(show: boolean) {
        self.showCoverage = show
      },

      setCoverageHeight(height: number) {
        self.coverageHeight = height
      },

      setShowMismatches(show: boolean) {
        self.showMismatches = show
      },

      setShowYScalebar(show: boolean) {
        self.showYScalebar = show
      },

      setShowLegend(show: boolean | undefined) {
        self.showLegend = show
      },

      setDrawSingletons(flag: boolean) {
        self.drawSingletons = flag
      },

      setDrawProperPairs(flag: boolean) {
        self.drawProperPairs = flag
      },

      setShowInterbaseCounts(show: boolean) {
        self.showInterbaseCounts = show
      },

      setShowInterbaseIndicators(show: boolean) {
        self.showInterbaseIndicators = show
      },

      setRenderingMode(mode: 'pileup' | 'arcs' | 'cloud' | 'linkedRead') {
        self.renderingMode = mode
        self.colorBySetting =
          mode === 'pileup'
            ? { type: 'normal' }
            : { type: 'insertSizeAndOrientation' }
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

      async selectFeatureById(featureId: string) {
        const session = getSession(self)
        const { rpcManager } = session
        try {
          const track = getContainingTrack(self)
          const adapterConfig = getConf(track, 'adapter')

          // Use the feature's known position from typed arrays to narrow the
          // query region, avoiding a full re-fetch of the entire loaded region
          const info = self.getFeatureInfoById(featureId)
          if (!info) {
            return
          }
          // Find the loaded region that contains this feature
          let assemblyName: string | undefined
          for (const loaded of self.loadedRegions.values()) {
            if (loaded.refName === info.refName) {
              assemblyName = loaded.assemblyName
              break
            }
          }
          const region = {
            refName: info.refName,
            start: info.start,
            end: info.end,
            assemblyName,
          }

          const sequenceAdapter = getSequenceAdapter(session, region)

          const sessionId = getRpcSessionId(self)
          const { feature } = (await rpcManager.call(
            sessionId,
            'WebGLGetFeatureDetails',
            {
              sessionId,
              adapterConfig,
              sequenceAdapter,
              region,
              featureId,
            },
          )) as {
            feature:
              | (Record<string, unknown> & { uniqueId: string })
              | undefined
          }

          if (isAlive(self) && feature && isSessionModelWithWidgets(session)) {
            const feat = new SimpleFeature(
              feature as ConstructorParameters<typeof SimpleFeature>[0],
            )
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
        } catch (e) {
          console.error(e)
          session.notifyError(`${e}`, e)
        }
      },
    }))
    .actions(self => {
      const fetchGenerations = new Map<number, number>()

      async function fetchPileupData(
        session: { rpcManager: any },
        adapterConfig: unknown,
        sequenceAdapter: unknown,
        region: Region,
        regionNumber: number,
      ) {
        const sessionId = getRpcSessionId(self)
        const result = (await session.rpcManager.call(
          sessionId,
          'RenderWebGLPileupData',
          {
            sessionId,
            adapterConfig,
            sequenceAdapter,
            region,
            filterBy: self.filterBy,
            colorBy: self.colorBy,
            colorTagMap: self.colorTagMap,
            statusCallback: (msg: string) => {
              if (isAlive(self)) {
                self.setStatusMessage(msg)
              }
            },
          },
        )) as WebGLPileupDataResult
        self.setRpcData(regionNumber, result)
        // Mark modifications as ready since we detected what's available
        self.setModificationsReady(true)
        self.setSimplexModifications(result.simplexModifications)
      }

      async function fetchArcsData(
        session: { rpcManager: any },
        adapterConfig: unknown,
        sequenceAdapter: unknown,
        region: Region,
        regionNumber: number,
      ) {
        const sessionId = getRpcSessionId(self)
        const result = (await session.rpcManager.call(
          sessionId,
          'RenderWebGLArcsData',
          {
            sessionId,
            adapterConfig,
            sequenceAdapter,
            region,
            filterBy: self.filterBy,
            colorBy: self.colorBy,
            height: self.height,
            drawInter: self.arcsState.drawInter,
            drawLongRange: self.arcsState.drawLongRange,
          },
        )) as WebGLArcsDataResult
        self.arcsState.setRpcData(regionNumber, result)
      }

      async function fetchChainData(
        session: { rpcManager: any },
        adapterConfig: unknown,
        sequenceAdapter: unknown,
        region: Region,
        regionNumber: number,
      ) {
        const sessionId = getRpcSessionId(self)
        const result = (await session.rpcManager.call(
          sessionId,
          'RenderWebGLChainData',
          {
            sessionId,
            adapterConfig,
            sequenceAdapter,
            region,
            filterBy: self.filterBy,
            colorBy: self.colorBy,
            colorTagMap: self.colorTagMap,
            layoutMode: self.renderingMode as 'cloud' | 'linkedRead',
            height: self.height,
            drawSingletons: self.drawSingletons,
            drawProperPairs: self.drawProperPairs,
            statusCallback: (msg: string) => {
              if (isAlive(self)) {
                self.setStatusMessage(msg)
              }
            },
          },
        )) as WebGLPileupDataResult
        self.setRpcData(regionNumber, result)
        self.setModificationsReady(true)
        self.setSimplexModifications(result.simplexModifications)
      }

      // Estimate bytes for a region via adapter index (cheap, no feature fetch).
      // Returns the stats without modifying model state — the caller applies
      // state changes only after passing the generation staleness check.
      async function fetchByteEstimate(adapterConfig: unknown, region: Region) {
        const session = getSession(self)
        const sessionId = getRpcSessionId(self)
        const stats = (await session.rpcManager.call(
          sessionId,
          'CoreGetFeatureDensityStats',
          {
            sessionId,
            regions: [region],
            adapterConfig,
          },
        )) as { bytes?: number; fetchSizeLimit?: number } | undefined
        return stats
      }

      // Central chokepoint: ALL data fetches go through here.
      // visibleRegion is used for byte estimation (the actual viewport),
      // fetchRegion is the expanded region used for data pre-fetching.
      async function fetchFeaturesForRegion(
        fetchRegion: Region,
        visibleRegion: Region,
        regionNumber: number,
      ) {
        const session = getSession(self)
        const track = getContainingTrack(self)
        const adapterConfig = getConf(track, 'adapter')

        if (!adapterConfig) {
          return
        }

        const gen = (fetchGenerations.get(regionNumber) ?? 0) + 1
        fetchGenerations.set(regionNumber, gen)
        self.setLoading(true)
        self.setError(null)

        try {
          // Byte estimation on the VISIBLE region (not the expanded fetch
          // region) so that zooming in clears the warning promptly.
          // State is applied only after the generation check so that stale
          // RPC responses from older zoom levels can't overwrite newer results.
          const stats = await fetchByteEstimate(adapterConfig, visibleRegion)
          if (fetchGenerations.get(regionNumber) !== gen) {
            return
          }
          self.setFeatureDensityStats(stats ?? undefined)
          const fetchSizeLimit =
            stats?.fetchSizeLimit ?? getConf(self, 'fetchSizeLimit')
          const limit = self.userByteSizeLimit || fetchSizeLimit
          if (stats?.bytes && stats.bytes > limit) {
            self.setRegionTooLarge(
              true,
              `Requested too much data (${getDisplayStr(stats.bytes)})`,
            )
            self.setLoading(false)
            return
          }
          self.setRegionTooLarge(false)

          const sequenceAdapter = getSequenceAdapter(session, fetchRegion)

          // Chain modes (cloud/linkedRead) produce all data in a single RPC
          // (reads + coverage + connecting lines). Other modes fetch pileup
          // for coverage and add mode-specific data on top.
          if (
            self.renderingMode === 'cloud' ||
            self.renderingMode === 'linkedRead'
          ) {
            await fetchChainData(
              session,
              adapterConfig,
              sequenceAdapter,
              fetchRegion,
              regionNumber,
            )
          } else {
            await fetchPileupData(
              session,
              adapterConfig,
              sequenceAdapter,
              fetchRegion,
              regionNumber,
            )
            if (self.renderingMode === 'arcs') {
              await fetchArcsData(
                session,
                adapterConfig,
                sequenceAdapter,
                fetchRegion,
                regionNumber,
              )
            }
          }

          // Discard stale responses from older requests for this regionNumber
          if (fetchGenerations.get(regionNumber) !== gen) {
            return
          }

          self.setLoadedRegion(regionNumber, {
            refName: fetchRegion.refName,
            start: fetchRegion.start,
            end: fetchRegion.end,
            assemblyName: fetchRegion.assemblyName,
          })
          self.setLoading(false)
        } catch (e) {
          if (fetchGenerations.get(regionNumber) !== gen) {
            return
          }
          console.error('Failed to fetch features:', e)
          self.setError(e instanceof Error ? e : new Error(String(e)))
          self.setLoading(false)
        }
      }

      function fetchAllVisibleRegions() {
        const view = getContainingView(self) as LGV
        const regions = view.staticRegions
        for (const region of regions) {
          const loaded = self.loadedRegions.get(region.regionNumber)
          if (
            loaded?.refName === region.refName &&
            region.start >= loaded.start &&
            region.end <= loaded.end
          ) {
            continue
          }
          fetchFeaturesForRegion(region, region, region.regionNumber).catch(
            (e: unknown) => {
              console.error('Failed to fetch features:', e)
            },
          )
        }
      }

      let prevColorType: string | undefined
      let prevColorTag: string | undefined
      let prevTagsReady: boolean | undefined
      let prevInvalidationKey: string | undefined

      return {
        fetchFeatures(region: Region, regionNumber = 0) {
          fetchFeaturesForRegion(region, region, regionNumber).catch(
            (e: unknown) => {
              console.error('Failed to fetch features:', e)
            },
          )
        },

        afterAttach() {
          // Autorun: drives all data fetching. Tracks visibleRegions and
          // fetchToken (fires when anything invalidates data: reload,
          // filter change, colorBy change, etc.)
          addDisposer(
            self,
            autorun(
              () => {
                const view = getContainingView(self) as LGV
                if (!view.initialized) {
                  return
                }
                const regions = view.staticRegions
                if (regions.length === 0) {
                  return
                }
                // Track fetchToken so bumps trigger re-fetch
                // eslint-disable-next-line @typescript-eslint/no-unused-expressions
                self.fetchToken
                fetchAllVisibleRegions()
              },
              {
                name: 'LinearAlignmentsDisplay:fetchVisibleRegions',
                delay: 300,
              },
            ),
          )

          // Autorun: invalidate data when filter, displayedRegions, or
          // rendering mode/arcs settings change
          addDisposer(
            self,
            autorun(
              () => {
                const view = getContainingView(self) as LGV
                const key = JSON.stringify({
                  filterBy: self.filterBy,
                  displayedRegions: view.displayedRegions.map(r => ({
                    refName: r.refName,
                    start: r.start,
                    end: r.end,
                  })),
                  mode: self.renderingMode,
                  drawInter: self.arcsState.drawInter,
                  drawLongRange: self.arcsState.drawLongRange,
                  drawSingletons: self.drawSingletons,
                  drawProperPairs: self.drawProperPairs,
                })
                if (
                  prevInvalidationKey !== undefined &&
                  key !== prevInvalidationKey
                ) {
                  self.clearAllRpcData()
                  self.arcsState.clearAllRpcData()
                  self.cloudState.clearAllRpcData()
                  self.bumpFetchToken()
                }
                prevInvalidationKey = key
              },
              { name: 'LinearAlignmentsDisplay:invalidateData' },
            ),
          )

          // Autorun: re-fetch when colorBy changes (modifications/methylation/tag
          // modes require different worker-side processing).
          // For tag mode, also re-fetch when tagsReady becomes true (colorTagMap populated).
          addDisposer(
            self,
            autorun(
              () => {
                const colorType = self.colorBy.type
                const tag = self.colorBy.tag
                const tagsReady = self.tagsReady
                if (
                  prevColorType !== undefined &&
                  (colorType !== prevColorType ||
                    tag !== prevColorTag ||
                    tagsReady !== prevTagsReady)
                ) {
                  if (!(colorType === 'tag' && !tagsReady)) {
                    self.setLoading(true)
                    self.setStatusMessage('Loading')
                    self.setError(null)
                    self.clearAllRpcData()
                    self.bumpFetchToken()
                  }
                }
                prevColorType = colorType
                prevColorTag = tag
                prevTagsReady = tagsReady
              },
              { name: 'LinearAlignmentsDisplay:refetchOnColorByChange' },
            ),
          )

          // Autorun: fetch unique tag values when colorBy.type is 'tag' and tags not yet ready
          addDisposer(
            self,
            autorun(
              async () => {
                const tag = self.colorBy.tag
                const tagsReady = self.tagsReady
                const region = self.visibleRegion
                if (!tag || tagsReady || !region) {
                  return
                }
                const session = getSession(self)
                const track = getContainingTrack(self)
                const adapterConfig = getConf(track, 'adapter')
                const sessionId = getRpcSessionId(self)
                try {
                  const vals = (await session.rpcManager.call(
                    sessionId,
                    'PileupGetGlobalValueForTag',
                    {
                      adapterConfig,
                      tag,
                      sessionId,
                      regions: [region],
                    },
                  )) as string[]
                  if (isAlive(self)) {
                    self.updateColorTagMap(vals)
                    self.setTagsReady(true)
                  }
                } catch (e) {
                  console.error('Failed to fetch tag values:', e)
                  if (isAlive(self)) {
                    self.setTagsReady(true)
                  }
                }
              },
              {
                name: 'LinearAlignmentsDisplay:fetchTagValues',
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
        const modeMenu = {
          label: 'Display mode',
          subMenu: [
            {
              label: 'Pileup',
              type: 'radio' as const,
              checked: self.renderingMode === 'pileup',
              onClick: () => {
                self.setRenderingMode('pileup')
              },
            },
            {
              label: 'Arc',
              type: 'radio' as const,
              checked: self.renderingMode === 'arcs',
              onClick: () => {
                self.setRenderingMode('arcs')
              },
            },
            {
              label: 'Read cloud',
              type: 'radio' as const,
              checked: self.renderingMode === 'cloud',
              onClick: () => {
                self.setRenderingMode('cloud')
              },
            },
            {
              label: 'Linked read',
              type: 'radio' as const,
              checked: self.renderingMode === 'linkedRead',
              onClick: () => {
                self.setRenderingMode('linkedRead')
              },
            },
          ],
        }

        const colorByMenu = {
          label: 'Color by...',
          subMenu: [
            {
              label: 'Normal',
              type: 'radio' as const,
              checked: self.colorBy.type === 'normal',
              onClick: () => {
                self.setColorScheme({ type: 'normal' })
              },
            },
            {
              label: 'Strand',
              type: 'radio' as const,
              checked: self.colorBy.type === 'strand',
              onClick: () => {
                self.setColorScheme({ type: 'strand' })
              },
            },
            {
              label: 'Mapping quality',
              type: 'radio' as const,
              checked: self.colorBy.type === 'mappingQuality',
              onClick: () => {
                self.setColorScheme({ type: 'mappingQuality' })
              },
            },
            {
              label: 'Insert size',
              type: 'radio' as const,
              checked: self.colorBy.type === 'insertSize',
              onClick: () => {
                self.setColorScheme({ type: 'insertSize' })
              },
            },
            {
              label: 'First of pair strand',
              type: 'radio' as const,
              checked: self.colorBy.type === 'firstOfPairStrand',
              onClick: () => {
                self.setColorScheme({ type: 'firstOfPairStrand' })
              },
            },
            {
              label: 'Pair orientation',
              type: 'radio' as const,
              checked: self.colorBy.type === 'pairOrientation',
              onClick: () => {
                self.setColorScheme({ type: 'pairOrientation' })
              },
            },
            {
              label: 'Insert size and orientation',
              type: 'radio' as const,
              checked: self.colorBy.type === 'insertSizeAndOrientation',
              onClick: () => {
                self.setColorScheme({ type: 'insertSizeAndOrientation' })
              },
            },
            {
              label: 'Modifications',
              type: 'subMenu',
              subMenu: getModificationsSubMenu(self, {
                includeMethylation: true,
              }),
            },
            {
              label: 'Color by tag...',
              type: 'radio' as const,
              checked: self.colorBy.type === 'tag',
              onClick: () => {
                getSession(self).queueDialog((onClose: () => void) => [
                  ColorByTagDialog,
                  { model: self, handleClose: onClose },
                ])
              },
            },
          ],
        }

        const coverageItem = {
          label: self.showCoverage ? 'Hide coverage' : 'Show coverage',
          onClick: () => {
            self.setShowCoverage(!self.showCoverage)
          },
        }

        const sashimiItem = {
          label: self.showSashimiArcs
            ? 'Hide sashimi arcs'
            : 'Show sashimi arcs',
          onClick: () => {
            self.setShowSashimiArcs(!self.showSashimiArcs)
          },
        }

        const featureHeightMenu = {
          label: 'Set feature height...',
          type: 'subMenu' as const,
          subMenu: [
            {
              label: 'Normal',
              type: 'radio' as const,
              checked:
                self.featureHeight === 7 && self.noSpacingSetting === false,
              onClick: () => {
                self.setFeatureHeight(7)
                self.setNoSpacing(false)
              },
            },
            {
              label: 'Compact',
              type: 'radio' as const,
              checked:
                self.featureHeight === 3 && self.noSpacingSetting === true,
              onClick: () => {
                self.setFeatureHeight(3)
                self.setNoSpacing(true)
              },
            },
            {
              label: 'Super-compact',
              type: 'radio' as const,
              checked:
                self.featureHeight === 1 && self.noSpacingSetting === true,
              onClick: () => {
                self.setFeatureHeight(1)
                self.setNoSpacing(true)
              },
            },
            {
              label: 'Custom',
              onClick: () => {
                getSession(self).queueDialog(handleClose => [
                  SetFeatureHeightDialog,
                  {
                    model: self,
                    handleClose,
                  },
                ])
              },
            },
          ],
        }

        // Pileup-specific menu items
        const pileupItems = [
          colorByMenu,
          featureHeightMenu,
          coverageItem,
          sashimiItem,
          {
            label: self.showMismatches ? 'Hide mismatches' : 'Show mismatches',
            onClick: () => {
              self.setShowMismatches(!self.showMismatches)
            },
          },
          {
            label: self.showInterbaseCounts
              ? 'Hide interbase counts'
              : 'Show interbase counts',
            onClick: () => {
              self.setShowInterbaseCounts(!self.showInterbaseCounts)
            },
          },
          {
            label: self.showInterbaseIndicators
              ? 'Hide interbase indicators'
              : 'Show interbase indicators',
            onClick: () => {
              self.setShowInterbaseIndicators(!self.showInterbaseIndicators)
            },
          },
        ]

        // Arcs-specific menu items
        const arcsItems = [
          {
            label: 'Color by...',
            subMenu: [
              {
                label: 'Insert size and orientation',
                type: 'radio' as const,
                checked: self.colorBy.type === 'insertSizeAndOrientation',
                onClick: () => {
                  self.setColorScheme({ type: 'insertSizeAndOrientation' })
                },
              },
              {
                label: 'Orientation only',
                type: 'radio' as const,
                checked: self.colorBy.type === 'orientation',
                onClick: () => {
                  self.setColorScheme({ type: 'orientation' })
                },
              },
              {
                label: 'Insert size only',
                type: 'radio' as const,
                checked: self.colorBy.type === 'insertSize',
                onClick: () => {
                  self.setColorScheme({ type: 'insertSize' })
                },
              },
              {
                label: 'Gradient',
                type: 'radio' as const,
                checked: self.colorBy.type === 'gradient',
                onClick: () => {
                  self.setColorScheme({ type: 'gradient' })
                },
              },
            ],
          },
          {
            label: 'Line width',
            subMenu: [
              {
                label: 'Thin',
                onClick: () => {
                  self.arcsState.setLineWidth(1)
                },
              },
              {
                label: 'Bold',
                onClick: () => {
                  self.arcsState.setLineWidth(2)
                },
              },
              {
                label: 'Extra bold',
                onClick: () => {
                  self.arcsState.setLineWidth(5)
                },
              },
            ],
          },
          {
            label: 'Show...',
            subMenu: [
              {
                label: 'Inter-chromosomal connections',
                type: 'checkbox',
                checked: self.arcsState.drawInter,
                onClick: () => {
                  self.arcsState.setDrawInter(!self.arcsState.drawInter)
                },
              },
              {
                label: 'Long range connections',
                type: 'checkbox',
                checked: self.arcsState.drawLongRange,
                onClick: () => {
                  self.arcsState.setDrawLongRange(!self.arcsState.drawLongRange)
                },
              },
            ],
          },
        ]

        // Cloud and linked read modes share the same menu items
        const chainItems = [
          {
            label: 'Color by...',
            subMenu: [
              {
                label: 'Insert size and orientation',
                type: 'radio' as const,
                checked: self.colorBy.type === 'insertSizeAndOrientation',
                onClick: () => {
                  self.setColorScheme({ type: 'insertSizeAndOrientation' })
                },
              },
              {
                label: 'Strand',
                type: 'radio' as const,
                checked: self.colorBy.type === 'strand',
                onClick: () => {
                  self.setColorScheme({ type: 'strand' })
                },
              },
              {
                label: 'Normal',
                type: 'radio' as const,
                checked: self.colorBy.type === 'normal',
                onClick: () => {
                  self.setColorScheme({ type: 'normal' })
                },
              },
              {
                label: 'Mapping quality',
                type: 'radio' as const,
                checked: self.colorBy.type === 'mappingQuality',
                onClick: () => {
                  self.setColorScheme({ type: 'mappingQuality' })
                },
              },
            ],
          },
          featureHeightMenu,
          coverageItem,
          sashimiItem,
          {
            label: 'Show...',
            subMenu: [
              {
                label: 'Legend',
                type: 'checkbox',
                checked: !!self.showLegend,
                onClick: () => {
                  self.setShowLegend(!self.showLegend)
                },
              },
              {
                label: 'Y-axis scalebar',
                type: 'checkbox',
                checked: self.showYScalebar,
                onClick: () => {
                  self.setShowYScalebar(!self.showYScalebar)
                },
              },
              {
                label: 'Mismatches',
                type: 'checkbox',
                checked: self.showMismatches,
                onClick: () => {
                  self.setShowMismatches(!self.showMismatches)
                },
              },
            ],
          },
          {
            label: 'Edit filters',
            subMenu: [
              {
                label: 'Show singletons',
                type: 'checkbox',
                checked: self.drawSingletons,
                onClick: () => {
                  self.setDrawSingletons(!self.drawSingletons)
                },
              },
              {
                label: 'Show proper pairs',
                type: 'checkbox',
                checked: self.drawProperPairs,
                onClick: () => {
                  self.setDrawProperPairs(!self.drawProperPairs)
                },
              },
            ],
          },
        ]

        const modeItems =
          self.renderingMode === 'arcs'
            ? arcsItems
            : self.renderingMode === 'cloud' ||
                self.renderingMode === 'linkedRead'
              ? chainItems
              : pileupItems

        return [modeMenu, ...modeItems]
      },

      contextMenuItems() {
        return [] as { label: string; onClick: () => void; icon?: any }[]
      },
    }))
    .actions(self => {
      const superReload = self.reload
      return {
        async reload() {
          self.setRegionTooLarge(false)
          self.clearAllRpcData()
          self.arcsState.clearAllRpcData()
          self.cloudState.clearAllRpcData()
          self.bumpFetchToken()
          superReload()
        },
        async renderSvg(opts?: ExportSvgDisplayOptions) {
          const { renderSvg } = await import('./renderSvg.tsx')
          return renderSvg(self as LinearAlignmentsDisplayModel, opts)
        },
      }
    })
}

export type LinearAlignmentsDisplayStateModel = ReturnType<
  typeof stateModelFactory
>
export type LinearAlignmentsDisplayModel =
  Instance<LinearAlignmentsDisplayStateModel>
