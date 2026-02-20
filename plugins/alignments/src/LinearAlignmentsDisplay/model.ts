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
  AUTO_FORCE_LOAD_BP,
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
import { scaleLinear } from '@mui/x-charts-vendor/d3-scale'
import { autorun, observable } from 'mobx'

import { ArcsSubModel } from './ArcsSubModel.ts'
import { computeVisibleLabels } from './components/computeVisibleLabels.ts'
import { getReadDisplayLegendItems } from '../shared/legendUtils.ts'
import { getModificationsSubMenu } from '../shared/menuItems.ts'
import { getColorForModification } from '../util.ts'
import {
  CIGAR_TYPE_LABELS,
  uploadRegionDataToGPU,
} from './components/alignmentComponentUtils.ts'
import { openCigarWidget } from './components/openFeatureWidget.ts'
import {
  LONG_INSERTION_MIN_LENGTH,
  LONG_INSERTION_TEXT_THRESHOLD_PX,
} from './constants.ts'

import type {
  AlignmentsRenderer,
  ColorPalette,
} from './components/AlignmentsRenderer.ts'

import type { CoverageTicks } from './components/CoverageYScaleBar.tsx'
import type { VisibleLabel } from './components/computeVisibleLabels.ts'
import type {
  CigarHitResult,
  IndicatorHitResult,
} from './components/hitTesting.ts'
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
    if (
      insertionWidthPx >= LONG_INSERTION_TEXT_THRESHOLD_PX &&
      pxPerBp >= 6.5
    ) {
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
    const insertionWidthPx = length * pxPerBp
    return Math.min(5, insertionWidthPx / 3)
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

async function fetchFeatureDetails(self: any, featureId: string) {
  const session = getSession(self)
  const track = getContainingTrack(self)
  const adapterConfig = getConf(track, 'adapter')
  const info = self.getFeatureInfoById(featureId)
  if (!info) {
    return undefined
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
  const { feature } = (await session.rpcManager.call(
    sessionId,
    'WebGLGetFeatureDetails',
    { sessionId, adapterConfig, sequenceAdapter, region, featureId },
  )) as {
    feature: (Record<string, unknown> & { uniqueId: string }) | undefined
  }
  if (!feature) {
    return undefined
  }
  return new SimpleFeature(
    feature as ConstructorParameters<typeof SimpleFeature>[0],
  )
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
        showLinkedReads: false,
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
         * Show interbase indicators (triangular markers and histogram bars for
         * insertion/softclip/hardclip events)
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
        showArcs: false,
        /**
         * #property
         */
        arcsHeight: 100,
        /**
         * #property
         */
        showSoftClipping: false,
        /**
         * #property
         */
        showOutline: types.maybe(types.boolean),
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

      // Migrate old renderingMode to new boolean toggles
      if (snap.renderingMode) {
        const { renderingMode, ...rest } = snap
        snap = {
          ...rest,
          showLinkedReads:
            renderingMode === 'linkedRead' || renderingMode === 'cloud',
        }
      }

      // Strip removed showReadCloud property from old snapshots
      if (snap.showReadCloud !== undefined) {
        const { showReadCloud, ...rest } = snap
        snap = {
          ...rest,
          showLinkedReads: snap.showLinkedReads || showReadCloud,
        }
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
          showInterbaseIndicators: showInterbaseIndicators ?? true,
          showCoverage: true,
          coverageHeight: 45,
          showMismatches: true,
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
      contextMenuIndicatorHit: undefined as IndicatorHitResult | undefined,
      contextMenuRefName: undefined as string | undefined,
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
      webglRenderer: null as AlignmentsRenderer | null,
      colorPalette: null as ColorPalette | null,
      visibleMaxDepth: 0,
    }))
    .views(self => ({
      get renderingMode(): 'pileup' | 'linkedRead' {
        if (self.showLinkedReads) {
          return 'linkedRead'
        }
        return 'pileup'
      },

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
       * Chain index map: readName → array of feature indices
       * Used in linkedRead mode for chain-level highlighting
       * Cached as a MST getter so it only recomputes when rpcDataMap changes
       */
      get chainIndexMap() {
        const map = new Map<string, number[]>()
        if (self.renderingMode === 'linkedRead') {
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
        const view = getContainingView(self) as LGV
        return (
          self.isLoading ||
          !view.initialized ||
          view.dynamicBlocks.contentBlocks.length === 0
        )
      },

      get regionTooLarge() {
        const view = getContainingView(self) as LGV
        return self.regionTooLargeState && view.visibleBp >= AUTO_FORCE_LOAD_BP
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
        const maxDepth = self.visibleMaxDepth
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

        const nicedMax = niceDomain[1] ?? maxDepth
        return {
          ticks,
          height,
          maxDepth,
          nicedMax,
          yTop: YSCALEBAR_LABEL_OFFSET,
          yBottom: height - YSCALEBAR_LABEL_OFFSET,
        }
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

      get isChainMode() {
        return self.renderingMode === 'linkedRead'
      },

      get showOutlineSetting() {
        return self.showOutline ?? this.isChainMode
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
        return (
          (self.showCoverage ? self.coverageHeight : 0) +
          (self.showArcs ? self.arcsHeight : 0)
        )
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
    .actions(self => {
      const superSetError = self.setError
      return {
        setError(error?: unknown) {
          superSetError(error)
          if (error) {
            self.featureIdUnderMouse = undefined
            self.mouseoverExtraInformation = undefined
          }
        },

        setRegionTooLarge(val: boolean, reason?: string) {
          self.regionTooLargeState = val
          self.regionTooLargeReasonState = reason ?? ''
          if (val) {
            self.featureIdUnderMouse = undefined
            self.mouseoverExtraInformation = undefined
          }
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
            // round up a bit to avoid it re-displaying for similar values
            self.userByteSizeLimit = Math.ceil(stats.bytes * 1.5)
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
        },

        clearDisplaySpecificData() {
          self.rpcDataMap = new Map()
          self.arcsState.clearAllRpcData()
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

        setWebGLRenderer(renderer: AlignmentsRenderer | null) {
          self.webglRenderer = renderer
        },

        setColorPalette(palette: ColorPalette | null) {
          self.colorPalette = palette
        },

        setVisibleMaxDepth(d: number) {
          self.visibleMaxDepth = d
        },
        setMaxY(y: number) {
          self.maxY = y
          const rowHeight = self.featureHeightSetting + self.featureSpacing
          const pileupHeight = y * rowHeight
          const totalHeight = self.coverageDisplayHeight + pileupHeight + 10
          // Clamp to maxHeight and ensure a minimum height
          const clampedHeight = Math.min(
            Math.max(totalHeight, 100),
            self.maxHeight,
          )
          self.setHeight(clampedHeight)
        },

        setScrollTop(scrollTop: number) {
          this.setCurrentRangeY([scrollTop, self.currentRangeY[1]])
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

        setShowOutline(show: boolean | undefined) {
          self.showOutline = show
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

        setShowArcs(show: boolean) {
          self.showArcs = show
        },

        setArcsHeight(height: number) {
          self.arcsHeight = height
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

        setShowInterbaseIndicators(show: boolean) {
          self.showInterbaseIndicators = show
        },

        setShowLinkedReads(flag: boolean) {
          self.showLinkedReads = flag
          if (flag) {
            self.showOutline = undefined
            self.colorBySetting = { type: 'insertSizeAndOrientation' }
          } else {
            self.colorBySetting = { type: 'normal' }
          }
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

        async selectFeatureById(featureId: string) {
          const session = getSession(self)
          try {
            const feat = await fetchFeatureDetails(self, featureId)
            if (isAlive(self) && feat && isSessionModelWithWidgets(session)) {
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
      }
    })
    .actions(self => ({
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
        if (isAlive(self)) {
          self.setRpcData(regionNumber, result)
          self.setModificationsReady(true)
          self.setSimplexModifications(result.simplexModifications)
        }
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
        if (isAlive(self)) {
          self.arcsState.setRpcData(regionNumber, result)
        }
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
        if (isAlive(self)) {
          self.setRpcData(regionNumber, result)
          self.setModificationsReady(true)
          self.setSimplexModifications(result.simplexModifications)
        }
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
        const view = getContainingView(self) as LGV
        if (view.visibleBp >= AUTO_FORCE_LOAD_BP) {
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
        }
        self.setRegionTooLarge(false, '')

        // If colorBy is tag mode and tag values haven't been fetched yet,
        // fetch them inline before the main data RPC so that colorTagMap
        // is populated when the worker needs it.
        if (self.colorBy.tag && !self.tagsReady) {
          const sessionId = getRpcSessionId(self)
          try {
            const vals = (await session.rpcManager.call(
              sessionId,
              'PileupGetGlobalValueForTag',
              {
                adapterConfig,
                tag: self.colorBy.tag,
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
          if (fetchGenerations.get(regionNumber) !== gen) {
            return
          }
        }

        const sequenceAdapter = getSequenceAdapter(session, region)

        if (self.renderingMode === 'linkedRead') {
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
        }
        if (self.showArcs) {
          await fetchArcsData(
            session,
            adapterConfig,
            sequenceAdapter,
            region,
            regionNumber,
            stopToken,
          )
        }

        // Discard stale responses from older requests for this regionNumber
        if (fetchGenerations.get(regionNumber) !== gen) {
          return
        }

        self.setRegionTooLarge(false)
        self.setLoadedRegion(regionNumber, {
          refName: region.refName,
          start: region.start,
          end: region.end,
          assemblyName: region.assemblyName,
        })
      }

      let activeStopToken: string | undefined

      async function fetchRegions(
        regions: { region: Region; regionNumber: number }[],
      ) {
        if (activeStopToken) {
          stopStopToken(activeStopToken)
        }
        const stopToken = createStopToken()
        activeStopToken = stopToken
        self.setRenderingStopToken(stopToken)
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
            if (isAlive(self) && activeStopToken === stopToken) {
              self.setError(e instanceof Error ? e : new Error(String(e)))
            }
          }
        } finally {
          if (isAlive(self) && activeStopToken === stopToken) {
            activeStopToken = undefined
            self.setRenderingStopToken(undefined)
            self.setLoading(false)
          }
        }
      }

      let prevInvalidationKey: string | undefined
      const superAfterAttach = self.afterAttach

      return {
        async fetchFeatures(region: Region, regionNumber = 0) {
          await fetchRegions([{ region, regionNumber }])
        },

        afterAttach() {
          superAfterAttach()
          // Upload autoruns are registered BEFORE the draw autorun so
          // that MobX runs them first when rpcDataMap changes, ensuring
          // GPU buffers are populated before renderBlocks() reads them.
          addDisposer(
            self,
            autorun(
              () => {
                const renderer = self.webglRenderer
                if (!renderer) {
                  return
                }
                const rpcDataMap = self.rpcDataMap
                const maxYVal = uploadRegionDataToGPU(renderer, rpcDataMap)
                if (maxYVal > 0) {
                  self.setMaxY(maxYVal)
                }
                for (const [regionNumber, data] of rpcDataMap) {
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
              { name: 'LinearAlignmentsDisplay:uploadPileupData' },
            ),
          )

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

          // Debounced autorun: compute visible max depth from only visible bins.
          // Updates 500ms after pan/zoom settles so the scale adjusts to the
          // current viewport without thrashing during continuous interaction.
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
                const blocks = view.dynamicBlocks.contentBlocks
                let maxDepth = 0
                for (const block of blocks) {
                  if (block.regionNumber === undefined) {
                    continue
                  }
                  const data = self.rpcDataMap.get(block.regionNumber)
                  if (!data) {
                    continue
                  }
                  const {
                    coverageDepths,
                    coverageStartOffset,
                    coverageBinSize,
                    regionStart,
                  } = data
                  const startBin = Math.max(
                    0,
                    Math.floor(
                      (block.start - regionStart - coverageStartOffset) /
                        coverageBinSize,
                    ),
                  )
                  const endBin = Math.min(
                    coverageDepths.length,
                    Math.ceil(
                      (block.end - regionStart - coverageStartOffset) /
                        coverageBinSize,
                    ),
                  )
                  for (let i = startBin; i < endBin; i++) {
                    const d = coverageDepths[i]!
                    if (d > maxDepth) {
                      maxDepth = d
                    }
                  }
                }
                self.setVisibleMaxDepth(maxDepth)
              },
              {
                delay: 400,
                name: 'LinearAlignmentsDisplay:visibleMaxDepth',
              },
            ),
          )

          // Draw autorun: re-renders whenever visual settings change.
          // Also tracks rpcDataMap so it re-fires after uploads above.
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
                  coverageNicedMax: self.coverageTicks?.nicedMax,
                  showMismatches: self.showMismatches,
                  showInterbaseIndicators: self.showInterbaseIndicators,
                  showModifications: self.showModifications,
                  showSashimiArcs: self.showSashimiArcs,
                  showOutline: self.showOutlineSetting,
                  showArcs: self.showArcs,
                  arcsHeight: self.arcsHeight,
                  canvasWidth: view.width,
                  canvasHeight: self.height,
                  highlightedFeatureIndex: self.highlightedFeatureIndex,
                  selectedFeatureIndex: self.selectedFeatureIndex,
                  highlightedChainIndices: self.highlightedChainIndices,
                  selectedChainIndices: self.selectedChainIndices,
                  colors: palette,
                  renderingMode: self.renderingMode,
                  arcLineWidth: self.arcsState.lineWidth,
                  bpRangeX: [0, 0],
                })
              },
              { name: 'LinearAlignmentsDisplay:draw' },
            ),
          )

          // Autorun: fetch data for all visible regions.
          //
          // IMPORTANT: Observable tracking discipline. This autorun reads
          // observables before its `await`, which MobX tracks as
          // dependencies. Any observable that is BOTH read here AND written
          // by the fetch it launches will cause a re-fire loop (the fetch
          // mutates state → autorun re-fires → cancels the in-flight fetch
          // → starts a new one → repeat forever).
          //
          // Tracked (read before await):
          //   view.initialized, self.regionTooLarge, view.visibleBp,
          //   self.fetchToken, view.staticRegions, self.loadedRegions
          //
          // Written by fetchRegions/fetchFeaturesForRegion:
          //   self.renderingStopToken — uses `activeStopToken` closure
          //     variable instead of reading the observable, so not tracked
          //   self.isLoading, self.error — write-only, not read here
          //   self.regionTooLargeState — only mutated on successful
          //     completion (alongside setLoadedRegion) or when region is
          //     too large (guard catches that case). Never mid-RPC.
          //   self.featureDensityStats — not tracked by this autorun
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

          // Autorun: invalidate data when any setting that affects the
          // worker-side RPC result changes (displayedRegions handled by mixin)
          addDisposer(
            self,
            autorun(
              () => {
                const key = JSON.stringify({
                  filterBy: self.filterBy,
                  sortedBy: self.sortedBy,
                  showLinkedReads: self.showLinkedReads,
                  showArcs: self.showArcs,
                  drawInter: self.arcsState.drawInter,
                  drawLongRange: self.arcsState.drawLongRange,
                  drawSingletons: self.drawSingletons,
                  drawProperPairs: self.drawProperPairs,
                  colorType: self.colorBy.type,
                  colorTag: self.colorBy.tag,
                })
                if (
                  prevInvalidationKey !== undefined &&
                  key !== prevInvalidationKey
                ) {
                  self.setLoading(true)
                  self.setStatusMessage('Loading')
                  self.setError(null)
                  self.clearAllRpcData()
                  self.bumpFetchToken()
                }
                prevInvalidationKey = key
              },
              { name: 'LinearAlignmentsDisplay:invalidateData' },
            ),
          )

          // Tag values are now fetched inline in fetchFeaturesForRegion
          // before the main data RPC, so no separate autorun is needed.
        },
      }
    })
    .views(self => ({
      /**
       * Track menu items
       */
      trackMenuItems() {
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
              label: 'Show coverage',
              type: 'checkbox' as const,
              checked: self.showCoverage,
              onClick: () => {
                self.setShowCoverage(!self.showCoverage)
              },
            },
            {
              label: 'Show arcs',
              type: 'checkbox' as const,
              checked: self.showArcs,
              onClick: () => {
                self.setShowArcs(!self.showArcs)
              },
            },
            {
              label: 'Show sashimi arcs',
              type: 'checkbox' as const,
              checked: self.showSashimiArcs,
              onClick: () => {
                self.setShowSashimiArcs(!self.showSashimiArcs)
              },
            },
            {
              label: 'Show mismatches',
              type: 'checkbox' as const,
              checked: self.showMismatches,
              onClick: () => {
                self.setShowMismatches(!self.showMismatches)
              },
            },
            {
              label: 'Show interbase indicators',
              type: 'checkbox' as const,
              checked: self.showInterbaseIndicators,
              onClick: () => {
                self.setShowInterbaseIndicators(!self.showInterbaseIndicators)
              },
            },
            {
              label: 'Show outline on reads',
              type: 'checkbox' as const,
              checked: self.showOutlineSetting,
              onClick: () => {
                self.setShowOutline(!self.showOutlineSetting)
              },
            },
            {
              label: 'Link paired/supplementary reads',
              type: 'checkbox' as const,
              checked: self.showLinkedReads,
              onClick: () => {
                self.setShowLinkedReads(!self.showLinkedReads)
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

        const items: MenuItem[] = [
          featureHeightMenu,
          showSubMenu,
          setMaxHeightItem,
          filterByItem,
          sortByMenu,
          colorByMenu,
          groupByItem,
        ]

        if (self.isChainMode) {
          items.push(
            {
              label: 'Edit filters',
              type: 'subMenu' as const,
              subMenu: [
                {
                  label: 'Show singletons',
                  type: 'checkbox' as const,
                  checked: self.drawSingletons,
                  onClick: () => {
                    self.setDrawSingletons(!self.drawSingletons)
                  },
                },
                {
                  label: 'Show proper pairs',
                  type: 'checkbox' as const,
                  checked: self.drawProperPairs,
                  onClick: () => {
                    self.setDrawProperPairs(!self.drawProperPairs)
                  },
                },
              ],
            },
            {
              label: 'Show Y-axis scalebar',
              type: 'checkbox' as const,
              checked: self.showYScalebar,
              onClick: () => {
                self.setShowYScalebar(!self.showYScalebar)
              },
            },
          )
        }

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
