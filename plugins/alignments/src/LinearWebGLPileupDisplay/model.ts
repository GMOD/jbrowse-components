import { lazy } from 'react'

import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import {
  getContainingTrack,
  getContainingView,
  getSession,
} from '@jbrowse/core/util'
import { addDisposer, getSnapshot, types } from '@jbrowse/mobx-state-tree'
import { BaseLinearDisplay } from '@jbrowse/plugin-linear-genome-view'
import { reaction } from 'mobx'

import type { WebGLPileupDataResult } from '../RenderWebGLPileupDataRPC/types'
import type { ColorBy, FilterBy } from '../shared/types'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { Feature } from '@jbrowse/core/util'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

interface Region {
  refName: string
  start: number
  end: number
  assemblyName?: string
}

const WebGLPileupComponent = lazy(
  () => import('./components/WebGLPileupComponent.tsx'),
)

export const ColorScheme = {
  strand: 0,
  mappingQuality: 1,
  insertSize: 2,
  firstOfPairStrand: 3,
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
      featureIdUnderMouseVolatile: undefined as string | undefined,
    }))
    .views(self => ({
      /**
       * Use custom component instead of block-based rendering
       */
      get DisplayMessageComponent() {
        return WebGLPileupComponent
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
          if (!last || first.refName !== last.refName) {
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
          case 'mappingQuality':
            return ColorScheme.mappingQuality
          case 'insertSize':
            return ColorScheme.insertSize
          case 'firstOfPairStrand':
            return ColorScheme.firstOfPairStrand
          default:
            return ColorScheme.strand
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

      get featureIdUnderMouse() {
        return self.featureIdUnderMouseVolatile
      },
      get features(): Map<string, Feature> {
        return new Map()
      },
      get sortedBy() {
        return undefined
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

      setFeatureIdUnderMouse(id: string | undefined) {
        self.featureIdUnderMouseVolatile = id
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
    }))
    .actions(self => {
      async function fetchFeaturesImpl(region: Region) {
        const session = getSession(self)
        const { rpcManager, assemblyManager } = session
        const track = getContainingTrack(self)
        const adapterConfig = getConf(track, 'adapter')

        if (!adapterConfig) {
          return
        }

        self.setLoading(true)
        self.setError(null)

        try {
          // Get the sequence adapter from the assembly (needed for CRAM files)
          const assemblyName = region.assemblyName
          const assembly = assemblyName
            ? assemblyManager.get(assemblyName)
            : undefined
          const sequenceAdapterConfig =
            assembly?.configuration?.sequence?.adapter
          const sequenceAdapter = sequenceAdapterConfig
            ? getSnapshot(sequenceAdapterConfig)
            : undefined

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
                label: 'Strand',
                onClick: () => self.setColorScheme({ type: 'strand' }),
              },
              {
                label: 'Mapping quality',
                onClick: () => self.setColorScheme({ type: 'mappingQuality' }),
              },
              {
                label: 'Insert size',
                onClick: () => self.setColorScheme({ type: 'insertSize' }),
              },
              {
                label: 'First of pair strand',
                onClick: () =>
                  self.setColorScheme({ type: 'firstOfPairStrand' }),
              },
            ],
          },
          {
            label: self.showCoverage ? 'Hide coverage' : 'Show coverage',
            onClick: () => self.setShowCoverage(!self.showCoverage),
          },
          {
            label: self.showMismatches ? 'Hide mismatches' : 'Show mismatches',
            onClick: () => self.setShowMismatches(!self.showMismatches),
          },
          {
            label: self.showInterbaseCounts
              ? 'Hide interbase counts'
              : 'Show interbase counts',
            onClick: () =>
              self.setShowInterbaseCounts(!self.showInterbaseCounts),
          },
          {
            label: self.showInterbaseIndicators
              ? 'Hide interbase indicators'
              : 'Show interbase indicators',
            onClick: () =>
              self.setShowInterbaseIndicators(!self.showInterbaseIndicators),
          },
        ]
      },
    }))
}

export type LinearWebGLPileupDisplayStateModel = ReturnType<
  typeof stateModelFactory
>
export type LinearWebGLPileupDisplayModel =
  Instance<LinearWebGLPileupDisplayStateModel>
