import { lazy } from 'react'
import {
  ConfigurationReference,
  readConfObject,
  getConf,
} from '@jbrowse/core/configuration'
import SerializableFilterChain from '@jbrowse/core/pluggableElementTypes/renderers/util/serializableFilterChain'

// icons
import { ContentCopy as ContentCopyIcon } from '@jbrowse/core/ui/Icons'
import {
  getEnv,
  getSession,
  getContainingView,
  getContainingTrack,
  isSessionModelWithWidgets,
  SimpleFeature,
} from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { BaseLinearDisplay } from '@jbrowse/plugin-linear-genome-view'
import FilterListIcon from '@mui/icons-material/ClearAll'
import MenuOpenIcon from '@mui/icons-material/MenuOpen'
import copy from 'copy-to-clipboard'
import { autorun, observable } from 'mobx'
import { cast, types, addDisposer, isAlive } from 'mobx-state-tree'

// locals
import { getUniqueTags } from '../shared/getUniqueTags'
import { createAutorun } from '../util'
import LinearPileupDisplayBlurb from './components/LinearPileupDisplayBlurb'
import type { ColorBy, FilterBy } from '../shared/types'
import type {
  AnyConfigurationModel,
  AnyConfigurationSchemaType,
} from '@jbrowse/core/configuration'
import type { SimpleFeatureSerialized, Feature } from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// lazies
const FilterByTagDialog = lazy(
  () => import('../shared/components/FilterByTagDialog'),
)
const ColorByTagDialog = lazy(() => import('./components/ColorByTagDialog'))
const SetFeatureHeightDialog = lazy(
  () => import('./components/SetFeatureHeightDialog'),
)
const SetMaxHeightDialog = lazy(() => import('./components/SetMaxHeightDialog'))

// using a map because it preserves order
const rendererTypes = new Map([
  ['pileup', 'PileupRenderer'],
  ['svg', 'SvgFeatureRenderer'],
])

type LGV = LinearGenomeViewModel

/**
 * #stateModel SharedLinearPileupDisplayMixin
 * #category display
 * extends
 * - [BaseLinearDisplay](../baselineardisplay)
 */
export function SharedLinearPileupDisplayMixin(
  configSchema: AnyConfigurationSchemaType,
) {
  return types
    .compose(
      BaseLinearDisplay,
      types.model({
        /**
         * #property
         */
        configuration: ConfigurationReference(configSchema),
        /**
         * #property
         */
        featureHeight: types.maybe(types.number),
        /**
         * #property
         */
        noSpacing: types.maybe(types.boolean),
        /**
         * #property
         */
        fadeLikelihood: types.maybe(types.boolean),
        /**
         * #property
         */
        trackMaxHeight: types.maybe(types.number),
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
        jexlFilters: types.optional(types.array(types.string), []),
      }),
    )
    .volatile(() => ({
      /**
       * #volatile
       */
      colorTagMap: observable.map<string, string>({}),
      /**
       * #volatile
       */
      featureUnderMouseVolatile: undefined as undefined | Feature,
      /**
       * #volatile
       */
      tagsReady: false,
    }))
    .views(self => ({
      /**
       * #getter
       */
      get colorBy() {
        return self.colorBySetting ?? getConf(self, 'colorBy')
      },

      /**
       * #getter
       */
      get filterBy() {
        return self.filterBySetting ?? getConf(self, 'filterBy')
      },
    }))
    .views(self => ({
      get autorunReady() {
        const view = getContainingView(self) as LGV
        return (
          view.initialized &&
          self.featureDensityStatsReady &&
          !self.regionTooLarge
        )
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      setTagsReady(flag: boolean) {
        self.tagsReady = flag
      },

      /**
       * #action
       */
      setMaxHeight(n?: number) {
        self.trackMaxHeight = n
      },

      /**
       * #action
       */
      setFeatureHeight(n?: number) {
        self.featureHeight = n
      },

      /**
       * #action
       */
      setNoSpacing(flag?: boolean) {
        self.noSpacing = flag
      },

      /**
       * #action
       */
      setColorScheme(colorScheme: ColorBy) {
        self.colorTagMap = observable.map({})
        self.colorBySetting = {
          ...colorScheme,
        }
        if (colorScheme.tag) {
          self.tagsReady = false
        }
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
            self.colorTagMap.set(value, colorPalette[totalKeys]!)
          }
        })
      },

      /**
       * #action
       */
      setFeatureUnderMouse(feat?: Feature) {
        self.featureUnderMouseVolatile = feat
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
            {
              featureData: feature.toJSON(),
              view: getContainingView(self),
              track: getContainingTrack(self),
            },
          )
          session.showWidget(featureWidget)
        }
        session.setSelection(feature)
      },

      /**
       * #action
       * uses copy-to-clipboard and generates notification
       */
      copyFeatureToClipboard(feature: Feature) {
        const { uniqueId, ...rest } = feature.toJSON()
        const session = getSession(self)
        copy(JSON.stringify(rest, null, 4))
        session.notify('Copied to clipboard', 'success')
      },

      /**
       * #action
       */
      setConfig(conf: AnyConfigurationModel) {
        self.configuration = conf
      },

      /**
       * #action
       */
      setFilterBy(filter: FilterBy) {
        self.filterBySetting = {
          ...filter,
        }
      },

      /**
       * #action
       */
      setJexlFilters(filters: string[]) {
        self.jexlFilters = cast(filters)
      },
    }))

    .views(self => ({
      /**
       * #getter
       */
      get rendererConfig() {
        const { featureHeight, noSpacing, trackMaxHeight, rendererTypeName } =
          self
        const configBlob = getConf(self, ['renderers', rendererTypeName]) || {}
        return self.rendererType.configSchema.create(
          {
            ...configBlob,
            ...(featureHeight !== undefined ? { height: featureHeight } : {}),
            ...(noSpacing !== undefined ? { noSpacing } : {}),
            ...(trackMaxHeight !== undefined
              ? { maxHeight: trackMaxHeight }
              : {}),
          },
          getEnv(self),
        )
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
      get maxHeight() {
        return readConfObject(self.rendererConfig, 'maxHeight')
      },

      /**
       * #getter
       */
      get featureHeightSetting() {
        return readConfObject(self.rendererConfig, 'height')
      },
      /**
       * #getter
       */
      get featureUnderMouse() {
        return self.featureUnderMouseVolatile
      },
      /**
       * #getter
       */
      renderReady() {
        return self.tagsReady
      },
      /**
       * #getter
       */
      get filters() {
        return new SerializableFilterChain({ filters: self.jexlFilters })
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
                  onClick: (): void => {
                    self.clearFeatureSelection()
                    self.selectFeature(feat)
                  },
                },
                {
                  label: 'Copy info to clipboard',
                  icon: ContentCopyIcon,
                  onClick: (): void => {
                    self.copyFeatureToClipboard(feat)
                  },
                },
              ]
            : []
        },

        /**
         * #getter
         */
        get DisplayBlurb() {
          return LinearPileupDisplayBlurb
        },
        /**
         * #method
         */
        renderPropsPre() {
          const { colorTagMap, colorBy, filterBy, rpcDriverName } = self
          const superProps = superRenderProps()
          return {
            ...superProps,
            notReady: superProps.notReady || !self.renderReady(),
            rpcDriverName,
            displayModel: self,
            colorBy,
            filterBy,
            filters: self.filters,
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
                  )) as { feature: SimpleFeatureSerialized | undefined }

                  if (isAlive(self) && feature) {
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
                  )) as { feature: SimpleFeatureSerialized | undefined }

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
        colorSchemeSubMenuItems() {
          return [
            {
              label: 'Normal',
              onClick: () => {
                self.setColorScheme({
                  type: 'normal',
                })
              },
            },
            {
              label: 'Mapping quality',
              onClick: () => {
                self.setColorScheme({
                  type: 'mappingQuality',
                })
              },
            },
            {
              label: 'Strand',
              onClick: () => {
                self.setColorScheme({
                  type: 'strand',
                })
              },
            },
            {
              label: 'Per-base quality',
              onClick: () => {
                self.setColorScheme({
                  type: 'perBaseQuality',
                })
              },
            },
            {
              label: 'Per-base lettering',
              onClick: () => {
                self.setColorScheme({
                  type: 'perBaseLettering',
                })
              },
            },
            {
              label: 'First-of-pair strand',
              onClick: () => {
                self.setColorScheme({
                  type: 'stranded',
                })
              },
            },
            {
              label: 'Color by tag...',
              onClick: () => {
                getSession(self).queueDialog(handleClose => [
                  ColorByTagDialog,
                  {
                    model: self,
                    handleClose,
                  },
                ])
              },
            },
          ]
        },

        /**
         * #method
         */
        trackMenuItems() {
          return [
            ...superTrackMenuItems(),

            {
              label: 'Set feature height...',
              priority: 1,
              subMenu: [
                {
                  label: 'Normal',
                  onClick: () => {
                    self.setFeatureHeight(7)
                    self.setNoSpacing(false)
                  },
                },
                {
                  label: 'Compact',
                  onClick: () => {
                    self.setFeatureHeight(2)
                    self.setNoSpacing(true)
                  },
                },
                {
                  label: 'Manually set height',
                  onClick: () => {
                    getSession(self).queueDialog(handleClose => [
                      SetFeatureHeightDialog,
                      {
                        model: self,
                        handleClose,
                      },
                    ])
                  },
                },
              ],
            },
            {
              label: 'Set max height...',
              priority: -1,
              onClick: () => {
                getSession(self).queueDialog(handleClose => [
                  SetMaxHeightDialog,
                  {
                    model: self,
                    handleClose,
                  },
                ])
              },
            },
            {
              label: 'Filter by...',
              icon: FilterListIcon,
              onClick: () => {
                getSession(self).queueDialog(handleClose => [
                  FilterByTagDialog,
                  {
                    model: self,
                    handleClose,
                  },
                ])
              },
            },
          ]
        },
      }
    })
    .views(self => ({
      renderProps() {
        return self.renderPropsPre()
      },
    }))
    .actions(self => ({
      afterAttach() {
        createAutorun(
          self,
          async () => {
            const view = getContainingView(self) as LGV
            if (!self.autorunReady) {
              return
            }

            const { colorBy, tagsReady } = self
            const { staticBlocks } = view
            if (colorBy?.tag && !tagsReady) {
              const vals = await getUniqueTags({
                self,
                tag: colorBy.tag,
                blocks: staticBlocks,
              })
              if (isAlive(self)) {
                self.updateColorTagMap(vals)
                self.setTagsReady(true)
              }
            } else {
              self.setTagsReady(true)
            }
          },
          { delay: 1000 },
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
                  )) as { feature: SimpleFeatureSerialized | undefined }

                  // check featureIdUnderMouse is still the same as the
                  // feature.id that was returned e.g. that the user hasn't
                  // moused over to a new position during the async operation
                  // above
                  if (
                    isAlive(self) &&
                    feature &&
                    self.featureIdUnderMouse === feature.uniqueId
                  ) {
                    self.setFeatureUnderMouse(new SimpleFeature(feature))
                  }
                }
              }
            } catch (e) {
              console.error(e)
              session.notifyError(`${e}`, e)
            }
          }),
        )
      },
    }))
    .preProcessSnapshot(snap => {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (snap) {
        // @ts-expect-error
        const { colorBy, filterBy, ...rest } = snap
        return {
          ...rest,
          filterBySetting: filterBy,
          colorBySetting: colorBy,
        }
      }
      return snap
    })
}
