import { lazy } from 'react'

import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
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
import { BaseLinearDisplay } from '@jbrowse/plugin-linear-genome-view'
import { scaleLinear } from '@mui/x-charts-vendor/d3-scale'
import { reaction } from 'mobx'

import { ArcsSubModel } from './ArcsSubModel.ts'
import { CloudSubModel } from './CloudSubModel.ts'
import { SharedModificationsMixin } from '../shared/SharedModificationsMixin.ts'
import { getModificationsSubMenu } from '../shared/menuItems.ts'
import { setupModificationsAutorun } from '../shared/setupModificationsAutorun.ts'

import type { CoverageTicks } from './components/CoverageYScaleBar.tsx'
import type { WebGLArcsDataResult } from '../RenderWebGLArcsDataRPC/types.ts'
import type { WebGLCloudDataResult } from '../RenderWebGLCloudDataRPC/types.ts'
import type { WebGLPileupDataResult } from '../RenderWebGLPileupDataRPC/types'
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

interface Region {
  refName: string
  start: number
  end: number
  assemblyName?: string
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
  () => import('../LinearPileupDisplay/components/ColorByTagDialog.tsx'),
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
      BaseLinearDisplay,
      SharedModificationsMixin(),
      types.model('LinearAlignmentsDisplay', {
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
          types.enumeration(['pileup', 'arcs', 'cloud']),
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
        featureHeightSetting: types.maybe(types.number),
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
        arcsState: types.optional(ArcsSubModel, {}),
        /**
         * #property
         */
        cloudState: types.optional(CloudSubModel, {}),
      }),
    )
    .volatile(() => ({
      rpcDataMap: new Map<number, WebGLPileupDataResult>(),
      loadedRegions: new Map<number, Region>(),
      isLoading: false,
      statusMessage: undefined as string | undefined,
      error: null as Error | null,
      webglRef: null as unknown,
      currentDomainX: null as [number, number] | null,
      currentRangeY: [0, 600] as [number, number],
      maxY: 0,
      highlightedFeatureIndex: -1,
      selectedFeatureIndex: -1,
      colorTagMap: {} as Record<string, string>,
      tagsReady: true,
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

      get colorBy(): ColorBy {
        return self.colorBySetting ?? getConf(self, 'colorBy')
      },

      get modificationThreshold() {
        return this.colorBy.modifications?.threshold ?? 10
      },

      get filterBy(): FilterBy {
        return self.filterBySetting ?? getConf(self, 'filterBy')
      },

      get featureHeight(): number {
        return self.featureHeightSetting ?? getConf(self, 'featureHeight') ?? 7
      },

      get featureSpacing(): number {
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
       * Backward-compat getter: returns first entry in loadedRegions
       */
      get loadedRegion(): Region | null {
        const iter = self.loadedRegions.values().next()
        return iter.done ? null : iter.value
      },

      /**
       * Get visible regions from all content blocks in the parent view.
       * Returns an array of regions with screen pixel positions.
       */
      get visibleRegions() {
        try {
          const view = getContainingView(self) as LGV
          if (!view.initialized) {
            return []
          }
          const blocks = view.dynamicBlocks.contentBlocks
          if (blocks.length === 0) {
            return []
          }

          const bpPerPx = view.bpPerPx
          const regions: {
            refName: string
            regionNumber: number
            start: number
            end: number
            assemblyName: string
            screenStartPx: number
            screenEndPx: number
          }[] = []

          // Group blocks by regionNumber and compute viewport-clipped ranges
          for (const block of blocks) {
            const blockScreenStart = block.offsetPx - view.offsetPx
            const blockScreenEnd = blockScreenStart + block.widthPx

            // Clip to viewport
            const clippedScreenStart = Math.max(0, blockScreenStart)
            const clippedScreenEnd = Math.min(view.width, blockScreenEnd)
            if (clippedScreenStart >= clippedScreenEnd) {
              continue
            }

            // Compute bp range for the clipped screen range
            const bpStart =
              block.start + (clippedScreenStart - blockScreenStart) * bpPerPx
            const bpEnd =
              block.start + (clippedScreenEnd - blockScreenStart) * bpPerPx

            const blockRegionNumber = block.regionNumber ?? 0

            // Merge with previous region if same regionNumber
            const prev = regions[regions.length - 1]
            if (prev && prev.regionNumber === blockRegionNumber) {
              prev.end = bpEnd
              prev.screenEndPx = clippedScreenEnd
            } else {
              regions.push({
                refName: block.refName,
                regionNumber: blockRegionNumber,
                start: bpStart,
                end: bpEnd,
                assemblyName: block.assemblyName,
                screenStartPx: clippedScreenStart,
                screenEndPx: clippedScreenEnd,
              })
            }
          }
          return regions
        } catch {
          return []
        }
      },

      /**
       * Get the primary visible region from the parent view.
       * Uses currentDomainX if set by the WebGL component (source of truth during/after interaction)
       * Falls back to first visibleRegion for initial load
       */
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

          // If WebGL component has set the domain directly, use that
          // This is the source of truth during and after interaction
          if (self.currentDomainX) {
            return {
              refName: first.refName,
              start: self.currentDomainX[0],
              end: self.currentDomainX[1],
              assemblyName: first.assemblyName,
            }
          }

          // Use visibleRegions (handles multi-ref)
          const regions = this.visibleRegions
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

      /**
       * Check if current view is within loaded data region
       */
      get isWithinLoadedRegion(): boolean {
        const regions = this.visibleRegions
        if (regions.length === 0) {
          return false
        }
        for (const region of regions) {
          const loaded = self.loadedRegions.get(region.regionNumber)
          if (
            !loaded ||
            region.start < loaded.start ||
            region.end > loaded.end
          ) {
            return false
          }
        }
        return true
      },

      get showLoading() {
        return (
          self.isLoading ||
          !self.featureDensityStatsReady ||
          !this.visibleRegion
        )
      },

      get features(): Map<string, Feature> {
        return new Map()
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
    }))
    .views(self => ({
      getFeatureInfoById(featureId: string) {
        // Search across all loaded regionNumber data
        const view = getContainingView(self) as LGV
        const displayedRegions = view.displayedRegions
        for (const [regionNumber, rpcData] of self.rpcDataMap) {
          if (!rpcData?.readIds) {
            continue
          }
          const idx = rpcData.readIds.indexOf(featureId)
          if (idx === -1) {
            continue
          }
          const startOffset = rpcData.readPositions[idx * 2]
          const endOffset = rpcData.readPositions[idx * 2 + 1]
          if (startOffset === undefined || endOffset === undefined) {
            continue
          }
          const start = rpcData.regionStart + startOffset
          const end = rpcData.regionStart + endOffset
          const flags = rpcData.readFlags[idx]
          const mapq = rpcData.readMapqs[idx]
          const strand = flags !== undefined && flags & 16 ? '-' : '+'
          const name = rpcData.readNames[idx] ?? ''
          const refName =
            displayedRegions[regionNumber]?.refName ?? 'unknown'
          return {
            id: featureId,
            name,
            start,
            end,
            flags,
            mapq,
            strand,
            refName,
          }
        }
        return undefined
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
      setRpcData(regionNumber: number, data: WebGLPileupDataResult | null) {
        const next = new Map(self.rpcDataMap)
        if (data) {
          next.set(regionNumber, data)
        } else {
          next.delete(regionNumber)
        }
        self.rpcDataMap = next
        // Update maxY to be max across all regions
        let maxY = 0
        for (const d of self.rpcDataMap.values()) {
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
        self.statusMessage = msg
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
        const rowHeight = self.featureHeight + self.featureSpacing
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

      setCurrentDomain(domainX: [number, number]) {
        const cur = self.currentDomainX
        if (cur?.[0] !== domainX[0] || cur[1] !== domainX[1]) {
          self.currentDomainX = domainX
        }
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

      setFeatureHeight(height: number) {
        self.featureHeightSetting = height
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

      setShowInterbaseCounts(show: boolean) {
        self.showInterbaseCounts = show
      },

      setShowInterbaseIndicators(show: boolean) {
        self.showInterbaseIndicators = show
      },

      setRenderingMode(mode: 'pileup' | 'arcs' | 'cloud') {
        self.renderingMode = mode
        if (mode === 'pileup') {
          self.colorBySetting = { type: 'normal' }
        } else if (mode === 'arcs' || mode === 'cloud') {
          self.colorBySetting = { type: 'insertSizeAndOrientation' }
        }
      },

      // Stubs required by LinearAlignmentsDisplay
      setConfig(_config: unknown) {},

      getFeatureByID(_blockKey: string, _id: string) {
        return undefined
      },

      searchFeatureByID(_id: string) {
        return undefined
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

      async function fetchCloudData(
        session: { rpcManager: any },
        adapterConfig: unknown,
        sequenceAdapter: unknown,
        region: Region,
        regionNumber: number,
      ) {
        const sessionId = getRpcSessionId(self)
        const result = (await session.rpcManager.call(
          sessionId,
          'RenderWebGLCloudData',
          {
            sessionId,
            adapterConfig,
            sequenceAdapter,
            region,
            filterBy: self.filterBy,
            height: self.height,
          },
        )) as WebGLCloudDataResult
        self.cloudState.setRpcData(regionNumber, result)
      }

      async function fetchFeaturesForRegion(
        region: Region,
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
          const sequenceAdapter = getSequenceAdapter(session, region)

          // Always fetch pileup data (includes coverage) regardless of mode
          await fetchPileupData(
            session,
            adapterConfig,
            sequenceAdapter,
            region,
            regionNumber,
          )

          // Fetch mode-specific data in addition to pileup
          if (self.renderingMode === 'arcs') {
            await fetchArcsData(
              session,
              adapterConfig,
              sequenceAdapter,
              region,
              regionNumber,
            )
          } else if (self.renderingMode === 'cloud') {
            await fetchCloudData(
              session,
              adapterConfig,
              sequenceAdapter,
              region,
              regionNumber,
            )
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
          self.setLoading(false)
        } catch (e) {
          if (fetchGenerations.get(regionNumber) !== gen) {
            return
          }
          self.setError(e instanceof Error ? e : new Error(String(e)))
          self.setLoading(false)
        }
      }

      function fetchAllVisibleRegions() {
        const regions = self.visibleRegions
        if (!self.featureDensityStatsReadyAndRegionNotTooLarge) {
          return
        }
        for (const region of regions) {
          const loaded = self.loadedRegions.get(region.regionNumber)
          const buffer = (region.end - region.start) * 0.5
          const needsData =
            !loaded ||
            region.start - buffer < loaded.start ||
            region.end + buffer > loaded.end

          if (needsData) {
            const width = region.end - region.start
            const expandedRegion = {
              refName: region.refName,
              start: Math.max(0, region.start - width * 2),
              end: region.end + width * 2,
              assemblyName: region.assemblyName,
            }
            fetchFeaturesForRegion(expandedRegion, region.regionNumber).catch(
              (e: unknown) => {
                console.error('Failed to fetch features:', e)
              },
            )
          }
        }
      }

      return {
        fetchFeatures(region: Region, regionNumber = 0) {
          fetchFeaturesForRegion(region, regionNumber).catch((e: unknown) => {
            console.error('Failed to fetch features:', e)
          })
        },

        afterAttach() {
          // Fetch data when the visible regions approach the edge of
          // loaded data.  Uses a 50% viewport buffer so we prefetch
          // before the user actually scrolls past the loaded boundary.
          addDisposer(
            self,
            reaction(
              () => ({
                regions: self.visibleRegions,
                ready: self.featureDensityStatsReadyAndRegionNotTooLarge,
              }),
              ({ regions, ready }) => {
                if (regions.length === 0 || !ready) {
                  return
                }
                fetchAllVisibleRegions()
              },
              { delay: 300, fireImmediately: true },
            ),
          )

          // Re-fetch when filter changes
          addDisposer(
            self,
            reaction(
              () => self.filterBy,
              () => {
                if (self.featureDensityStatsReadyAndRegionNotTooLarge) {
                  self.clearAllRpcData()
                  fetchAllVisibleRegions()
                }
              },
            ),
          )

          // Re-fetch when colorBy changes (modifications/methylation/tag modes
          // require different worker-side processing).
          // For tag mode, also re-fetch when tagsReady becomes true (colorTagMap populated).
          addDisposer(
            self,
            reaction(
              () => ({
                colorType: self.colorBy.type,
                tag: self.colorBy.tag,
                tagsReady: self.tagsReady,
              }),
              ({ colorType, tagsReady }) => {
                if (colorType === 'tag' && !tagsReady) {
                  return
                }
                if (self.featureDensityStatsReadyAndRegionNotTooLarge) {
                  self.clearAllRpcData()
                  fetchAllVisibleRegions()
                }
              },
            ),
          )

          // Fetch unique tag values when colorBy.type is 'tag' and tags not yet ready
          addDisposer(
            self,
            reaction(
              () => ({
                tag: self.colorBy.tag,
                tagsReady: self.tagsReady,
                region: self.visibleRegion,
              }),
              async ({ tag, tagsReady, region }) => {
                if (!tag || tagsReady || !region) {
                  return
                }
                try {
                  const session = getSession(self)
                  const track = getContainingTrack(self)
                  const adapterConfig = getConf(track, 'adapter')
                  const sessionId = getRpcSessionId(self)
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
              { fireImmediately: true },
            ),
          )

          // Clear all data when displayedRegions changes (region indices become stale)
          addDisposer(
            self,
            reaction(
              () => {
                const view = getContainingView(self) as LGV
                return view.displayedRegions
              },
              () => {
                self.clearAllRpcData()
                self.arcsState.clearAllRpcData()
                self.cloudState.clearAllRpcData()
                fetchAllVisibleRegions()
              },
            ),
          )

          // Re-fetch when rendering mode changes or arcs-specific settings change
          addDisposer(
            self,
            reaction(
              () => ({
                mode: self.renderingMode,
                drawInter: self.arcsState.drawInter,
                drawLongRange: self.arcsState.drawLongRange,
              }),
              () => {
                self.clearAllRpcData()
                self.arcsState.clearAllRpcData()
                self.cloudState.clearAllRpcData()
                fetchAllVisibleRegions()
              },
            ),
          )

          setupModificationsAutorun(self, () => {
            const view = getContainingView(self) as LGV
            return view.initialized
          })
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

        // Pileup-specific menu items
        const pileupItems = [
          colorByMenu,
          coverageItem,
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

        // Cloud-specific menu items
        const cloudItems = [
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
            ],
          },
        ]

        const modeItems =
          self.renderingMode === 'arcs'
            ? arcsItems
            : self.renderingMode === 'cloud'
              ? cloudItems
              : pileupItems

        return [modeMenu, ...modeItems]
      },
    }))
    .actions(self => {
      const superReload = self.reload
      return {
        async reload() {
          self.clearAllRpcData()
          self.arcsState.clearAllRpcData()
          self.cloudState.clearAllRpcData()
          superReload()
        },
        async renderSvg(opts?: ExportSvgDisplayOptions) {
          const { renderSvg } = await import('./renderSvg.tsx')
          return renderSvg(self, opts)
        },
      }
    })
}

export type LinearAlignmentsDisplayStateModel = ReturnType<
  typeof stateModelFactory
>
export type LinearAlignmentsDisplayModel =
  Instance<LinearAlignmentsDisplayStateModel>
