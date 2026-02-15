import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

import { applyAlpha, colorSchemes, getQueryColor } from './drawSyntenyUtils.ts'
import baseModelFactory from '../LinearComparativeDisplay/stateModelFactory.ts'

import type { ColorScheme } from './drawSyntenyUtils.ts'
import type { SyntenyWebGLRenderer } from './drawSyntenyWebGL.ts'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { Instance } from '@jbrowse/mobx-state-tree'

interface Pos {
  offsetPx: number
}

export interface FeatPos {
  p11: Pos
  p12: Pos
  p21: Pos
  p22: Pos
  padTop: number
  padBottom: number
  id: string
  strand: number
  name: string
  refName: string
  start: number
  end: number
  assemblyName: string
  mate: { start: number; end: number; refName: string; name: string; assemblyName: string }
  cigar: string[]
  identity?: number
}

/**
 * #stateModel LinearSyntenyDisplay
 * extends
 * - [LinearComparativeDisplay](../linearcomparativedisplay)
 */
function stateModelFactory(configSchema: AnyConfigurationSchemaType) {
  return types
    .compose(
      'LinearSyntenyDisplay',
      baseModelFactory(configSchema),
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
       * assigned by reaction
       */
      featPositions: [] as FeatPos[],

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
      setFeatPositions(arg: FeatPos[]) {
        self.featPositions = arg
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
        return self.featPositions.length
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
       */
      get featMap() {
        return Object.fromEntries(self.featPositions.map(f => [f.id, f]))
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
        if (self.minAlignmentLength <= 0) {
          return undefined
        }
        const lengths = new Map<string, number>()
        for (const feat of self.featPositions) {
          const queryName = feat.name || feat.id
          const alignmentLength = Math.abs(feat.end - feat.start)
          const currentTotal = lengths.get(queryName) || 0
          lengths.set(queryName, currentTotal + alignmentLength)
        }
        return lengths
      },
    }))
    .actions(self => ({
      afterAttach() {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        ;(async () => {
          try {
            const { doAfterAttach } = await import('./afterAttach.ts')
            doAfterAttach(self)
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
