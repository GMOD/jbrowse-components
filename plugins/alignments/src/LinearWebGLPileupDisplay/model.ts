import { lazy } from 'react'
import {
  ConfigurationReference,
  getConf,
  readConfObject,
} from '@jbrowse/core/configuration'
import {
  getContainingTrack,
  getContainingView,
  getSession,
} from '@jbrowse/core/util'
import { cast, types, addDisposer, Instance } from '@jbrowse/mobx-state-tree'
import { BaseLinearDisplay } from '@jbrowse/plugin-linear-genome-view'
import { autorun, reaction } from 'mobx'

import type { ColorBy, FilterBy } from '../shared/types'
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
  mismatches?: Array<{ start: number; base: string; type: string }>
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
        showMismatches: types.optional(types.boolean, true),
      }),
    )
    .volatile(() => ({
      // Feature data loaded from adapter (named to avoid conflict with base)
      webglFeatures: [] as FeatureData[],
      // Region that's currently loaded in GPU
      loadedRegion: null as {
        refName: string
        start: number
        end: number
      } | null,
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
       */
      get visibleRegion() {
        try {
          const view = getContainingView(self) as LGV
          // Check if view is initialized before accessing properties
          if (!view?.initialized) {
            return null
          }
          const blocks = view.dynamicBlocks?.contentBlocks
          if (!blocks || blocks.length === 0) {
            return null
          }
          const first = blocks[0]
          const last = blocks[blocks.length - 1]
          return {
            refName: first.refName,
            start: first.start,
            end: last.end,
            assemblyName: first.assemblyName,
          }
        } catch {
          // View may not be ready yet
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

      toggleMismatches() {
        self.showMismatches = !self.showMismatches
      },

      /**
       * Fetch features for a region from the adapter
       */
      async fetchFeatures(region: {
        refName: string
        start: number
        end: number
        assemblyName?: string
      }) {
        const track = getContainingTrack(self)
        const adapter = (track as any)?.adapter
        if (!adapter) {
          return
        }

        self.isLoading = true
        self.error = null

        try {
          const featureObservable = adapter.getFeatures({
            refName: region.refName,
            start: region.start,
            end: region.end,
            assemblyName: region.assemblyName,
          })

          const features: FeatureData[] = []

          await new Promise<void>((resolve, reject) => {
            featureObservable.subscribe({
              next(feature: Feature) {
                const mismatches = feature.get('mismatches') as
                  | Array<{ start: number; base: string; type: string }>
                  | undefined

                features.push({
                  id: feature.id(),
                  start: feature.get('start'),
                  end: feature.get('end'),
                  strand: feature.get('strand') ?? 1,
                  flags: feature.get('flags') ?? 0,
                  mapq: feature.get('score') ?? feature.get('qual') ?? 60,
                  insertSize: Math.abs(
                    feature.get('template_length') ?? 400,
                  ),
                  mismatches: mismatches?.filter(m => m.type === 'mismatch'),
                })
              },
              error: reject,
              complete: resolve,
            })
          })

          self.webglFeatures = features
          self.loadedRegion = {
            refName: region.refName,
            start: region.start,
            end: region.end,
          }
          self.isLoading = false
        } catch (e) {
          self.error = e as Error
          self.isLoading = false
          console.error('Failed to fetch features:', e)
        }
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
                self.fetchFeatures(expandedRegion)
              }
            },
            { delay: 300 },
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
            label: 'Show mismatches',
            type: 'checkbox' as const,
            checked: self.showMismatches,
            onClick: () => self.toggleMismatches(),
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
