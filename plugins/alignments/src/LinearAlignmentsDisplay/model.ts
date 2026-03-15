import { lazy } from 'react'

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
  max,
} from '@jbrowse/core/util'
import {
  addDisposer,
  getSnapshot,
  isAlive,
  types,
} from '@jbrowse/mobx-state-tree'
import {
  MultiRegionDisplayMixin,
  TrackHeightMixin,
} from '@jbrowse/plugin-linear-genome-view'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import MenuOpenIcon from '@mui/icons-material/MenuOpen'
import SwapVertIcon from '@mui/icons-material/SwapVert'
import { scaleLinear } from '@mui/x-charts-vendor/d3-scale'
import { autorun, observable } from 'mobx'

import { ArcsSubModel } from './ArcsSubModel.ts'
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
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { MenuItem } from '@jbrowse/core/ui'
import type { Feature } from '@jbrowse/core/util'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type {
  ExportSvgDisplayOptions,
  FetchContext,
  LinearGenomeViewModel,
  MultiRegionRegion as Region,
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
    const insertionWidthPx = length * pxPerBp
    return Math.min(5, insertionWidthPx / 3)
  }
  return Math.min(pxPerBp, 1) // thin bar, subpixel when zoomed out
}

export type { MultiRegionRegion as Region } from '@jbrowse/plugin-linear-genome-view'

function getSequenceAdapter(session: any, region: Region) {
  const assembly = region.assemblyName
    ? session.assemblyManager.get(region.assemblyName)
    : undefined
  const sequenceAdapterConfig = assembly?.configuration?.sequence?.adapter
  return sequenceAdapterConfig ? getSnapshot(sequenceAdapterConfig) : undefined
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
    { sessionId, adapterConfig, sequenceAdapter, region, featureId },
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
      MultiRegionDisplayMixin(),
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
        flipStrandLongReadChains: true,
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

      const { blockState, showTooltips, userByteSizeLimit, ...cleaned } = snap
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
        const linked =
          renderingMode === 'linkedRead' || renderingMode === 'cloud'
        snap = {
          ...rest,
          showLinkedReads: linked,
          colorBySetting: linked
            ? (rest.colorBySetting ?? { type: 'insertSizeAndOrientation' })
            : rest.colorBySetting,
        }
      }

      // Strip removed showReadCloud property from old snapshots
      if (snap.showReadCloud !== undefined) {
        const { showReadCloud, ...rest } = snap
        const linked = snap.showLinkedReads || showReadCloud
        snap = {
          ...rest,
          showLinkedReads: linked,
          colorBySetting: linked
            ? (rest.colorBySetting ?? { type: 'insertSizeAndOrientation' })
            : rest.colorBySetting,
        }
      }

      // Migrate old nested PileupDisplay/SNPCoverageDisplay sub-display format
      // from v1.x LinearAlignmentsDisplay sessions
      if (snap.PileupDisplay || snap.SNPCoverageDisplay) {
        const { PileupDisplay, SNPCoverageDisplay, snpCovHeight, ...rest } =
          snap
        const pileup = PileupDisplay ?? {}
        snap = {
          ...rest,
          showSoftClipping: pileup.showSoftClipping ?? false,
          colorBySetting: pileup.colorBy,
          filterBySetting: pileup.filterBy,
          coverageHeight: snpCovHeight ?? 45,
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
      webglRenderer: null as AlignmentsRenderer | null,
      colorPalette: null as ColorPalette | null,
      visibleMaxDepth: 0,
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
          self.userByteSizeLimit || (getConf(self, 'fetchSizeLimit') as number)
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
        if (self.showLinkedReads) {
          return 'linkedRead'
        }
        return 'pileup'
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

      get regionTooLarge() {
        return self.regionTooLargeState
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

      get totalPileupHeight() {
        return self.maxY * (this.featureHeightSetting + this.featureSpacing)
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
          topOffset:
            (self.showCoverage ? self.coverageHeight : 0) +
            (self.showArcs ? self.arcsHeight : 0),
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

      get pileupViewportHeight() {
        return Math.max(0, self.height - this.coverageDisplayHeight)
      },

      get scrollableHeight() {
        return Math.max(0, self.totalPileupHeight - this.pileupViewportHeight)
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
      const superSetRegionTooLarge = self.setRegionTooLarge
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

        setLoadedRegion(regionNumber: number, region: Region | null) {
          if (region) {
            self.setLoadedRegionForRegion(regionNumber, region)
          } else {
            const next = new Map(self.loadedRegions)
            next.delete(regionNumber)
            self.loadedRegions = next
          }
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
        },

        setScrollTop(scrollTop: number) {
          this.setCurrentRangeY([
            scrollTop,
            scrollTop + self.pileupViewportHeight,
          ])
        },

        setCurrentRangeY(rangeY: [number, number]) {
          const cur = self.currentRangeY
          if (cur[0] !== rangeY[0] || cur[1] !== rangeY[1]) {
            self.currentRangeY = rangeY
          }
        },

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
          if (
            colorBy.type !== 'tag' ||
            colorBy.tag !== self.colorBySetting?.tag
          ) {
            self.colorTagMap = {}
          }
          self.colorBySetting = colorBy
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
          let added = false
          for (const value of uniqueTag) {
            if (!map[value]) {
              const totalKeys = Object.keys(map).length
              map[value] = colorPalette[totalKeys % colorPalette.length]!
              added = true
            }
          }
          self.colorTagMap = map
          return added
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
          self.currentRangeY = [0, 0]
        },

        setNoSpacing(flag?: boolean) {
          self.noSpacing = flag
          self.currentRangeY = [0, 0]
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
      async function fetchPileupData(
        adapterConfig: unknown,
        sequenceAdapter: unknown,
        region: Region,
        stopToken: string,
      ) {
        const sessionId = getRpcSessionId(self)
        return getSession(self).rpcManager.call(sessionId, 'RenderPileupData', {
          sessionId,
          adapterConfig,
          sequenceAdapter,
          region,
          filterBy: self.filterBy,
          colorBy: self.colorBy,
          colorTagMap: self.colorTagMap,
          sortedBy: self.sortedBy?.type === 'tag' ? self.sortedBy : undefined,
          showSoftClipping: self.showSoftClipping,
          stopToken,
          statusCallback: (msg: string) => {
            if (isAlive(self)) {
              self.setStatusMessage(msg)
            }
          },
        })
      }

      async function fetchChainData(
        adapterConfig: unknown,
        sequenceAdapter: unknown,
        region: Region,
        stopToken: string,
      ) {
        const sessionId = getRpcSessionId(self)
        return getSession(self).rpcManager.call(sessionId, 'RenderChainData', {
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
        })
      }

      async function fetchFeaturesForRegion(
        adapterConfig: unknown,
        region: Region,
        regionNumber: number,
        stopToken: string,
      ) {
        const session = getSession(self)
        const sequenceAdapter = getSequenceAdapter(session, region)

        const result = await (self.renderingMode === 'linkedRead'
          ? fetchChainData(adapterConfig, sequenceAdapter, region, stopToken)
          : fetchPileupData(adapterConfig, sequenceAdapter, region, stopToken))

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
            const t = data.interbaseTypes[i]!
            if (t === 1) {
              insertions.push({
                featureId,
                position,
                length,
                sequence: data.interbaseSequences[i],
              })
            } else if (t === 2) {
              const readStartOffset = data.readPositions[readIdx * 2]!
              const ibPosOffset = data.interbasePositions[i]!
              const isLeftClip = ibPosOffset === readStartOffset
              const clipStart = isLeftClip ? position - length : position
              softclips.push({ featureId, position, clipStart, length })
            } else {
              hardclips.push({ featureId, position, length })
            }
          }
        }

        return { features, mismatches, gaps, insertions, softclips, hardclips }
      }

      function fillYArraysFromLayout(
        data: PileupDataResult,
        layoutMap: Map<string, number>,
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
            data.modificationYs[i] = yLookup[data.modificationReadIndices[i]!]!
          }
        }
        if (data.softclipBaseReadIndices) {
          for (let i = 0; i < data.numSoftclipBases; i++) {
            data.softclipBaseYs[i] = yLookup[data.softclipBaseReadIndices[i]!]!
          }
        }

        data.maxY = max(layoutMap.values(), 0) + 1
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

          const layoutMap =
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

          fillYArraysFromLayout(data, layoutMap)
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
              insertSize: 0,
              pairOrientation: 0,
              strand: f.strand,
            }),
          )

          const layoutMap = computeLayout(features)

          for (const [regionNumber, data] of entries) {
            fillYArraysFromLayout(data, layoutMap)
            self.setRpcData(regionNumber, data)
          }
        }
      }

      function computeAndSetArcs(
        regions: { region: Region; regionNumber: number }[],
      ) {
        const allRegionInfos: {
          refName: string
          start: number
          end: number
          regionNumber: number
        }[] = []
        for (const [regionNumber, loaded] of self.loadedRegions) {
          allRegionInfos.push({
            refName: loaded.refName,
            start: loaded.start,
            end: loaded.end,
            regionNumber,
          })
        }
        for (const r of regions) {
          if (!allRegionInfos.some(ri => ri.regionNumber === r.regionNumber)) {
            allRegionInfos.push({
              refName: r.region.refName,
              start: r.region.start,
              end: r.region.end,
              regionNumber: r.regionNumber,
            })
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
            fetchSizeLimit: self.fetchSizeLimit,
            visibleBp: view.visibleBp,
          }
        },

        onFetchNeeded(needed: { region: Region; regionNumber: number }[]) {
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
                  console.log(
                    '[alignments] new tag colors discovered:',
                    r.result.newTagValues,
                    'colorTagMap now:',
                    { ...self.colorTagMap },
                  )
                }
              }
              self.setModificationsReady(true)
              self.setSimplexModifications(r.result.simplexModifications)
              self.setLoadedRegion(r.regionNumber, r.region)
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
              console.log(
                '[alignments] re-fetching with populated colorTagMap:',
                { ...self.colorTagMap },
              )
              self.invalidateLoadedRegions()
            }
          })
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
                  const { coverageDepths, coverageStartOffset, regionStart } =
                    data
                  const startBin = Math.max(
                    0,
                    Math.floor(block.start - regionStart - coverageStartOffset),
                  )
                  const endBin = Math.min(
                    coverageDepths.length,
                    Math.ceil(block.end - regionStart - coverageStartOffset),
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

                // See dataVersion comment in MultiRegionDisplayMixin.
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const _dv = self.dataVersion
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const _adv = self.arcsState.dataVersion
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
                  showSoftClipping: self.showSoftClipping,
                  showInterbaseIndicators: self.showInterbaseIndicators,
                  showModifications: self.showModifications,
                  showSashimiArcs: self.showSashimiArcs,
                  showOutline: self.showOutlineSetting,
                  showArcs: self.showArcs,
                  arcsHeight: self.arcsHeight,
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
                })
              },
              { name: 'LinearAlignmentsDisplay:draw' },
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
                  const regions = view.mergedVisibleRegions.map(vr => ({
                    region: vr as Region,
                    regionNumber: vr.regionNumber,
                  }))
                  computeAndSetArcs(regions)
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
}

export type LinearAlignmentsDisplayStateModel = ReturnType<
  typeof stateModelFactory
>
export type LinearAlignmentsDisplayModel =
  Instance<LinearAlignmentsDisplayStateModel>
