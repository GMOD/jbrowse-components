import { lazy } from 'react'
import { autorun, observable } from 'mobx'
import { cast, types, addDisposer, Instance } from 'mobx-state-tree'
import {
  AnyConfigurationModel,
  ConfigurationReference,
  getConf,
} from '@jbrowse/core/configuration'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import {
  getEnv,
  getSession,
  isSessionModelWithWidgets,
  getContainingView,
  SimpleFeature,
  Feature,
} from '@jbrowse/core/util'
import { SimpleFeatureSerialized } from '@jbrowse/core/util/simpleFeature'

import {
  LinearGenomeViewModel,
  BaseLinearDisplay,
} from '@jbrowse/plugin-linear-genome-view'

// icons
import MenuOpenIcon from '@mui/icons-material/MenuOpen'
import PaletteIcon from '@mui/icons-material/Palette'
import FilterListIcon from '@mui/icons-material/ClearAll'

// locals
import { LinearAlignmentsArcsDisplayConfigModel } from './configSchema'
import { getUniqueTagValues } from '../shared'

// async
const ColorByTagDlg = lazy(() => import('./components/ColorByTag'))
const FilterByTagDlg = lazy(() => import('./components/FilterByTag'))
const SetMaxHeightDlg = lazy(() => import('./components/SetMaxHeight'))

// using a map because it preserves order
const rendererTypes = new Map([
  ['pileup', 'PileupRenderer'],
  ['svg', 'SvgFeatureRenderer'],
])

type LGV = LinearGenomeViewModel

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
        colorBy: types.maybe(
          types.model({
            type: types.string,
            tag: types.maybe(types.string),
            extra: types.frozen(),
          }),
        ),

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
      colorTagMap: observable.map<string, string>({}),
      featureUnderMouseVolatile: undefined as undefined | Feature,
      currSortBpPerPx: 0,
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
      setCurrSortBpPerPx(n: number) {
        self.currSortBpPerPx = n
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
      setColorScheme(colorScheme: { type: string; tag?: string }) {
        self.colorTagMap = observable.map({}) // clear existing mapping
        self.colorBy = cast(colorScheme)
        self.ready = false
      },

      /**
       * #action
       */
      updateColorTagMap(uniqueTag: string[]) {
        // pale color scheme
        // https://cran.r-project.org/web/packages/khroma/vignettes/tol.html
        // e.g. "tol_light"
        const colorPalette = [
          '#BBCCEE',
          'pink',
          '#CCDDAA',
          '#EEEEBB',
          '#FFCCCC',
          'lightblue',
          'lightgreen',
          'tan',
          '#CCEEFF',
          'lightsalmon',
        ]

        uniqueTag.forEach(value => {
          if (!self.colorTagMap.has(value)) {
            const totalKeys = [...self.colorTagMap.keys()].length
            const newColor = colorPalette[totalKeys]
            self.colorTagMap.set(value, newColor)
          }
        })
      },
      /**
       * #action
       */
      setFeatureUnderMouse(feat?: Feature) {
        self.featureUnderMouseVolatile = feat
      },
    }))
    .actions(self => ({
      afterAttach() {
        addDisposer(
          self,
          autorun(
            async () => {
              try {
                const view = getContainingView(self) as LGV
                const { colorBy } = self

                if (
                  !view.initialized ||
                  !self.estimatedStatsReady ||
                  self.regionTooLarge
                ) {
                  return
                }

                const { staticBlocks } = view
                // continually generate the vc pairing, set and rerender if any
                // new values seen
                if (colorBy?.tag) {
                  self.updateColorTagMap(
                    await getUniqueTagValues(self, colorBy, staticBlocks),
                  )
                }

                self.setReady(true)
              } catch (e) {
                console.error(e)
                self.setError(e)
              }
            },
            { delay: 1000 },
          ),
        )

        // autorun synchronizes featureUnderMouse with featureIdUnderMouse
        // asynchronously. this is needed due to how we do not serialize all
        // features from the BAM/CRAM over the rpc
        addDisposer(
          self,
          autorun(async () => {
            const session = getSession(self)
            try {
              const featureId = self.featureIdUnderMouse
              if (self.featureUnderMouse?.id() !== featureId) {
                if (!featureId) {
                  self.setFeatureUnderMouse(undefined)
                } else {
                  const sessionId = getRpcSessionId(self)
                  const view = getContainingView(self)
                  const { feature } = (await session.rpcManager.call(
                    sessionId,
                    'CoreGetFeatureDetails',
                    {
                      featureId,
                      sessionId,
                      layoutId: view.id,
                      rendererType: 'PileupRenderer',
                    },
                  )) as { feature: unknown }

                  // check featureIdUnderMouse is still the same as the
                  // feature.id that was returned e.g. that the user hasn't
                  // moused over to a new position during the async operation
                  // above
                  // @ts-ignore
                  if (self.featureIdUnderMouse === feature.uniqueId) {
                    // @ts-ignore
                    self.setFeatureUnderMouse(new SimpleFeature(feature))
                  }
                }
              }
            } catch (e) {
              console.error(e)
              session.notify(`${e}`, 'error')
            }
          }),
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

      /**
       * #getter
       */
      get featureUnderMouse() {
        return self.featureUnderMouseVolatile
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
          const contextMenuItems = feat
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
          return contextMenuItems
        },

        /**
         * #method
         */
        renderProps() {
          const { colorTagMap, colorBy, filterBy, rpcDriverName, ready } = self

          const superProps = superRenderProps()

          return {
            ...superProps,
            notReady: superProps.notReady || !ready,
            rpcDriverName,
            displayModel: self,
            colorBy,
            filterBy: JSON.parse(JSON.stringify(filterBy)),
            colorTagMap: Object.fromEntries(colorTagMap.toJSON()),
            config: self.rendererConfig,
            async onFeatureClick(_: unknown, featureId?: string) {
              const session = getSession(self)
              const { rpcManager } = session
              try {
                const f = featureId || self.featureIdUnderMouse
                if (!f) {
                  self.clearFeatureSelection()
                } else {
                  const sessionId = getRpcSessionId(self)
                  const { feature } = (await rpcManager.call(
                    sessionId,
                    'CoreGetFeatureDetails',
                    {
                      featureId: f,
                      sessionId,
                      layoutId: getContainingView(self).id,
                      rendererType: 'PileupRenderer',
                    },
                  )) as { feature: unknown }

                  if (feature) {
                    // @ts-ignore
                    self.selectFeature(new SimpleFeature(feature))
                  }
                }
              } catch (e) {
                console.error(e)
                session.notify(`${e}`)
              }
            },

            onClick() {
              self.clearFeatureSelection()
            },
            // similar to click but opens a menu with further options
            async onFeatureContextMenu(_: unknown, featureId?: string) {
              const session = getSession(self)
              const { rpcManager } = session
              try {
                const f = featureId || self.featureIdUnderMouse
                if (!f) {
                  self.clearFeatureSelection()
                } else {
                  const sessionId = getRpcSessionId(self)
                  const { feature } = (await rpcManager.call(
                    sessionId,
                    'CoreGetFeatureDetails',
                    {
                      featureId: f,
                      sessionId,
                      layoutId: getContainingView(self).id,
                      rendererType: 'PileupRenderer',
                    },
                  )) as { feature: SimpleFeatureSerialized }

                  if (feature) {
                    self.setContextMenuFeature(new SimpleFeature(feature))
                  }
                }
              } catch (e) {
                console.error(e)
                session.notify(`${e}`)
              }
            },
          }
        },

        /**
         * #method
         */
        trackMenuItems() {
          return [
            ...superTrackMenuItems(),

            {
              label: 'Color scheme',
              icon: PaletteIcon,
              subMenu: [
                {
                  label: 'Normal',
                  onClick: () => self.setColorScheme({ type: 'normal' }),
                },
                {
                  label: 'Mapping quality',
                  onClick: () =>
                    self.setColorScheme({ type: 'mappingQuality' }),
                },
                {
                  label: 'Strand',
                  onClick: () => self.setColorScheme({ type: 'strand' }),
                },
                {
                  label: 'Pair orientation',
                  onClick: () =>
                    self.setColorScheme({ type: 'pairOrientation' }),
                },
                {
                  label: 'Per-base quality',
                  onClick: () =>
                    self.setColorScheme({ type: 'perBaseQuality' }),
                },
                {
                  label: 'Per-base lettering',
                  onClick: () =>
                    self.setColorScheme({ type: 'perBaseLettering' }),
                },

                {
                  label: 'Insert size',
                  onClick: () => self.setColorScheme({ type: 'insertSize' }),
                },
                {
                  label: 'Stranded paired-end',
                  onClick: () =>
                    self.setColorScheme({ type: 'reverseTemplate' }),
                },
                {
                  label: 'Color by tag...',
                  onClick: () => {
                    getSession(self).queueDialog(doneCallback => [
                      ColorByTagDlg,
                      { model: self, handleClose: doneCallback },
                    ])
                  },
                },
              ],
            },
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
