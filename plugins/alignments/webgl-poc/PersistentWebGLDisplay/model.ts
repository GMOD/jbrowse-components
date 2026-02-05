/**
 * WebGLPileupDisplay model
 *
 * This display model:
 * - Manages feature data fetching (via adapter)
 * - Tracks loaded region vs visible region
 * - Handles color scheme and display settings
 * - Coordinates with WebGL component for rendering
 *
 * Key difference from standard displays:
 * - Does NOT use ServerSideRenderedBlock
 * - Manages its own WebGL rendering component
 * - View changes update WebGL uniforms directly, not through re-render
 */

import { getContainingView } from '@jbrowse/core/util'
import { BaseLinearDisplay } from '@jbrowse/plugin-linear-genome-view'
import { reaction } from 'mobx'
import { addDisposer, getParent, types } from 'mobx-state-tree'

import type { FeatureData } from './WebGLRenderer'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import type { Instance } from 'mobx-state-tree'

// Simplified config schema
export function configSchemaFactory(pluginManager: any) {
  return types.compose(
    'WebGLPileupDisplayConfig',
    pluginManager.pluggableConfigSchemaType('display'),
    types.model({
      type: types.literal('WebGLPileupDisplay'),
      featureHeight: types.optional(types.number, 7),
      featureSpacing: types.optional(types.number, 1),
      maxHeight: types.optional(types.number, 1200),
    }),
  )
}

// Color scheme enum
export const ColorScheme = {
  strand: 0,
  mappingQuality: 1,
  insertSize: 2,
  firstOfPairStrand: 3,
}

export function stateModelFactory(
  pluginManager: any,
  configSchema: AnyConfigurationSchemaType,
) {
  return types
    .compose(
      'WebGLPileupDisplay',
      BaseLinearDisplay,
      types.model({
        type: types.literal('WebGLPileupDisplay'),
        configuration: configSchema,

        // Display settings (observable - changes trigger reactions)
        colorScheme: types.optional(types.number, ColorScheme.strand),
        showMismatches: types.optional(types.boolean, true),
      }),
    )
    .volatile(() => ({
      // Feature data
      features: [] as FeatureData[],
      loadedRegion: null as {
        refName: string
        start: number
        end: number
      } | null,
      isLoading: false,
      error: null as Error | null,

      // Reference to the WebGL component
      webglRef: null as any,

      // Last fetched region (to avoid duplicate fetches)
      lastFetchKey: '',
    }))
    .views(self => ({
      get rendererTypeName() {
        return 'WebGLPileupRenderer' // Not actually used, but required by base
      },

      /**
       * Get the current visible domain from the parent view
       */
      get visibleDomain(): [number, number] {
        const view = getContainingView(self) as LinearGenomeViewModel
        const region = view.dynamicBlocks.contentBlocks[0]
        if (!region) {
          return [0, 10000]
        }
        return [region.start, region.end]
      },

      /**
       * Get the current reference name
       */
      get visibleRefName(): string {
        const view = getContainingView(self) as LinearGenomeViewModel
        const region = view.dynamicBlocks.contentBlocks[0]
        return region?.refName ?? ''
      },

      /**
       * Check if current view is within the loaded data range
       */
      get isWithinLoadedRegion(): boolean {
        if (!self.loadedRegion) {
          return false
        }
        const [start, end] = this.visibleDomain
        return (
          self.loadedRegion.refName === this.visibleRefName &&
          start >= self.loadedRegion.start &&
          end <= self.loadedRegion.end
        )
      },

      /**
       * Calculate the region to fetch (expanded beyond visible)
       */
      get fetchRegion() {
        const [start, end] = this.visibleDomain
        const width = end - start
        const expandFactor = 3 // Fetch 3x the visible region
        return {
          refName: this.visibleRefName,
          start: Math.max(0, Math.floor(start - width * expandFactor)),
          end: Math.ceil(end + width * expandFactor),
        }
      },

      get featureHeight() {
        return self.configuration.featureHeight ?? 7
      },

      get featureSpacing() {
        return self.configuration.featureSpacing ?? 1
      },
    }))
    .actions(self => ({
      setColorScheme(scheme: number) {
        self.colorScheme = scheme
        // The WebGL component will pick this up via props
      },

      setShowMismatches(show: boolean) {
        self.showMismatches = show
      },

      setWebGLRef(ref: any) {
        self.webglRef = ref
      },

      setFeatures(features: FeatureData[]) {
        self.features = features
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

      /**
       * Fetch features for a region
       */
      async fetchFeatures(region: {
        refName: string
        start: number
        end: number
      }) {
        const fetchKey = `${region.refName}:${region.start}-${region.end}`
        if (fetchKey === self.lastFetchKey) {
          return
        }
        self.lastFetchKey = fetchKey

        self.isLoading = true
        self.error = null

        try {
          // Get adapter from track
          const track = getParent(self, 2) as any
          const adapter = track?.adapter

          if (!adapter) {
            throw new Error('No adapter found')
          }

          // Fetch features
          const featureObservable = adapter.getFeatures({
            refName: region.refName,
            start: region.start,
            end: region.end,
            assemblyName: track.assemblyNames?.[0],
          })

          // Collect features from observable
          const features: FeatureData[] = []
          await new Promise<void>((resolve, reject) => {
            featureObservable.subscribe({
              next(feature: any) {
                features.push({
                  id: feature.id(),
                  start: feature.get('start'),
                  end: feature.get('end'),
                  strand: feature.get('strand') ?? 1,
                  flags: feature.get('flags') ?? 0,
                  mapq: feature.get('score') ?? feature.get('qual') ?? 60,
                  insertSize: Math.abs(feature.get('template_length') ?? 400),
                  mismatches: feature.get('mismatches'),
                  deletions: feature
                    .get('mismatches')
                    ?.filter((m: any) => m.type === 'deletion')
                    .map((m: any) => ({ start: m.start, length: m.length })),
                })
              },
              error: reject,
              complete: resolve,
            })
          })

          self.features = features
          self.loadedRegion = region
          self.isLoading = false
        } catch (e) {
          self.error = e as Error
          self.isLoading = false
          console.error('Failed to fetch features:', e)
        }
      },

      /**
       * Handle request for more data from WebGL component
       */
      handleNeedMoreData(region: { start: number; end: number }) {
        const refName = self.visibleRefName
        if (!refName) {
          return
        }

        this.fetchFeatures({
          refName,
          start: region.start,
          end: region.end,
        }).catch(e => {
          console.error('Failed to fetch features:', e)
        })
      },

      afterAttach() {
        // Set up reaction to fetch data when view changes significantly
        addDisposer(
          self,
          reaction(
            () => ({
              refName: self.visibleRefName,
              domain: self.visibleDomain,
              isWithin: self.isWithinLoadedRegion,
            }),
            ({ refName, isWithin }) => {
              // Only fetch if we're outside the loaded region
              if (!isWithin && refName) {
                this.fetchFeatures(self.fetchRegion).catch(e => {
                  console.error('Failed to fetch features:', e)
                })
              }
            },
            {
              delay: 300, // Debounce
              fireImmediately: true,
            },
          ),
        )
      },
    }))
    .views(() => ({
      /**
       * Custom rendering component (not using standard block rendering)
       */
      get RenderingComponent() {
        // This will be imported and used by the display
        return null // Will be set up in the plugin registration
      },
    }))
}

export type WebGLPileupDisplayStateModel = ReturnType<typeof stateModelFactory>
export type WebGLPileupDisplayModel = Instance<WebGLPileupDisplayStateModel>
