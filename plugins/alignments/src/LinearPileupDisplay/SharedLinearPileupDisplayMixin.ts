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
  getSession,
  isSessionModelWithWidgets,
} from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { cast, isAlive, types } from '@jbrowse/mobx-state-tree'
import { BaseLinearDisplay } from '@jbrowse/plugin-linear-genome-view'
import FilterListIcon from '@mui/icons-material/ClearAll'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import MenuOpenIcon from '@mui/icons-material/MenuOpen'
import VisibilityIcon from '@mui/icons-material/Visibility'
import { observable } from 'mobx'

import LinearPileupDisplayBlurb from './components/LinearPileupDisplayBlurb'
import { getPileupLegendItems } from '../shared/legendUtils'
import { getMismatchDisplayMenuItem } from '../shared/menuItems'
import { isDefaultFilterFlags } from '../shared/util'

import type { ColorBy, FilterBy } from '../shared/types'
import type {
  AnyConfigurationModel,
  AnyConfigurationSchemaType,
} from '@jbrowse/core/configuration'
import type { Feature, SimpleFeatureSerialized } from '@jbrowse/core/util'
import type {
  LegendItem,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'
import type { Theme } from '@mui/material'
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
        /**
         * #property
         */
        hideMismatchesSetting: types.maybe(types.boolean),
        /**
         * #property
         */
        hideLargeIndelsSetting: types.maybe(types.boolean),
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
        return (
          view.initialized && self.featureDensityStatsReadyAndRegionNotTooLarge
        )
      },

      /**
       * #getter
       */
      get hideSmallIndels() {
        return self.hideSmallIndelsSetting
      },
      /**
       * #getter
       */
      get hideMismatches() {
        return self.hideMismatchesSetting
      },
      /**
       * #getter
       */
      get hideLargeIndels() {
        return self.hideLargeIndelsSetting
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

      /**
       * #action
       */
      setHideMismatches(arg: boolean) {
        self.hideMismatchesSetting = arg
      },
      /**
       * #action
       */
      setHideLargeIndels(arg: boolean) {
        self.hideLargeIndelsSetting = arg
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
          hideMismatches,
          hideLargeIndels,
          trackMaxHeight: maxHeight,
          rendererTypeName,
        } = self
        const configBlob = getConf(self, ['renderers', rendererTypeName]) || {}
        return {
          ...configBlob,
          ...(hideSmallIndels !== undefined ? { hideSmallIndels } : {}),
          ...(hideMismatches !== undefined ? { hideMismatches } : {}),
          ...(hideLargeIndels !== undefined ? { hideLargeIndels } : {}),
          ...(height !== undefined ? { height } : {}),
          ...(noSpacing !== undefined ? { noSpacing } : {}),
          ...(maxHeight !== undefined ? { maxHeight } : {}),
        }
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

      /**
       * #method
       * Returns legend items based on current colorBy setting
       */
      legendItems(theme: Theme): LegendItem[] {
        return getPileupLegendItems(self.colorBy, theme)
      },

      /**
       * #method
       */
      showSubMenuItems() {
        return [
          {
            label: 'Show tooltips',
            type: 'checkbox',
            checked: self.showTooltipsEnabled,
            onClick: () => {
              self.setShowTooltips(!self.showTooltipsEnabled)
            },
          },
          {
            label: 'Show legend',
            type: 'checkbox',
            checked: self.showLegend,
            onClick: () => {
              self.setShowLegend(!self.showLegend)
            },
          },
          getMismatchDisplayMenuItem(self),
        ]
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
        adapterRenderProps() {
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
                      trackInstanceId: getContainingTrack(self).id,
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
                      trackInstanceId: getContainingTrack(self).id,
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
              priority: 0,
              subMenu: [
                {
                  label: 'Normal',
                  type: 'radio',
                  checked: self.featureHeight === 7 && self.noSpacing === false,
                  onClick: () => {
                    self.setFeatureHeight(7)
                    self.setNoSpacing(false)
                  },
                },
                {
                  label: 'Compact',
                  type: 'radio',
                  checked: self.featureHeight === 2 && self.noSpacing === true,
                  onClick: () => {
                    self.setFeatureHeight(2)
                    self.setNoSpacing(true)
                  },
                },
                {
                  label: 'Super-compact',
                  type: 'radio',
                  checked: self.featureHeight === 1 && self.noSpacing === true,
                  onClick: () => {
                    self.setFeatureHeight(1)
                    self.setNoSpacing(true)
                  },
                },
                {
                  label: 'Custom',
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
              label: 'Show...',
              icon: VisibilityIcon,
              priority: -1,
              type: 'subMenu',
              subMenu: self.showSubMenuItems(),
            },
            {
              label: 'Set max track height...',
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
        return self.adapterRenderProps()
      },
    }))
    .actions(self => ({
      afterAttach() {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        ;(async () => {
          const { sharedDoAfterAttach } =
            await import('./sharedDoAfterAttach.ts')
          sharedDoAfterAttach(self)
        })()
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
    .postProcessSnapshot(snap => {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (!snap) {
        return snap
      }
      const {
        trackMaxHeight,
        colorBySetting,
        filterBySetting,
        jexlFilters,
        hideSmallIndelsSetting,
        hideMismatchesSetting,
        hideLargeIndelsSetting,
        ...rest
      } = snap as Omit<typeof snap, symbol>
      return {
        ...rest,
        ...(trackMaxHeight !== undefined ? { trackMaxHeight } : {}),
        ...(colorBySetting !== undefined ? { colorBySetting } : {}),
        ...(!isDefaultFilterFlags(filterBySetting) ? { filterBySetting } : {}),
        // mst types wrong, nullish needed
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        ...(jexlFilters?.length ? { jexlFilters } : {}),
        ...(hideSmallIndelsSetting !== undefined
          ? { hideSmallIndelsSetting }
          : {}),
        ...(hideMismatchesSetting !== undefined
          ? { hideMismatchesSetting }
          : {}),
        ...(hideLargeIndelsSetting !== undefined
          ? { hideLargeIndelsSetting }
          : {}),
      } as typeof snap
    })
}
