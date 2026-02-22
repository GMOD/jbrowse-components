import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import { getParent, types } from '@jbrowse/mobx-state-tree'
import { parseCigar2 } from '@jbrowse/plugin-alignments'

import { applyAlpha, colorSchemes, getQueryColor } from './drawSyntenyUtils.ts'

import type { SyntenyRenderer } from './SyntenyRenderer.ts'
import type { ColorScheme } from './drawSyntenyUtils.ts'
import type { SyntenyInstanceData } from '../LinearSyntenyRPC/executeSyntenyInstanceData.ts'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { Instance } from '@jbrowse/mobx-state-tree'

export interface SyntenyFeatureData {
  p11_offsetPx: Float64Array
  p12_offsetPx: Float64Array
  p21_offsetPx: Float64Array
  p22_offsetPx: Float64Array
  strands: Int8Array
  starts: Float64Array
  ends: Float64Array
  identities: Float64Array
  padTop: Float64Array
  padBottom: Float64Array
  featureIds: string[]
  names: string[]
  refNames: string[]
  assemblyNames: string[]
  cigars: string[]
  mates: {
    start: number
    end: number
    refName: string
    name: string
    assemblyName: string
  }[]
}

export interface FeatPos {
  id: string
  strand: number
  name: string
  refName: string
  start: number
  end: number
  assemblyName: string
  mate: {
    start: number
    end: number
    refName: string
    name: string
    assemblyName: string
  }
  identity?: number
}

export function getFeatureAtIndex(
  data: SyntenyFeatureData,
  i: number,
): FeatPos {
  const identity = data.identities[i]!
  return {
    id: data.featureIds[i]!,
    strand: data.strands[i]!,
    name: data.names[i]!,
    refName: data.refNames[i]!,
    start: data.starts[i]!,
    end: data.ends[i]!,
    assemblyName: data.assemblyNames[i]!,
    mate: data.mates[i]!,
    identity: identity === -1 ? undefined : identity,
  }
}

/**
 * #stateModel LinearSyntenyDisplay
 * extends
 * - [BaseDisplay](../basedisplay)
 */
function stateModelFactory(configSchema: AnyConfigurationSchemaType) {
  return types
    .compose(
      'LinearSyntenyDisplay',
      BaseDisplay,
      types.model({
        /**
         * #property
         */
        type: types.literal('LinearSyntenyDisplay'),
        /**
         * #property
         */
        configuration: ConfigurationReference(configSchema),
        /**
         * #property
         * color scheme to use for rendering synteny features
         */
        colorBy: types.optional(types.string, 'default'),
        /**
         * #property
         * alpha transparency value for synteny drawing (0-1)
         */
        alpha: types.optional(types.number, 0.2),
        /**
         * #property
         * minimum alignment length to display (in bp)
         */
        minAlignmentLength: types.optional(types.number, 0),
      }),
    )
    .volatile(() => ({
      /**
       * #volatile
       */
      featureData: undefined as SyntenyFeatureData | undefined,

      /**
       * #volatile
       */
      mouseoverId: undefined as string | undefined,

      hoveredFeatureIdx: -1,

      clickedFeatureIdx: -1,

      /**
       * #volatile
       */
      gpuInstanceData: undefined as SyntenyInstanceData | undefined,

      /**
       * #volatile
       */
      gpuRenderer: null as SyntenyRenderer | null,

      /**
       * #volatile
       */
      gpuInitialized: false,

      /**
       * #volatile
       */
      isScrolling: false,
    }))
    .actions(self => ({
      /**
       * #action
       */
      setFeatureData(arg: SyntenyFeatureData | undefined) {
        self.featureData = arg
      },
      /**
       * #action
       */
      setMouseoverId(arg?: string) {
        self.mouseoverId = arg
      },
      setHoveredFeatureIdx(idx: number) {
        self.hoveredFeatureIdx = idx
      },
      setClickedFeatureIdx(idx: number) {
        self.clickedFeatureIdx = idx
      },
      /**
       * #action
       */
      setAlpha(value: number) {
        self.alpha = value
      },
      /**
       * #action
       */
      setMinAlignmentLength(value: number) {
        self.minAlignmentLength = value
      },
      /**
       * #action
       */
      setColorBy(value: string) {
        self.colorBy = value
      },
      /**
       * #action
       */
      setGpuInstanceData(data: SyntenyInstanceData | undefined) {
        self.gpuInstanceData = data
      },
      /**
       * #action
       */
      setGpuRenderer(renderer: SyntenyRenderer | null) {
        self.gpuRenderer = renderer
      },
      /**
       * #action
       */
      setGpuInitialized(value: boolean) {
        self.gpuInitialized = value
      },
      /**
       * #action
       */
      setIsScrolling(value: boolean) {
        self.isScrolling = value
      },
    }))

    .views(self => ({
      /**
       * #getter
       */
      get level() {
        return getParent<{ height: number; level: number }>(self, 4).level
      },
      /**
       * #getter
       */
      get height() {
        return getParent<{ height: number; level: number }>(self, 4).height
      },
      /**
       * #getter
       */
      get adapterConfig() {
        return {
          name: self.parentTrack.configuration.adapter.type,
          assemblyNames: getConf(self, 'assemblyNames'),
          ...getConf(self.parentTrack, 'adapter'),
        }
      },

      /**
       * #getter
       */
      get trackIds() {
        return getConf(self, 'trackIds') as string[]
      },

      /**
       * #getter
       */
      get numFeats() {
        return self.featureData?.featureIds.length ?? 0
      },

      get parsedCigars() {
        return self.featureData?.cigars.map(s => (s ? parseCigar2(s) : []))
      },

      /**
       * #getter
       * used for synteny svg rendering
       */
      get ready() {
        return this.numFeats > 0
      },

      /**
       * #getter
       * cached color scheme config based on colorBy
       */
      get colorSchemeConfig() {
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        return colorSchemes[self.colorBy as ColorScheme] || colorSchemes.default
      },

      /**
       * #getter
       * cached CIGAR colors with alpha applied
       */
      get colorMapWithAlpha() {
        const { alpha } = self
        const activeColorMap = this.colorSchemeConfig.cigarColors
        return {
          I: applyAlpha(activeColorMap.I, alpha),
          N: applyAlpha(activeColorMap.N, alpha),
          D: applyAlpha(activeColorMap.D, alpha),
          X: applyAlpha(activeColorMap.X, alpha),
          M: applyAlpha(activeColorMap.M, alpha),
          '=': applyAlpha(activeColorMap['='], alpha),
        }
      },

      /**
       * #getter
       * cached positive strand color with alpha
       */
      get posColorWithAlpha() {
        const posColor =
          self.colorBy === 'strand' ? colorSchemes.strand.posColor : 'red'
        return applyAlpha(posColor, self.alpha)
      },

      /**
       * #getter
       * cached negative strand color with alpha
       */
      get negColorWithAlpha() {
        const negColor =
          self.colorBy === 'strand' ? colorSchemes.strand.negColor : 'blue'
        return applyAlpha(negColor, self.alpha)
      },

      /**
       * #getter
       * cached query colors with alpha - returns a function that caches results
       */
      get queryColorWithAlphaMap() {
        const { alpha } = self
        const cache = new Map<string, string>()
        return (queryName: string) => {
          if (!cache.has(queryName)) {
            const color = getQueryColor(queryName)
            cache.set(queryName, applyAlpha(color, alpha))
          }
          return cache.get(queryName)!
        }
      },

      /**
       * #getter
       * cached query total lengths for minAlignmentLength filtering
       */
      get queryTotalLengths() {
        const { featureData } = self
        if (self.minAlignmentLength <= 0 || !featureData) {
          return undefined
        }
        const lengths = new Map<string, number>()
        for (let i = 0; i < featureData.featureIds.length; i++) {
          const queryName = featureData.names[i] || featureData.featureIds[i]!
          const alignmentLength = Math.abs(
            featureData.ends[i]! - featureData.starts[i]!,
          )
          const currentTotal = lengths.get(queryName) || 0
          lengths.set(queryName, currentTotal + alignmentLength)
        }
        return lengths
      },

      getFeature(index: number) {
        if (!self.featureData) {
          return undefined
        }
        return getFeatureAtIndex(self.featureData, index)
      },
    }))
    .actions(self => ({
      afterAttach() {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        ;(async () => {
          try {
            const { doAfterAttach } = await import('./afterAttach.ts')
            doAfterAttach(self as typeof self & { afterAttach(): void })
          } catch (e) {
            console.error(e)
            self.setError(e)
          }
        })()
      },
    }))
}

export type LinearSyntenyDisplayStateModel = ReturnType<
  typeof stateModelFactory
>
export type LinearSyntenyDisplayModel = Instance<LinearSyntenyDisplayStateModel>

export default stateModelFactory
