import { getConf, ConfigurationReference } from '@jbrowse/core/configuration'
import { types } from 'mobx-state-tree'
import baseModelFactory from '../LinearComparativeDisplay/stateModelFactory'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { Feature } from '@jbrowse/core/util'

// locals
import type { Instance } from 'mobx-state-tree'

interface Pos {
  offsetPx: number
}

export interface FeatPos {
  p11: Pos
  p12: Pos
  p21: Pos
  p22: Pos
  f: Feature
  cigar: string[]
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
      }),
    )
    .volatile(() => ({
      /**
       * #volatile
       * canvas used for drawing visible screen
       */
      mainCanvas: null as HTMLCanvasElement | null,

      /**
       * #volatile
       * canvas used for drawing click map with feature ids this renders a
       * unique color per alignment, so that it can be re-traced after a
       * feature click with getImageData at that pixel
       */
      clickMapCanvas: null as HTMLCanvasElement | null,

      /**
       * #volatile
       * canvas used for drawing click map with cigar data this can show if you
       * are mousing over a insertion/deletion. it is similar in purpose to the
       * clickMapRef but was not feasible to pack this into the clickMapRef
       */
      cigarClickMapCanvas: null as HTMLCanvasElement | null,

      /**
       * #volatile
       * canvas for drawing mouseover shading this is separate from the other
       * code for speed: don't have to redraw entire canvas to do a feature's
       * mouseover shading
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
       * currently mouseover'd CIGAR subfeature
       */
      cigarMouseoverId: -1,
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
      setMainCanvasRef(ref: HTMLCanvasElement | null) {
        self.mainCanvas = ref
      },
      /**
       * #action
       */
      setClickMapCanvasRef(ref: HTMLCanvasElement | null) {
        self.clickMapCanvas = ref
      },
      /**
       * #action
       */
      setCigarClickMapCanvasRef(ref: HTMLCanvasElement | null) {
        self.cigarClickMapCanvas = ref
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
      setCigarMouseoverId(arg: number) {
        self.cigarMouseoverId = arg
      },
      /**
       * #action
       */
      setClickId(arg?: string) {
        self.clickId = arg
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
        return Object.fromEntries(self.featPositions.map(f => [f.f.id(), f]))
      },
    }))
    .actions(self => ({
      afterAttach() {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        ;(async () => {
          try {
            const { doAfterAttach } = await import('./afterAttach')
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
