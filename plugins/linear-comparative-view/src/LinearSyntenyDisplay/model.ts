import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import { getParent, types } from '@jbrowse/mobx-state-tree'

import { applyAlpha, colorSchemes, getQueryColor } from './drawSyntenyUtils.ts'

import type { ColorScheme } from './drawSyntenyUtils.ts'
import type { SyntenyWebGLRenderer } from './drawSyntenyWebGL.ts'
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
  p11: { offsetPx: number }
  p12: { offsetPx: number }
  p21: { offsetPx: number }
  p22: { offsetPx: number }
  padTop: number
  padBottom: number
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
    p11: { offsetPx: data.p11_offsetPx[i]! },
    p12: { offsetPx: data.p12_offsetPx[i]! },
    p21: { offsetPx: data.p21_offsetPx[i]! },
    p22: { offsetPx: data.p22_offsetPx[i]! },
    padTop: data.padTop[i]!,
    padBottom: data.padBottom[i]!,
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
       * canvas for drawing mouseover shading
       */
      mouseoverCanvas: null as HTMLCanvasElement | null,

      /**
       * #volatile
       * lightweight store of raw RPC arrays, avoids creating per-feature objects
       */
      featureData: undefined as SyntenyFeatureData | undefined,

      /**
       * #volatile
       * currently mouse'd over feature
       */
      mouseoverId: undefined as string | undefined,

      /**
       * #volatile
       * currently click'd over feature
       */
      clickId: undefined as string | undefined,

      /**
       * #volatile
       */
      webglInstanceData: undefined as SyntenyInstanceData | undefined,

      /**
       * #volatile
       */
      webglRenderer: null as SyntenyWebGLRenderer | null,

      /**
       * #volatile
       */
      webglInitialized: false,

      /**
       * #volatile
       * set during scroll to use straight-line rendering for performance
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
      setMouseoverCanvasRef(ref: HTMLCanvasElement | null) {
        self.mouseoverCanvas = ref
      },
      /**
       * #action
       */
      setMouseoverId(arg?: string) {
        self.mouseoverId = arg
      },
      /**
       * #action
       */
      setClickId(arg?: string) {
        self.clickId = arg
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
      setWebglInstanceData(data: SyntenyInstanceData | undefined) {
        self.webglInstanceData = data
      },
      /**
       * #action
       */
      setWebGLRenderer(renderer: SyntenyWebGLRenderer | null) {
        self.webglRenderer = renderer
      },
      /**
       * #action
       */
      setWebGLInitialized(value: boolean) {
        self.webglInitialized = value
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
