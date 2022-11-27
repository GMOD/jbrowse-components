import React, { lazy } from 'react'
import clone from 'clone'
import { autorun } from 'mobx'
import {
  addDisposer,
  cast,
  getSnapshot,
  types,
  Instance,
} from 'mobx-state-tree'
import {
  ConfigurationReference,
  ConfigurationSchema,
  getConf,
} from '@jbrowse/core/configuration'
import {
  getEnv,
  getSession,
  getContainingView,
  getContainingTrack,
} from '@jbrowse/core/util'

import {
  LinearGenomeViewModel,
  BaseLinearDisplay,
} from '@jbrowse/plugin-linear-genome-view'

// icons
import MenuOpenIcon from '@mui/icons-material/MenuOpen'
import FilterListIcon from '@mui/icons-material/ClearAll'

// locals
import { LinearAlignmentsArcsDisplayConfigModel } from './configSchema'

// async
const FilterByTagDlg = lazy(() => import('./components/FilterByTag'))
const SetMaxHeightDlg = lazy(() => import('./components/SetMaxHeight'))

type LGV = LinearGenomeViewModel

interface Filter {
  flagInclude: number
  flagExclude: number
  readName?: string
  tagFilter?: { tag: string; value: string }
}
interface ReducedFeature {
  name: string
  refName: string
  start: number
  end: number
  id: string
  flags: number
}

type ArcMap = { [key: string]: ReducedFeature[] }

/**
 * #stateModel LinearAlignmentsArcsDisplay
 * extends `BaseLinearDisplay`
 */
function stateModelFactory(
  configSchema: LinearAlignmentsArcsDisplayConfigModel,
) {
  return types
    .compose(
      'LinearAlignmentsArcsDisplay',
      BaseLinearDisplay,
      types.model({
        /**
         * #property
         */
        type: types.literal('LinearAlignmentsArcsDisplay'),
        /**
         * #property
         */
        configuration: ConfigurationReference(configSchema),

        /**
         * #property
         */
        trackMaxHeight: types.maybe(types.number),

        /**
         * #property
         */
        filterBy: types.optional(
          types.model({
            flagInclude: types.optional(types.number, 0),
            flagExclude: types.optional(types.number, 1540),
            readName: types.maybe(types.string),
            tagFilter: types.maybe(
              types.model({ tag: types.string, value: types.string }),
            ),
          }),
          {},
        ),
      }),
    )
    .volatile(() => ({
      arcFeatures: undefined as ArcMap | undefined,
      ref: null as HTMLCanvasElement | null,
    }))
    .actions(self => ({
      /**
       * #action
       */
      setMaxHeight(n: number) {
        self.trackMaxHeight = n
      },

      /**
       * #action
       */
      setRef(ref: HTMLCanvasElement | null) {
        self.ref = ref
      },

      /**
       * #action
       */
      setArcFeatures(f: ArcMap) {
        self.arcFeatures = f
      },
    }))
    .actions(self => ({
      afterAttach() {
        addDisposer(
          self,
          autorun(
            async () => {
              try {
                const { rpcSessionId: sessionId } = getContainingTrack(self)
                const { rpcManager } = getSession(self)
                const view = getContainingView(self) as LGV

                if (!view.initialized) {
                  return
                }

                const ret = (await rpcManager.call(
                  sessionId,
                  'PileupGetFeatures',
                  {
                    sessionId,
                    regions: view.staticBlocks.contentBlocks,
                    adapterConfig: self.adapterConfig,
                  },
                )) as ArcMap
                self.setArcFeatures(ret)
              } catch (e) {
                console.error(e)
                self.setError(e)
              }
            },
            { delay: 1000 },
          ),
        )

        const height = 1200
        addDisposer(
          self,
          autorun(
            async () => {
              try {
                if (!self.arcFeatures) {
                  return
                }
                const view = getContainingView(self) as LGV
                const canvas = self.ref
                if (!canvas) {
                  return
                }
                const width = canvas.getBoundingClientRect().width * 2
                const ctx = canvas.getContext('2d')
                if (!ctx) {
                  return
                }
                canvas.width = width
                ctx.clearRect(0, 0, width, height)
                ctx.scale(2, 2)

                Object.values(self.arcFeatures)
                  .filter(val => val.length === 2)
                  .forEach(val => {
                    const [v0, v1] = val
                    const sameRef = v0.refName === v1.refName
                    if (sameRef) {
                      const s = Math.min(v0.start, v1.start)
                      const e = Math.max(v0.end, v1.end)
                      const r1 = view.bpToPx({ refName: v0.refName, coord: s })
                      const r2 = view.bpToPx({ refName: v0.refName, coord: e })

                      if (!r1 || !r2) {
                        return
                      }
                      const radius = (r2.offsetPx - r1.offsetPx) / 2
                      const absrad = Math.abs(radius)
                      const p = r1.offsetPx - view.offsetPx
                      ctx.moveTo(p, 0)
                      ctx.beginPath()
                      ctx.strokeStyle = `hsl(${
                        Math.log10(Math.abs(e - s)) * 10
                      },50%,50%)`
                      ctx.arc(p + radius, 0, absrad, 0, Math.PI)
                      ctx.stroke()
                    }
                  })
              } catch (e) {
                console.error(e)
                self.setError(e)
              }
            },
            { delay: 1000 },
          ),
        )
      },

      /**
       * #action
       */
      setFilterBy(filter: Filter) {
        self.filterBy = cast(filter)
      },

      /**
       * #action
       */
      renderSvg() {
        return <></>
      },
    }))

    .views(self => {
      const {
        trackMenuItems: superTrackMenuItems,
        renderProps: superRenderProps,
      } = self

      return {
        get rendererTypeName() {
          return 'PileupRenderer'
        },

        renderProps(): any {
          return {
            ...superRenderProps(),
            config: ConfigurationSchema('empty', {}).create(),
          }
        },
        /**
         * #method
         */
        contextMenuItems() {
          const feat = self.contextMenuFeature
          return feat
            ? [
                {
                  label: 'Open feature details',
                  icon: MenuOpenIcon,
                  onClick: () => {
                    self.clearFeatureSelection()
                    if (feat) {
                      self.selectFeature(feat)
                    }
                  },
                },
              ]
            : []
        },

        /**
         * #method
         */
        renderProps() {
          const { filterBy, rpcDriverName } = self
          const superProps = superRenderProps()
          return {
            ...superProps,
            notReady: superProps.notReady,
            rpcDriverName,
            displayModel: getSnapshot(self),
            filterBy: clone(filterBy),
          }
        },

        /**
         * #method
         */
        trackMenuItems() {
          return [
            ...superTrackMenuItems(),

            {
              label: 'Filter by',
              icon: FilterListIcon,
              onClick: () => {
                getSession(self).queueDialog(handleClose => [
                  FilterByTagDlg,
                  { model: self, handleClose },
                ])
              },
            },

            {
              label: 'Set max height',
              onClick: () => {
                getSession(self).queueDialog(handleClose => [
                  SetMaxHeightDlg,
                  { model: self, handleClose },
                ])
              },
            },
          ]
        },
      }
    })
}

export type LinearAlignmentsArcsDisplayStateModel = ReturnType<
  typeof stateModelFactory
>
export type LinearAlignmentsArcsDisplayModel =
  Instance<LinearAlignmentsArcsDisplayStateModel>

export default stateModelFactory
