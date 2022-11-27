import { lazy } from 'react'
import { autorun } from 'mobx'
import { cast, types, addDisposer, Instance } from 'mobx-state-tree'
import {
  AnyConfigurationModel,
  ConfigurationReference,
  getConf,
} from '@jbrowse/core/configuration'
import {
  getEnv,
  getSession,
  isSessionModelWithWidgets,
  getContainingView,
  getContainingTrack,
  Feature,
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

// using a map because it preserves order
const rendererTypes = new Map([
  ['pileup', 'PileupRenderer'],
  ['svg', 'SvgFeatureRenderer'],
])

type LGV = LinearGenomeViewModel

interface ReducedFeature {
  name: string
  refName: string
  start: number
  end: number
  id: string
  flags: number
}

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
      arcFeatures: undefined as ReducedFeature[] | undefined,
      ready: false,
    }))
    .actions(self => ({
      /**
       * #action
       */
      setReady(flag: boolean) {
        self.ready = flag
      },

      /**
       * #action
       */
      setMaxHeight(n: number) {
        self.trackMaxHeight = n
      },

      /**
       * #action
       */
      setArcFeatures(f: ReducedFeature[]) {
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

                if (
                  !view.initialized ||
                  !self.estimatedStatsReady ||
                  self.regionTooLarge
                ) {
                  return
                }

                const { staticBlocks } = view

                const ret = (await rpcManager.call(
                  sessionId,
                  'PileupGetFeatures',
                  {
                    sessionId,
                    regions: staticBlocks.contentBlocks,
                    adapterConfig: self.adapterConfig,
                    layoutId: view.id,
                    rendererType: 'PileupRenderer',
                  },
                )) as ReducedFeature[]
                self.setArcFeatures(ret)
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
      selectFeature(feature: Feature) {
        const session = getSession(self)
        if (isSessionModelWithWidgets(session)) {
          const featureWidget = session.addWidget(
            'AlignmentsFeatureWidget',
            'alignmentFeature',
            { featureData: feature.toJSON(), view: getContainingView(self) },
          )
          session.showWidget(featureWidget)
        }
        session.setSelection(feature)
      },

      /**
       * #action
       */
      setConfig(configuration: AnyConfigurationModel) {
        self.configuration = configuration
      },

      setFilterBy(filter: {
        flagInclude: number
        flagExclude: number
        readName?: string
        tagFilter?: { tag: string; value: string }
      }) {
        self.filterBy = cast(filter)
      },
    }))
    .actions(self => {
      // resets the sort object and refresh whole display on reload
      const superReload = self.reload

      return {
        /**
         * #action
         */
        reload() {
          superReload()
        },
      }
    })

    .views(self => ({
      /**
       * #getter
       */
      get maxHeight() {
        const conf = getConf(self, ['renderers', self.rendererTypeName]) || {}
        return self.trackMaxHeight !== undefined
          ? self.trackMaxHeight
          : conf.maxHeight
      },

      /**
       * #getter
       */
      get rendererConfig() {
        const configBlob =
          getConf(self, ['renderers', self.rendererTypeName]) || {}
        return self.rendererType.configSchema.create(
          {
            ...configBlob,
            maxHeight: this.maxHeight,
          },
          getEnv(self),
        )
      },
    }))
    .views(self => {
      const {
        trackMenuItems: superTrackMenuItems,
        renderProps: superRenderProps,
      } = self

      return {
        /**
         * #getter
         */
        get rendererTypeName() {
          const viewName = getConf(self, 'defaultRendering')
          const rendererType = rendererTypes.get(viewName)
          if (!rendererType) {
            throw new Error(`unknown alignments view name ${viewName}`)
          }
          return rendererType
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
          const { filterBy, rpcDriverName, ready } = self
          const superProps = superRenderProps()
          return {
            ...superProps,
            notReady: superProps.notReady || !ready,
            rpcDriverName,
            displayModel: self,
            filterBy: JSON.parse(JSON.stringify(filterBy)),
            config: self.rendererConfig,
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
                getSession(self).queueDialog(doneCallback => [
                  SetMaxHeightDlg,
                  { model: self, handleClose: doneCallback },
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
