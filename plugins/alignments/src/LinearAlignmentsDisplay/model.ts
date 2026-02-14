import { createElement, lazy } from 'react'

import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import {
  SimpleFeature,
  getContainingTrack,
  getContainingView,
  getRpcSessionId,
  getSession,
  isAbortException,
  isSessionModelWithWidgets,
} from '@jbrowse/core/util'
import { createStopToken, stopStopToken } from '@jbrowse/core/util/stopToken'
import {
  addDisposer,
  getSnapshot,
  isAlive,
  types,
} from '@jbrowse/mobx-state-tree'
import {
  MultiRegionWebGLDisplayMixin,
  TooLargeMessage,
  TrackHeightMixin,
} from '@jbrowse/plugin-linear-genome-view'
import ClearAllIcon from '@mui/icons-material/ClearAll'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import MenuOpenIcon from '@mui/icons-material/MenuOpen'
import SwapVertIcon from '@mui/icons-material/SwapVert'
import VisibilityIcon from '@mui/icons-material/Visibility'
import WorkspacesIcon from '@mui/icons-material/Workspaces'
import { scaleLinear, scaleLog } from '@mui/x-charts-vendor/d3-scale'
import { autorun, observable } from 'mobx'

import { ArcsSubModel } from './ArcsSubModel.ts'
import { CloudSubModel } from './CloudSubModel.ts'
import { computeVisibleLabels } from './components/computeVisibleLabels.ts'
import { getReadDisplayLegendItems } from '../shared/legendUtils.ts'
import { getModificationsSubMenu } from '../shared/menuItems.ts'
import { getColorForModification } from '../util.ts'
import {
  CIGAR_TYPE_LABELS,
  uploadRegionDataToGPU,
} from './components/alignmentComponentUtils.ts'
import { openCigarWidget } from './components/openFeatureWidget.ts'

import type { CloudTicks } from './components/CloudYScaleBar.tsx'
import type { CoverageTicks } from './components/CoverageYScaleBar.tsx'
import type { ColorPalette, WebGLRenderer } from './components/WebGLRenderer.ts'
import type { VisibleLabel } from './components/computeVisibleLabels.ts'
import type { CigarHitResult } from './components/hitTesting.ts'
import type { WebGLArcsDataResult } from '../RenderWebGLArcsDataRPC/types.ts'
import type { WebGLPileupDataResult } from '../RenderWebGLPileupDataRPC/types'
import type { LegendItem } from '../shared/legendUtils.ts'
import type { ColorBy, FilterBy, SortedBy } from '../shared/types'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { MenuItem } from '@jbrowse/core/ui'
import type { Feature } from '@jbrowse/core/util'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type {
  ExportSvgDisplayOptions,
  LinearGenomeViewModel,
  MultiRegionWebGLRegion as Region,
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

export type { MultiRegionWebGLRegion as Region } from '@jbrowse/plugin-linear-genome-view'

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
const SortByTagDialog = lazy(() => import('./components/SortByTagDialog.tsx'))
const GroupByDialog = lazy(() => import('./components/GroupByDialog.tsx'))
const FilterByTagDialog = lazy(
  () => import('../shared/components/FilterByTagDialog.tsx'),
)
const SetMaxHeightDialog = lazy(
  () => import('../shared/components/SetMaxHeightDialog.tsx'),
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
      MultiRegionWebGLDisplayMixin(),
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
         */
        showSoftClipping: false,
        /**
         * #property
         */
        mismatchAlpha: types.maybe(types.boolean),
        /**
         * #property
         */
        sortedBySetting: types.frozen<SortedBy | undefined>(),
        /**
         * #property
         */
        trackMaxHeight: types.maybe(types.number),
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
      contextMenuCoord: undefined as [number, number] | undefined,
      contextMenuCigarHit: undefined as CigarHitResult | undefined,
      userByteSizeLimit: undefined as number | undefined,
      regionTooLargeState: false,
      regionTooLargeReasonState: '',
      featureDensityStats: undefined as
        | undefined
        | { bytes?: number; fetchSizeLimit?: number },
      fetchToken: 0,
      rpcDataMap: new Map<number, WebGLPileupDataResult>(),
      statusMessage: 'Loading',
      webglRef: null as unknown,
      currentRangeY: [0, 600] as [number, number],
      maxY: 0,
      highlightedFeatureIndex: -1,
      selectedFeatureIndex: -1,
      highlightedChainIndices: [] as number[],
      selectedChainIndices: [] as number[],
      colorTagMap: {} as Record<string, string>,
      tagsReady: true,
      visibleModifications: observable.map<string, any>({}),
      simplexModifications: new Set<string>(),
      modificationsReady: false,
      overCigarItem: false,
      webglRenderer: null as WebGLRenderer | null,
      colorPalette: null as ColorPalette | null,
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
        return self.trackMaxHeight ?? getConf(self, 'maxHeight') ?? 1200
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
          const blockOffsetPx = first.offsetPx
          const deltaPx = view.offsetPx - blockOffsetPx
          const deltaBp = deltaPx * bpPerPx

          const last = blocks[blocks.length - 1]
          if (first.refName === last?.refName) {
            const rangeStart = first.start + deltaBp
            const rangeEnd = rangeStart + width * bpPerPx
            return [rangeStart, rangeEnd]
          }

          const rangeStart = first.start + deltaBp
          const blockEndPx = blockOffsetPx + first.widthPx
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
        return self.sortedBySetting
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
      get visibleLabels(): VisibleLabel[] {
        const view = getContainingView(self) as LGV
        if (!view.initialized) {
          return []
        }
        return computeVisibleLabels({
          rpcData: self.rpcData,
          labelBpRange: self.visibleBpRange,
          width: view.width,
          height: self.height,
          featureHeightSetting: self.featureHeightSetting,
          featureSpacing: self.featureSpacing,
          showMismatches: self.showMismatches,
          showCoverage: self.showCoverage,
          coverageHeight: self.coverageHeight,
          rangeY: self.currentRangeY,
        })
      },

      get isChainMode() {
        return (
          self.renderingMode === 'cloud' || self.renderingMode === 'linkedRead'
        )
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

        let maxY = 0
        for (const d of next.values()) {
          if (d.maxY > maxY) {
            maxY = d.maxY
          }
        }
        self.maxY = maxY
      },

      clearDisplaySpecificData() {
        self.rpcDataMap = new Map()
        self.arcsState.clearAllRpcData()
        self.cloudState.clearAllRpcData()
      },

      bumpFetchToken() {
        self.fetchToken++
      },

      setLoadedRegion(regionNumber: number, region: Region | null) {
        if (region) {
          self.setLoadedRegionForRegion(regionNumber, region)
        } else {
          const next = new Map(self.loadedRegions)
          next.delete(regionNumber)
          self.loadedRegions = next
        }
      },

      setStatusMessage(msg?: string) {
        self.statusMessage = msg ?? ''
      },

      setWebGLRef(ref: unknown) {
        self.webglRef = ref
      },

      setOverCigarItem(flag: boolean) {
        self.overCigarItem = flag
      },

      setWebGLRenderer(renderer: WebGLRenderer | null) {
        self.webglRenderer = renderer
      },

      setColorPalette(palette: ColorPalette | null) {
        self.colorPalette = palette
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

      clearMouseoverState() {
        self.featureIdUnderMouse = undefined
        self.mouseoverExtraInformation = undefined
        self.overCigarItem = false
        if (self.highlightedFeatureIndex !== -1) {
          self.highlightedFeatureIndex = -1
        }
        if (self.highlightedChainIndices.length > 0) {
          self.highlightedChainIndices = []
        }
      },

      clearSelection() {
        if (self.selectedFeatureIndex !== -1) {
          self.selectedFeatureIndex = -1
        }
        if (self.selectedChainIndices.length > 0) {
          self.selectedChainIndices = []
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

      toggleSoftClipping() {
        self.showSoftClipping = !self.showSoftClipping
      },

      toggleMismatchAlpha() {
        self.mismatchAlpha = !self.mismatchAlpha
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
        self.sortedBySetting = {
          type,
          pos: centerBp,
          refName,
          assemblyName,
          tag,
        }
      },

      setSortedByAtPosition(type: string, pos: number, refName: string) {
        const view = getContainingView(self) as LGV
        const assemblyName = view.assemblyNames[0]
        if (!assemblyName) {
          return
        }
        self.sortedBySetting = {
          type,
          pos,
          refName,
          assemblyName,
        }
      },

      clearSelected() {
        self.sortedBySetting = undefined
      },

      setMaxHeight(n?: number) {
        self.trackMaxHeight = n
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

      setContextMenuCoord(coord?: [number, number]) {
        self.contextMenuCoord = coord
      },

      setContextMenuCigarHit(hit?: CigarHitResult) {
        self.contextMenuCigarHit = hit
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
    .actions(self => ({
      async setContextMenuFeatureById(featureId: string) {
        const session = getSession(self)
        const { rpcManager } = session
        try {
          const track = getContainingTrack(self)
          const adapterConfig = getConf(track, 'adapter')
          const info = self.getFeatureInfoById(featureId)
          if (!info) {
            return
          }
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

          if (isAlive(self) && feature) {
            const feat = new SimpleFeature(
              feature as ConstructorParameters<typeof SimpleFeature>[0],
            )
            self.setContextMenuFeature(feat)
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
        stopToken: string,
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
            sortedBy: self.sortedBy,
            stopToken,
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
        stopToken: string,
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
            stopToken,
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
        stopToken: string,
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
            stopToken,
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
        region: Region,
        regionNumber: number,
        stopToken: string,
      ) {
        const session = getSession(self)
        const track = getContainingTrack(self)
        const adapterConfig = getConf(track, 'adapter')

        if (!adapterConfig) {
          return
        }

        const gen = (fetchGenerations.get(regionNumber) ?? 0) + 1
        fetchGenerations.set(regionNumber, gen)

        const stats = await fetchByteEstimate(adapterConfig, region)
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
          return
        }
        self.setRegionTooLarge(false)

        const sequenceAdapter = getSequenceAdapter(session, region)

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
            region,
            regionNumber,
            stopToken,
          )
        } else {
          await fetchPileupData(
            session,
            adapterConfig,
            sequenceAdapter,
            region,
            regionNumber,
            stopToken,
          )
          if (self.renderingMode === 'arcs') {
            await fetchArcsData(
              session,
              adapterConfig,
              sequenceAdapter,
              region,
              regionNumber,
              stopToken,
            )
          }
        }

        // Discard stale responses from older requests for this regionNumber
        if (fetchGenerations.get(regionNumber) !== gen) {
          return
        }

        self.setLoadedRegion(regionNumber, {
          refName: region.refName,
          start: region.start,
          end: region.end,
          assemblyName: region.assemblyName,
        })
      }

      async function fetchRegions(
        regions: { region: Region; regionNumber: number }[],
      ) {
        if (self.renderingStopToken) {
          stopStopToken(self.renderingStopToken)
        }
        const stopToken = createStopToken()
        self.setRenderingStopToken(stopToken)
        const generation = self.fetchGeneration
        self.setLoading(true)
        self.setError(null)
        try {
          const promises = regions.map(({ region, regionNumber }) =>
            fetchFeaturesForRegion(region, regionNumber, stopToken),
          )
          await Promise.all(promises)
        } catch (e) {
          if (!isAbortException(e)) {
            console.error('Failed to fetch features:', e)
            if (isAlive(self) && self.fetchGeneration === generation) {
              self.setError(e instanceof Error ? e : new Error(String(e)))
            }
          }
        } finally {
          if (isAlive(self) && self.fetchGeneration === generation) {
            self.setRenderingStopToken(undefined)
            self.setLoading(false)
          }
        }
      }

      let prevColorType: string | undefined
      let prevColorTag: string | undefined
      let prevTagsReady: boolean | undefined
      let prevInvalidationKey: string | undefined
      const superAfterAttach = self.afterAttach

      return {
        async fetchFeatures(region: Region, regionNumber = 0) {
          await fetchRegions([{ region, regionNumber }])
        },

        afterAttach() {
          superAfterAttach()
          // Autorun: draw whenever rendering-relevant observables change
          addDisposer(
            self,
            autorun(
              () => {
                const renderer = self.webglRenderer
                const palette = self.colorPalette
                if (!renderer || !palette) {
                  return
                }
                const view = getContainingView(self) as LGV
                if (!view.initialized) {
                  return
                }
                const regions = view.visibleRegions
                const blocks = regions.map(r => ({
                  regionNumber: r.regionNumber,
                  bpRangeX: [r.start, r.end] as [number, number],
                  screenStartPx: r.screenStartPx,
                  screenEndPx: r.screenEndPx,
                }))
                renderer.renderBlocks(blocks, {
                  rangeY: self.currentRangeY,
                  colorScheme: self.colorSchemeIndex,
                  featureHeight: self.featureHeightSetting,
                  featureSpacing: self.featureSpacing,
                  showCoverage: self.showCoverage,
                  coverageHeight: self.coverageHeight,
                  coverageYOffset: YSCALEBAR_LABEL_OFFSET,
                  showMismatches: self.showMismatches,
                  showInterbaseCounts: self.showInterbaseCounts,
                  showInterbaseIndicators: self.showInterbaseIndicators,
                  showModifications: self.showModifications,
                  showSashimiArcs: self.showSashimiArcs,
                  canvasWidth: view.width,
                  canvasHeight: self.height,
                  highlightedFeatureIndex: self.highlightedFeatureIndex,
                  selectedFeatureIndex: self.selectedFeatureIndex,
                  highlightedChainIndices: self.highlightedChainIndices,
                  selectedChainIndices: self.selectedChainIndices,
                  colors: palette,
                  renderingMode: self.renderingMode as
                    | 'pileup'
                    | 'arcs'
                    | 'cloud'
                    | 'linkedRead',
                  arcLineWidth: self.arcsState.lineWidth,
                  cloudColorScheme: self.colorSchemeIndex,
                  bpRangeX: [0, 0],
                })
              },
              { name: 'LinearAlignmentsDisplay:draw' },
            ),
          )

          // Autorun: upload pileup data to GPU when rpcDataMap changes
          addDisposer(
            self,
            autorun(
              () => {
                const renderer = self.webglRenderer
                if (!renderer) {
                  return
                }
                const maxYVal = uploadRegionDataToGPU(
                  renderer,
                  self.rpcDataMap,
                  self.showCoverage,
                )
                if (maxYVal > 0) {
                  self.setMaxY(maxYVal)
                }
              },
              { name: 'LinearAlignmentsDisplay:uploadPileupData' },
            ),
          )

          // Autorun: upload arcs data to GPU
          addDisposer(
            self,
            autorun(
              () => {
                const renderer = self.webglRenderer
                if (!renderer) {
                  return
                }
                const arcsRpcDataMap = self.arcsState.rpcDataMap
                for (const [regionNumber, data] of arcsRpcDataMap) {
                  renderer.uploadArcsFromTypedArraysForRegion(regionNumber, {
                    regionStart: data.regionStart,
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
              { name: 'LinearAlignmentsDisplay:uploadArcsData' },
            ),
          )

          // Autorun: upload connecting line data for chain modes
          addDisposer(
            self,
            autorun(
              () => {
                const renderer = self.webglRenderer
                if (!renderer) {
                  return
                }
                for (const [regionNumber, data] of self.rpcDataMap) {
                  if (
                    data.connectingLinePositions &&
                    data.connectingLineYs &&
                    data.connectingLineColorTypes &&
                    data.numConnectingLines
                  ) {
                    renderer.uploadConnectingLinesForRegion(regionNumber, {
                      regionStart: data.regionStart,
                      connectingLinePositions: data.connectingLinePositions,
                      connectingLineYs: data.connectingLineYs,
                      connectingLineColorTypes: data.connectingLineColorTypes,
                      numConnectingLines: data.numConnectingLines,
                    })
                  }
                }
              },
              { name: 'LinearAlignmentsDisplay:uploadChainData' },
            ),
          )

          // Autorun: fetch data for all visible regions
          addDisposer(
            self,
            autorun(
              async () => {
                const view = getContainingView(self) as LGV
                if (!view.initialized) {
                  return
                }
                // Track fetchToken so bumps trigger re-fetch
                // eslint-disable-next-line @typescript-eslint/no-unused-expressions
                self.fetchToken
                const needed: { region: Region; regionNumber: number }[] = []
                for (const vr of view.staticRegions) {
                  const loaded = self.loadedRegions.get(vr.regionNumber)
                  if (
                    loaded?.refName === vr.refName &&
                    vr.start >= loaded.start &&
                    vr.end <= loaded.end
                  ) {
                    continue
                  }
                  needed.push({
                    region: vr as Region,
                    regionNumber: vr.regionNumber,
                  })
                }
                if (needed.length > 0) {
                  await fetchRegions(needed)
                }
              },
              {
                name: 'LinearAlignmentsDisplay:fetchVisibleRegions',
                delay: 300,
              },
            ),
          )

          // Autorun: invalidate data when filter or rendering mode/arcs
          // settings change (displayedRegions handled by mixin)
          addDisposer(
            self,
            autorun(
              () => {
                const key = JSON.stringify({
                  filterBy: self.filterBy,
                  sortedBy: self.sortedBy,
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
              label: 'Per-base quality',
              type: 'radio' as const,
              checked: self.colorBy.type === 'perBaseQuality',
              onClick: () => {
                self.setColorScheme({ type: 'perBaseQuality' })
              },
            },
            {
              label: 'Per-base lettering',
              type: 'radio' as const,
              checked: self.colorBy.type === 'perBaseLettering',
              onClick: () => {
                self.setColorScheme({ type: 'perBaseLettering' })
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

        const showSubMenu = {
          label: 'Show...',
          icon: VisibilityIcon,
          subMenu: [
            {
              label: 'Show soft clipping',
              type: 'checkbox' as const,
              checked: self.showSoftClipping,
              onClick: () => {
                self.toggleSoftClipping()
              },
            },
            {
              label: 'Show mismatches faded by quality',
              type: 'checkbox' as const,
              checked: !!self.mismatchAlpha,
              onClick: () => {
                self.toggleMismatchAlpha()
              },
            },
            {
              label: self.showCoverage ? 'Hide coverage' : 'Show coverage',
              type: 'checkbox' as const,
              checked: self.showCoverage,
              onClick: () => {
                self.setShowCoverage(!self.showCoverage)
              },
            },
            {
              label: self.showSashimiArcs
                ? 'Hide sashimi arcs'
                : 'Show sashimi arcs',
              type: 'checkbox' as const,
              checked: self.showSashimiArcs,
              onClick: () => {
                self.setShowSashimiArcs(!self.showSashimiArcs)
              },
            },
            {
              label: self.showMismatches
                ? 'Hide mismatches'
                : 'Show mismatches',
              type: 'checkbox' as const,
              checked: self.showMismatches,
              onClick: () => {
                self.setShowMismatches(!self.showMismatches)
              },
            },
            {
              label: self.showInterbaseCounts
                ? 'Hide interbase counts'
                : 'Show interbase counts',
              type: 'checkbox' as const,
              checked: self.showInterbaseCounts,
              onClick: () => {
                self.setShowInterbaseCounts(!self.showInterbaseCounts)
              },
            },
            {
              label: self.showInterbaseIndicators
                ? 'Hide interbase indicators'
                : 'Show interbase indicators',
              type: 'checkbox' as const,
              checked: self.showInterbaseIndicators,
              onClick: () => {
                self.setShowInterbaseIndicators(!self.showInterbaseIndicators)
              },
            },
          ],
        }

        const setMaxHeightItem = {
          label: 'Set max track height...',
          onClick: () => {
            getSession(self).queueDialog(handleClose => [
              SetMaxHeightDialog,
              {
                model: self,
                handleClose,
              },
            ])
          },
        }

        const filterByItem = {
          label: 'Filter by...',
          icon: ClearAllIcon,
          onClick: () => {
            getSession(self).queueDialog(handleClose => [
              FilterByTagDialog,
              {
                model: self,
                handleClose,
              },
            ])
          },
        }

        const sortByMenu = {
          label: 'Sort by...',
          icon: SwapVertIcon,
          subMenu: [
            {
              label: 'Start location',
              onClick: () => {
                self.setSortedBy('position')
              },
            },
            {
              label: 'Read strand',
              onClick: () => {
                self.setSortedBy('strand')
              },
            },
            {
              label: 'Base pair',
              onClick: () => {
                self.setSortedBy('basePair')
              },
            },
            {
              label: 'Sort by tag...',
              onClick: () => {
                getSession(self).queueDialog(handleClose => [
                  SortByTagDialog,
                  {
                    model: self,
                    handleClose,
                  },
                ])
              },
            },
            {
              label: 'Clear sort',
              onClick: () => {
                self.clearSelected()
              },
            },
          ],
        }

        const groupByItem = {
          label: 'Group by...',
          icon: WorkspacesIcon,
          onClick: () => {
            getSession(self).queueDialog(handleClose => [
              GroupByDialog,
              {
                model: self,
                handleClose,
              },
            ])
          },
        }

        // Pileup-specific menu items
        const pileupItems = [
          featureHeightMenu,
          showSubMenu,
          setMaxHeightItem,
          filterByItem,
          sortByMenu,
          colorByMenu,
          groupByItem,
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
          {
            label: self.showCoverage ? 'Hide coverage' : 'Show coverage',
            onClick: () => {
              self.setShowCoverage(!self.showCoverage)
            },
          },
          {
            label: self.showSashimiArcs
              ? 'Hide sashimi arcs'
              : 'Show sashimi arcs',
            onClick: () => {
              self.setShowSashimiArcs(!self.showSashimiArcs)
            },
          },
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
        const feat = self.contextMenuFeature
        const cigarHit = self.contextMenuCigarHit
        const items: MenuItem[] = []

        if (cigarHit) {
          const typeLabel = CIGAR_TYPE_LABELS[cigarHit.type] ?? cigarHit.type
          items.push({
            label: 'Mismatch',
            type: 'subMenu',
            subMenu: [
              {
                label: `Sort by base at position`,
                icon: SwapVertIcon,
                onClick: () => {
                  const region = self.loadedRegion
                  if (region) {
                    self.setSortedByAtPosition(
                      'basePair',
                      cigarHit.position,
                      region.refName,
                    )
                  }
                },
              },
              {
                label: `Open ${typeLabel.toLowerCase()} details`,
                icon: MenuOpenIcon,
                onClick: () => {
                  const region = self.loadedRegion
                  if (region) {
                    openCigarWidget(self, cigarHit, region.refName)
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
          self.setRegionTooLarge(false)
          self.clearAllRpcData()
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
