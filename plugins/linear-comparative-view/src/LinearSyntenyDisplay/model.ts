import { types, addDisposer, getSnapshot, Instance } from 'mobx-state-tree'
import {
  getConf,
  ConfigurationReference,
  AnyConfigurationSchemaType,
} from '@jbrowse/core/configuration'
import { Feature, getContainingView, getSession } from '@jbrowse/core/util'
import { bpToPx } from '@jbrowse/core/util/Base1DUtils'
import { MismatchParser } from '@jbrowse/plugin-alignments'
import { reaction, autorun } from 'mobx'

// locals
import baseModelFactory from '../LinearComparativeDisplay/stateModelFactory'
import { LinearSyntenyViewModel } from '../LinearSyntenyView/model'
import { drawMouseoverSynteny, drawRef } from './drawSynteny'

interface Pos {
  offsetPx: number
}

interface FeatPos {
  p11: Pos
  p12: Pos
  p21: Pos
  p22: Pos
  f: Feature
  cigar: string[]
}

type LSV = LinearSyntenyViewModel
/**
 * #stateModel LinearSyntenyDisplay
 * extends `LinearComparativeDisplay` model
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
      // canvas used for drawing visible screen
      mainCanvas: null as HTMLCanvasElement | null,

      // canvas used for drawing click map with feature ids
      // this renders a unique color per alignment, so that it can be re-traced
      // after a feature click with getImageData at that pixel
      clickMapCanvas: null as HTMLCanvasElement | null,

      // canvas used for drawing click map with cigar data
      // this can show if you are mousing over a insertion/deletion. it is similar
      // in purpose to the clickMapRef but was not feasible to pack this into the
      // clickMapRef
      cigarClickMapCanvas: null as HTMLCanvasElement | null,

      // canvas for drawing mouseover shading
      // this is separate from the other code for speed: don't have to redraw
      // entire canvas to do a feature's mouseover shading
      mouseoverCanvas: null as HTMLCanvasElement | null,

      // assigned by reaction
      featPositions: [] as FeatPos[],

      // currently mouse'd over feature
      mouseoverId: undefined as string | undefined,

      // currently click'd over feature
      clickId: undefined as string | undefined,

      // currently mouseover'd CIGAR subfeature
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
        addDisposer(
          self,
          autorun(() => {
            const view = getContainingView(self)
            if (!view.initialized) {
              return
            }
            const ctx1 = self.mainCanvas?.getContext('2d')
            const ctx3 = self.cigarClickMapCanvas?.getContext('2d')
            if (!ctx1 || !ctx3) {
              return
            }

            const height = view.middleComparativeHeight
            const width = view.width
            ctx1.clearRect(0, 0, width, height)
            ctx3.clearRect(0, 0, width, height)
            drawRef(self, ctx1, ctx3)
          }),
        )

        addDisposer(
          self,
          autorun(() => {
            const view = getContainingView(self)
            if (!view.initialized) {
              return
            }
            if (self.mouseoverId || self.clickId) {
              drawMouseoverSynteny(self)
            }
          }),
        )

        // this attempts to reduce recalculation of feature positions drawn by
        // the synteny view
        //
        // uses a reaction to say "we know the positions don't change in any
        // relevant way unless bpPerPx changes or displayedRegions changes"
        addDisposer(
          self,
          reaction(
            () => {
              const view = getContainingView(self) as LSV
              return {
                bpPerPx: view.views.map(v => v.bpPerPx),

                // stringifying 'deeply' accesses the displayed regions, see
                // issue #3456
                displayedRegions: JSON.stringify(
                  view.views.map(v => v.displayedRegions),
                ),
                features: self.features,
                initialized: view.initialized,
              }
            },
            ({ initialized }) => {
              if (!initialized) {
                return
              }
              const { assemblyManager } = getSession(self)
              const view = getContainingView(self) as LSV
              const viewSnaps = view.views.map(view => ({
                ...getSnapshot(view),
                width: view.width,
                staticBlocks: view.staticBlocks,
                interRegionPaddingWidth: view.interRegionPaddingWidth,
                minimumBlockWidth: view.minimumBlockWidth,
              }))

              const map = [] as FeatPos[]
              const feats = self.features || []

              for (let i = 0; i < feats.length; i++) {
                const f = feats[i]
                const mate = f.get('mate')
                let f1s = f.get('start')
                let f1e = f.get('end')
                const f2s = mate.start
                const f2e = mate.end

                if (f.get('strand') === -1) {
                  ;[f1e, f1s] = [f1s, f1e]
                }
                const a1 = assemblyManager?.get(f.get('assemblyName'))
                const a2 = assemblyManager?.get(mate.assemblyName)
                const r1 = f.get('refName')
                const r2 = mate.refName
                const ref1 = a1?.getCanonicalRefName(r1) || r1
                const ref2 = a2?.getCanonicalRefName(r2) || r2
                const v1 = viewSnaps[0]
                const v2 = viewSnaps[1]
                const p11 = bpToPx({ self: v1, refName: ref1, coord: f1s })
                const p12 = bpToPx({ self: v1, refName: ref1, coord: f1e })
                const p21 = bpToPx({ self: v2, refName: ref2, coord: f2s })
                const p22 = bpToPx({ self: v2, refName: ref2, coord: f2e })

                if (
                  p11 === undefined ||
                  p12 === undefined ||
                  p21 === undefined ||
                  p22 === undefined
                ) {
                  continue
                }

                const cigar = f.get('CIGAR') as string | undefined
                map.push({
                  p11,
                  p12,
                  p21,
                  p22,
                  f,
                  cigar: MismatchParser.parseCigar(cigar),
                })
              }

              self.setFeatPositions(map)
            },
            { fireImmediately: true },
          ),
        )
      },
    }))
}

export type LinearSyntenyDisplayStateModel = ReturnType<
  typeof stateModelFactory
>
export type LinearSyntenyDisplayModel = Instance<LinearSyntenyDisplayStateModel>

export default stateModelFactory
