import { lazy } from 'react'

import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import {
  SimpleFeature,
  getContainingTrack,
  getContainingView,
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

import type { CoverageTicks } from './components/CoverageYScaleBar.tsx'
import type { WebGLPileupDataResult } from '../RenderWebGLPileupDataRPC/types'
import type { ColorBy, FilterBy } from '../shared/types'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { Feature } from '@jbrowse/core/util'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

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

const WebGLPileupComponent = lazy(
  () => import('./components/WebGLPileupComponent.tsx'),
)

const WebGLTooltip = lazy(() => import('./components/WebGLTooltip.tsx'))

export const ColorScheme = {
  normal: 0,
  strand: 1,
  mappingQuality: 2,
  insertSize: 3,
  firstOfPairStrand: 4,
  pairOrientation: 5,
  insertSizeAndOrientation: 6,
} as const

/**
 * State model factory for WebGL Pileup Display
 */
export default function stateModelFactory(
  configSchema: AnyConfigurationSchemaType,
) {
  return types
    .compose(
      BaseLinearDisplay,
      types.model('LinearWebGLPileupDisplay', {
        /**
         * #property
         */
        type: types.literal('LinearWebGLPileupDisplay'),
        /**
         * #property
         */
        configuration: ConfigurationReference(configSchema),
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
      }),
    )
    .volatile(() => ({
      rpcData: null as WebGLPileupDataResult | null,
      loadedRegion: null as Region | null,
      isLoading: false,
      error: null as Error | null,
      webglRef: null as unknown,
      currentDomainX: null as [number, number] | null,
      currentRangeY: [0, 600] as [number, number],
      maxY: 0,
    }))
    .views(self => ({
      /**
       * Use custom component instead of block-based rendering
       */
      get DisplayMessageComponent() {
        return WebGLPileupComponent
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
       * Get the visible region from the parent view
       * Uses currentDomainX if set by the WebGL component (source of truth during/after interaction)
       * Falls back to computing from contentBlocks for initial load
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

          // Fallback: compute from contentBlocks (only used for initial load)
          const last = blocks[blocks.length - 1]
          if (first.refName !== last?.refName) {
            return {
              refName: first.refName,
              start: first.start,
              end: first.end,
              assemblyName: first.assemblyName,
            }
          }

          const bpPerPx = view.bpPerPx
          const blockOffsetPx = first.offsetPx
          const deltaPx = view.offsetPx - blockOffsetPx
          const deltaBp = deltaPx * bpPerPx

          const viewportStart = first.start + deltaBp
          const viewportEnd = viewportStart + view.width * bpPerPx

          return {
            refName: first.refName,
            start: viewportStart,
            end: viewportEnd,
            assemblyName: first.assemblyName,
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
          default:
            return ColorScheme.normal
        }
      },

      /**
       * Check if current view is within loaded data region
       */
      get isWithinLoadedRegion(): boolean {
        const visibleRegion = this.visibleRegion
        if (!self.loadedRegion || !visibleRegion) {
          return false
        }
        return (
          self.loadedRegion.refName === visibleRegion.refName &&
          visibleRegion.start >= self.loadedRegion.start &&
          visibleRegion.end <= self.loadedRegion.end
        )
      },

      get features(): Map<string, Feature> {
        return new Map()
      },
      get sortedBy() {
        return undefined
      },

      get coverageTicks(): CoverageTicks | undefined {
        if (!self.showCoverage || !self.rpcData) {
          return undefined
        }
        const maxDepth = self.rpcData.coverageMaxDepth
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
        const { rpcData, loadedRegion } = self
        if (!rpcData?.readIds) {
          return undefined
        }
        const idx = rpcData.readIds.indexOf(featureId)
        if (idx === -1) {
          return undefined
        }
        const startOffset = rpcData.readPositions[idx * 2]
        const endOffset = rpcData.readPositions[idx * 2 + 1]
        if (startOffset === undefined || endOffset === undefined) {
          return undefined
        }
        const start = rpcData.regionStart + startOffset
        const end = rpcData.regionStart + endOffset
        const flags = rpcData.readFlags[idx]
        const mapq = rpcData.readMapqs[idx]
        const strand = flags !== undefined && flags & 16 ? '-' : '+'
        const refName = loadedRegion?.refName ?? ''
        return {
          id: featureId,
          start,
          end,
          flags,
          mapq,
          strand,
          refName,
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
      setRpcData(data: WebGLPileupDataResult | null) {
        self.rpcData = data
        if (data) {
          self.maxY = data.maxY
        }
      },

      setLoadedRegion(region: Region | null) {
        self.loadedRegion = region
      },

      setLoading(loading: boolean) {
        self.isLoading = loading
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
        self.currentDomainX = domainX
      },

      setCurrentRangeY(rangeY: [number, number]) {
        self.currentRangeY = rangeY
      },

      setColorScheme(colorBy: ColorBy) {
        self.colorBySetting = colorBy
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

      // Stubs required by LinearAlignmentsDisplay
      setConfig(_config: unknown) {},
      setFeatureDensityStatsLimit(_stats: unknown) {},

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
          const loadedRegion = self.loadedRegion
          if (!loadedRegion) {
            return
          }

          // Use the feature's known position from typed arrays to narrow the
          // query region, avoiding a full re-fetch of the entire loaded region
          const info = self.getFeatureInfoById(featureId)
          const region = info
            ? {
                refName: loadedRegion.refName,
                start: info.start,
                end: info.end,
                assemblyName: loadedRegion.assemblyName,
              }
            : loadedRegion

          const sequenceAdapter = getSequenceAdapter(session, region)

          const { feature } = (await rpcManager.call(
            session.id ?? '',
            'WebGLGetFeatureDetails',
            {
              sessionId: session.id,
              adapterConfig,
              sequenceAdapter,
              region,
              featureId,
            },
          )) as { feature: Record<string, unknown> | undefined }

          if (isAlive(self) && feature && isSessionModelWithWidgets(session)) {
            const feat = new SimpleFeature(feature)
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
      async function fetchFeaturesImpl(region: Region) {
        const session = getSession(self)
        const { rpcManager } = session
        const track = getContainingTrack(self)
        const adapterConfig = getConf(track, 'adapter')

        if (!adapterConfig) {
          return
        }

        self.setLoading(true)
        self.setError(null)

        try {
          const sequenceAdapter = getSequenceAdapter(session, region)

          const result = (await rpcManager.call(
            session.id ?? '',
            'RenderWebGLPileupData',
            {
              sessionId: session.id,
              adapterConfig,
              sequenceAdapter,
              region,
              filterBy: self.filterBy,
            },
          )) as WebGLPileupDataResult

          self.setRpcData(result)
          self.setLoadedRegion({
            refName: region.refName,
            start: region.start,
            end: region.end,
            assemblyName: region.assemblyName,
          })
          self.setLoading(false)
        } catch (e) {
          self.setError(e instanceof Error ? e : new Error(String(e)))
          self.setLoading(false)
        }
      }

      return {
        fetchFeatures(region: Region) {
          fetchFeaturesImpl(region).catch(e => {
            console.error('Failed to fetch features:', e)
          })
        },

        /**
         * Called when WebGL component needs more data
         */
        handleNeedMoreData(requestedRegion: { start: number; end: number }) {
          const visibleRegion = self.visibleRegion
          if (!visibleRegion) {
            return
          }

          // Expand the requested region
          const width = requestedRegion.end - requestedRegion.start
          const expandedRegion = {
            refName: visibleRegion.refName,
            start: Math.max(0, requestedRegion.start - width),
            end: requestedRegion.end + width,
            assemblyName: visibleRegion.assemblyName,
          }

          fetchFeaturesImpl(expandedRegion).catch(e => {
            console.error('Failed to fetch features:', e)
          })
        },

        afterAttach() {
          // Fetch initial data when region becomes available
          addDisposer(
            self,
            reaction(
              () => self.visibleRegion,
              region => {
                if (region && !self.isWithinLoadedRegion) {
                  // Expand region by 2x on each side for buffering
                  const width = region.end - region.start
                  const expandedRegion = {
                    ...region,
                    start: Math.max(0, region.start - width * 2),
                    end: region.end + width * 2,
                  }
                  fetchFeaturesImpl(expandedRegion).catch(e => {
                    console.error('Failed to fetch features:', e)
                  })
                }
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
                const visibleRegion = self.visibleRegion
                if (visibleRegion) {
                  fetchFeaturesImpl(visibleRegion).catch(e => {
                    console.error('Failed to fetch features:', e)
                  })
                }
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
        return [
          {
            label: 'Color by...',
            subMenu: [
              {
                label: 'Normal',
                onClick: () => {
                  self.setColorScheme({ type: 'normal' })
                },
              },
              {
                label: 'Strand',
                onClick: () => {
                  self.setColorScheme({ type: 'strand' })
                },
              },
              {
                label: 'Mapping quality',
                onClick: () => {
                  self.setColorScheme({ type: 'mappingQuality' })
                },
              },
              {
                label: 'Insert size',
                onClick: () => {
                  self.setColorScheme({ type: 'insertSize' })
                },
              },
              {
                label: 'First of pair strand',
                onClick: () => {
                  self.setColorScheme({ type: 'firstOfPairStrand' })
                },
              },
              {
                label: 'Pair orientation',
                onClick: () => {
                  self.setColorScheme({ type: 'pairOrientation' })
                },
              },
              {
                label: 'Insert size and orientation',
                onClick: () => {
                  self.setColorScheme({ type: 'insertSizeAndOrientation' })
                },
              },
            ],
          },
          {
            label: self.showCoverage ? 'Hide coverage' : 'Show coverage',
            onClick: () => {
              self.setShowCoverage(!self.showCoverage)
            },
          },
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
      },
    }))
    .actions(self => ({
      async renderSvg() {
        const { renderSvg } = await import('./renderSvg.tsx')
        return renderSvg(self)
      },
    }))
}

export type LinearWebGLPileupDisplayStateModel = ReturnType<
  typeof stateModelFactory
>
export type LinearWebGLPileupDisplayModel =
  Instance<LinearWebGLPileupDisplayStateModel>
