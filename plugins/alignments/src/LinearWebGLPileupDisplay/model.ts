import { lazy } from 'react'
import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import {
  getContainingTrack,
  getContainingView,
  getSession,
  renameRegionsIfNeeded,
} from '@jbrowse/core/util'
import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import {
  types,
  addDisposer,
  Instance,
  flow,
  getEnv,
} from '@jbrowse/mobx-state-tree'
import { BaseLinearDisplay } from '@jbrowse/plugin-linear-genome-view'
import { reaction } from 'mobx'

import type { ColorBy, FilterBy, Mismatch } from '../shared/types'

export interface CoverageData {
  position: number
  depth: number
}

export interface GapData {
  featureId: string
  start: number
  end: number
}

export interface MismatchData {
  featureId: string
  position: number
  base: number // 0=A, 1=C, 2=G, 3=T
}

export interface InsertionData {
  featureId: string
  position: number
}
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import type { Feature } from '@jbrowse/core/util'

// Lazy load the WebGL component
const WebGLPileupComponent = lazy(
  () => import('./components/WebGLPileupComponent'),
)

type LGV = LinearGenomeViewModel

// Color scheme constants
export const ColorScheme = {
  strand: 0,
  mappingQuality: 1,
  insertSize: 2,
  firstOfPairStrand: 3,
} as const

export interface FeatureData {
  id: string
  start: number
  end: number
  strand: number
  flags: number
  mapq: number
  insertSize: number
}

/**
 * State model factory for WebGL Pileup Display
 */
export default function stateModelFactory(
  configSchema: AnyConfigurationSchemaType,
) {
  return types
    .compose(
      'LinearWebGLPileupDisplay',
      BaseLinearDisplay,
      types.model({
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
      }),
    )
    .volatile(() => ({
      // Feature data loaded from adapter (named to avoid conflict with base)
      webglFeatures: [] as FeatureData[],
      // CIGAR-derived data
      webglGaps: [] as GapData[],
      webglMismatches: [] as MismatchData[],
      webglInsertions: [] as InsertionData[],
      // Region that's currently loaded in GPU
      loadedRegion: null as {
        refName: string
        start: number
        end: number
      } | null,
      // Coverage data - cached to avoid recalculating on every render
      coverageData: { data: [] as CoverageData[], maxDepth: 0 },
      // Loading state
      isLoading: false,
      error: null as Error | null,
      // Reference to WebGL component for imperative updates
      webglRef: null as any,
      // Current view domain (managed directly for smooth zoom)
      currentDomainX: null as [number, number] | null,
      currentRangeY: [0, 600] as [number, number],
      // Layout info
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
       * Override rendererType to prevent lookup errors
       * We don't use a renderer - we render directly with WebGL
       */
      get rendererType(): undefined {
        return undefined
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
          if (!view?.initialized) {
            return null
          }
          const blocks = view.dynamicBlocks?.contentBlocks
          if (!blocks || blocks.length === 0) {
            return null
          }
          const first = blocks[0]

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
          if (first.refName !== last.refName) {
            return {
              refName: first.refName,
              start: first.start,
              end: last.end,
              assemblyName: first.assemblyName,
            }
          }

          const bpPerPx = view.bpPerPx
          const blockOffsetPx = first.offsetPx ?? 0
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
        if (!colorBy) {
          return ColorScheme.strand
        }
        switch (colorBy.type) {
          case 'mappingQuality':
            return ColorScheme.mappingQuality
          case 'insertSize':
            return ColorScheme.insertSize
          case 'firstOfPairStrand':
            return ColorScheme.firstOfPairStrand
          case 'strand':
          default:
            return ColorScheme.strand
        }
      },

      /**
       * Check if current view is within loaded data region
       */
      get isWithinLoadedRegion(): boolean {
        if (!self.loadedRegion || !this.visibleRegion) {
          return false
        }
        return (
          self.loadedRegion.refName === this.visibleRegion.refName &&
          this.visibleRegion.start >= self.loadedRegion.start &&
          this.visibleRegion.end <= self.loadedRegion.end
        )
      },

      // Compatibility methods for LinearAlignmentsDisplay
      get featureIdUnderMouse(): undefined {
        return undefined
      },

      get features(): Map<string, Feature> {
        return new Map()
      },

      get sortedBy(): undefined {
        return undefined
      },

    }))
    .actions(self => ({
      setFeatures(features: FeatureData[]) {
        self.webglFeatures = features
      },

      setLoadedRegion(
        region: { refName: string; start: number; end: number } | null,
      ) {
        self.loadedRegion = region
      },

      /**
       * Compute and cache coverage from loaded features using sweep line algorithm
       */
      computeCoverage() {
        const features = self.webglFeatures
        if (features.length === 0 || !self.loadedRegion) {
          self.coverageData = { data: [], maxDepth: 0 }
          return
        }

        const { start: regionStart, end: regionEnd } = self.loadedRegion
        const regionLength = regionEnd - regionStart

        // Events: +1 at read start, -1 at read end
        const events: { pos: number; delta: number }[] = []
        for (const f of features) {
          events.push({ pos: f.start, delta: 1 })
          events.push({ pos: f.end, delta: -1 })
        }

        events.sort((a, b) => a.pos - b.pos)

        // Build coverage array - use binning for large regions
        const maxBins = 10000
        const binSize = Math.max(1, Math.ceil(regionLength / maxBins))
        const numBins = Math.ceil(regionLength / binSize)

        const bins: CoverageData[] = []
        for (let i = 0; i < numBins; i++) {
          bins.push({
            position: regionStart + i * binSize,
            depth: 0,
          })
        }

        let currentDepth = 0
        let eventIdx = 0

        for (let binIdx = 0; binIdx < numBins; binIdx++) {
          const binEnd = regionStart + (binIdx + 1) * binSize
          while (eventIdx < events.length && events[eventIdx].pos < binEnd) {
            currentDepth += events[eventIdx].delta
            eventIdx++
          }
          bins[binIdx].depth = currentDepth
        }

        const maxDepth = Math.max(1, ...bins.map(b => b.depth))
        self.coverageData = { data: bins, maxDepth }
      },

      setLoading(loading: boolean) {
        self.isLoading = loading
      },

      setError(error: Error | null) {
        self.error = error
      },

      setWebGLRef(ref: any) {
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

      // Compatibility methods for LinearAlignmentsDisplay
      setConfig(_config: unknown) {
        // No-op for now - config is managed differently in WebGL display
      },

      setFeatureDensityStatsLimit(_stats: unknown) {
        // No-op - WebGL display doesn't use feature density stats
      },

      getFeatureByID(_blockKey: string, _id: string) {
        return undefined
      },

      searchFeatureByID(_id: string) {
        return undefined
      },
    }))
    .actions(self => ({
      /**
       * Fetch features for a region from the adapter
       */
      fetchFeatures: flow(function* fetchFeatures(region: {
        refName: string
        start: number
        end: number
        assemblyName?: string
      }) {
        const session = getSession(self)
        const { pluginManager } = getEnv(self)
        const track = getContainingTrack(self)
        const adapterConfig = getConf(track, 'adapter')

        if (!adapterConfig) {
          return
        }

        self.isLoading = true
        self.error = null

        try {
          const { assemblyManager } = session
          const { regions: renamedRegions } = yield renameRegionsIfNeeded(
            assemblyManager,
            {
              regions: [region],
              adapterConfig,
              sessionId: session.id,
            },
          )
          const renamedRegion = renamedRegions[0]

          const { dataAdapter } = yield getAdapter(
            pluginManager,
            session.id,
            adapterConfig,
          )

          const featureObservable = dataAdapter.getFeatures(renamedRegion)

          const features: FeatureData[] = []
          const gaps: GapData[] = []
          const mismatches: MismatchData[] = []
          const insertions: InsertionData[] = []

          // Helper to convert base letter to number for shader
          const baseToNum = (base: string): number => {
            switch (base.toUpperCase()) {
              case 'A':
                return 0
              case 'C':
                return 1
              case 'G':
                return 2
              case 'T':
                return 3
              default:
                return 0
            }
          }

          yield new Promise<void>((resolve, reject) => {
            featureObservable.subscribe({
              next(feature: Feature) {
                const featureId = feature.id()
                const featureStart = feature.get('start')

                features.push({
                  id: featureId,
                  start: featureStart,
                  end: feature.get('end'),
                  strand: feature.get('strand') ?? 1,
                  flags: feature.get('flags') ?? 0,
                  mapq: feature.get('score') ?? feature.get('qual') ?? 60,
                  insertSize: Math.abs(
                    feature.get('template_length') ?? 400,
                  ),
                })

                // Extract CIGAR-derived mismatches
                const featureMismatches = feature.get('mismatches') as
                  | Mismatch[]
                  | undefined
                if (featureMismatches) {
                  for (const mm of featureMismatches) {
                    if (mm.type === 'deletion' || mm.type === 'skip') {
                      gaps.push({
                        featureId,
                        start: featureStart + mm.start,
                        end: featureStart + mm.start + mm.length,
                      })
                    } else if (mm.type === 'mismatch') {
                      mismatches.push({
                        featureId,
                        position: featureStart + mm.start,
                        base: baseToNum(mm.base),
                      })
                    } else if (mm.type === 'insertion') {
                      insertions.push({
                        featureId,
                        position: featureStart + mm.start,
                      })
                    }
                  }
                }
              },
              error: reject,
              complete: resolve,
            })
          })

          self.webglFeatures = features
          self.webglGaps = gaps
          self.webglMismatches = mismatches
          self.webglInsertions = insertions
          self.loadedRegion = {
            refName: region.refName,
            start: region.start,
            end: region.end,
          }
          self.computeCoverage()
          self.isLoading = false
        } catch (e) {
          self.error = e as Error
          self.isLoading = false
        }
      }),

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

        this.fetchFeatures(expandedRegion)
      },
    }))
    .actions(self => ({
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
                console.log('[model reaction] visibleRegion changed, loading:', {
                  visibleRegion: { start: region.start.toFixed(0), end: region.end.toFixed(0) },
                  expandedRegion: { start: expandedRegion.start.toFixed(0), end: expandedRegion.end.toFixed(0) },
                  usingCurrentDomainX: !!self.currentDomainX,
                  currentDomainX: self.currentDomainX ? [self.currentDomainX[0].toFixed(0), self.currentDomainX[1].toFixed(0)] : null,
                })
                self.fetchFeatures(expandedRegion)
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
              if (self.visibleRegion) {
                self.fetchFeatures(self.visibleRegion)
              }
            },
          ),
        )
      },
    }))
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
        ]
      },
    }))
}

export type LinearWebGLPileupDisplayStateModel = ReturnType<
  typeof stateModelFactory
>
export type LinearWebGLPileupDisplayModel = Instance<
  LinearWebGLPileupDisplayStateModel
>
