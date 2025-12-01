import { lazy } from 'react'

import {
  ConfigurationReference,
  getConf,
  readConfObject,
} from '@jbrowse/core/configuration'
import SerializableFilterChain from '@jbrowse/core/pluggableElementTypes/renderers/util/serializableFilterChain'
import {
  SimpleFeature,
  getContainingTrack,
  getContainingView,
  getEnv,
  getSession,
  isSessionModelWithWidgets,
} from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { addDisposer, cast, isAlive, types } from '@jbrowse/mobx-state-tree'
import { BaseLinearDisplay } from '@jbrowse/plugin-linear-genome-view'
import FilterListIcon from '@mui/icons-material/ClearAll'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import MenuOpenIcon from '@mui/icons-material/MenuOpen'
import { autorun, observable } from 'mobx'

import { createAutorun } from '../util'
import LinearPileupDisplayBlurb from './components/LinearPileupDisplayBlurb'
import { getUniqueTags } from '../shared/getUniqueTags'

import type { ColorBy, FilterBy } from '../shared/types'
import type {
  AnyConfigurationModel,
  AnyConfigurationSchemaType,
} from '@jbrowse/core/configuration'
import type { Feature, SimpleFeatureSerialized } from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
// lazies
const FilterByTagDialog = lazy(
  () => import('../shared/components/FilterByTagDialog'),
)
const ColorByTagDialog = lazy(() => import('./components/ColorByTagDialog'))
const SetFeatureHeightDialog = lazy(
  () => import('../shared/components/SetFeatureHeightDialog'),
)
const SetMaxHeightDialog = lazy(
  () => import('../shared/components/SetMaxHeightDialog'),
)
const MismatchInfoDialog = lazy(() => import('./components/MismatchInfoDialog'))

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
        /**
         * #property
         */
        hideSmallIndelsSetting: types.maybe(types.boolean),
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
      /**
       * #getter
       */
      get autorunReady() {
        const view = getContainingView(self) as LGV
        return view.initialized && self.statsReadyAndRegionNotTooLarge
      },

      /**
       * #getter
       */
      get hideSmallIndels() {
        return self.hideSmallIndelsSetting
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

        for (const value of uniqueTag) {
          if (!self.colorTagMap.has(value)) {
            const totalKeys = [...self.colorTagMap.keys()].length
            self.colorTagMap.set(value, colorPalette[totalKeys]!)
          }
        }
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

      /**
       * #action
       */
      setHideSmallIndels(arg: boolean) {
        self.hideSmallIndelsSetting = arg
      },
    }))

    .views(self => ({
      /**
       * #method
       * uses copy-to-clipboard and generates notification
       */
      async copyFeatureToClipboard(feature: Feature) {
        const { uniqueId, ...rest } = feature.toJSON()
        const session = getSession(self)
        const { default: copy } = await import('copy-to-clipboard')
        copy(JSON.stringify(rest, null, 4))
        session.notify('Copied to clipboard', 'success')
      },
      /**
       * #getter
       */
      get rendererConfig() {
        const {
          featureHeight: height,
          noSpacing,
          hideSmallIndels,
          trackMaxHeight: maxHeight,
          rendererTypeName,
        } = self
        const configBlob = getConf(self, ['renderers', rendererTypeName]) || {}
        return self.rendererType.configSchema.create(
          {
            ...configBlob,
            ...(hideSmallIndels !== undefined ? { hideSmallIndels } : {}),
            ...(height !== undefined ? { height } : {}),
            ...(noSpacing !== undefined ? { noSpacing } : {}),
            ...(maxHeight !== undefined ? { maxHeight } : {}),
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
        renderingProps: superRenderingProps,
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
                    self.selectFeature(feat)
                  },
                },
                {
                  label: 'Copy info to clipboard',
                  icon: ContentCopyIcon,
                  onClick: () => {
                    // eslint-disable-next-line @typescript-eslint/no-floating-promises
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
          const { colorTagMap, colorBy, filterBy } = self
          const superProps = superRenderProps()
          return {
            ...superProps,
            notReady: superProps.notReady || !self.renderReady(),
            colorBy,
            filterBy,
            filters: self.filters,
            colorTagMap: Object.fromEntries(colorTagMap.toJSON()),
            config: self.rendererConfig,
          }
        },
        /**
         * #method
         */
        renderingProps() {
          return {
            ...superRenderingProps(),
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
                      layoutId: getContainingTrack(self).id,
                      rendererType: 'PileupRenderer',
                      rpcDriverName: self.effectiveRpcDriverName,
                    },
                  )) as { feature: SimpleFeatureSerialized | undefined }

                  if (isAlive(self) && feature) {
                    self.selectFeature(new SimpleFeature(feature))
                  }
                }
              } catch (e) {
                console.error(e)
                session.notifyError(`${e}`, e)
              }
            },

            onClick() {
              self.clearFeatureSelection()
            },
            async onMismatchClick(
              _: unknown,
              item: {
                type: string
                seq: string
                modType?: string
                probability?: number
              },
              featureId?: string,
            ) {
              getSession(self).queueDialog(handleClose => [
                MismatchInfoDialog,
                {
                  item,
                  featureId,
                  handleClose,
                },
              ])
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
                      layoutId: getContainingTrack(self).id,
                      rendererType: 'PileupRenderer',
                      rpcDriverName: self.effectiveRpcDriverName,
                    },
                  )) as { feature: SimpleFeatureSerialized | undefined }

                  if (feature) {
                    self.setContextMenuFeature(new SimpleFeature(feature))
                  }
                }
              } catch (e) {
                console.error(e)
                session.notifyError(`${e}`, e)
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
                  label: 'Super-compact',
                  onClick: () => {
                    self.setFeatureHeight(1)
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
              label: 'Hide small indels (<10bp)',
              priority: -1,
              type: 'checkbox',
              checked: self.hideSmallIndels,
              onClick: () => {
                self.setHideSmallIndels(!self.hideSmallIndels)
              },
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
                  const { feature } = (await session.rpcManager.call(
                    sessionId,
                    'CoreGetFeatureDetails',
                    {
                      featureId,
                      sessionId,
                      layoutId: getContainingTrack(self).id,
                      rendererType: 'PileupRenderer',
                      rpcDriverName: self.effectiveRpcDriverName,
                    },
                  )) as { feature: SimpleFeatureSerialized | undefined }

                  // check featureIdUnderMouse is still the same
                  // as the feature.id that was returned e.g. that
                  // the user hasn't moused over to a new position
                  // during the async operation above
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
        const { colorBy, colorBySetting, filterBySetting, filterBy, ...rest } =
          snap
        return {
          ...rest,
          filterBySetting: filterBySetting || filterBy,
          colorBySetting: colorBySetting || colorBy,
        }
      }
      return snap
    })
}
