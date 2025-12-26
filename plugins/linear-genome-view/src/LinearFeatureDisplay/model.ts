import { lazy } from 'react'

import {
  ConfigurationReference,
  getConf,
  readConfObject,
} from '@jbrowse/core/configuration'
import SerializableFilterChain from '@jbrowse/core/pluggableElementTypes/renderers/util/serializableFilterChain'
import { SimpleFeature, getSession } from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { cast, getParent, isAlive, types } from '@jbrowse/mobx-state-tree'
import VisibilityIcon from '@mui/icons-material/Visibility'

import { BaseLinearDisplay } from '../BaseLinearDisplay'

import type {
  AnyConfigurationModel,
  AnyConfigurationSchemaType,
} from '@jbrowse/core/configuration'
import type { MenuItem } from '@jbrowse/core/ui'
import type { Feature, SimpleFeatureSerialized } from '@jbrowse/core/util'
import type { Instance } from '@jbrowse/mobx-state-tree'

const SetMaxHeightDialog = lazy(() => import('./components/SetMaxHeightDialog'))
const AddFiltersDialog = lazy(() => import('./components/AddFiltersDialog'))

/**
 * #stateModel LinearFeatureDisplay
 * #category display
 * Base model for feature displays. Provides labels, descriptions, display modes,
 * filters, etc. Does not include gene glyph functionality.
 *
 * extends
 * - [BaseLinearDisplay](../baselineardisplay)
 */
function stateModelFactory(configSchema: AnyConfigurationSchemaType) {
  return types
    .compose(
      'LinearFeatureDisplay',
      BaseLinearDisplay,
      types.model({
        /**
         * #property
         */
        type: types.literal('LinearFeatureDisplay'),
        /**
         * #property
         */
        trackShowLabels: types.maybe(types.boolean),
        /**
         * #property
         */
        trackShowDescriptions: types.maybe(types.boolean),
        /**
         * #property
         */
        trackDisplayMode: types.maybe(types.string),
        /**
         * #property
         */
        trackMaxHeight: types.maybe(types.number),
        /**
         * #property
         */
        configuration: ConfigurationReference(configSchema),
        /**
         * #property
         */
        jexlFilters: types.maybe(types.array(types.string)),
      }),
    )
    .volatile(() => ({
      /**
       * #volatile
       * Stores the feature under the mouse cursor, fetched asynchronously
       * via CoreGetFeatureDetails RPC to avoid serializing all features
       */
      featureUnderMouseVolatile: undefined as Feature | undefined,
    }))
    .views(self => ({
      /**
       * #getter
       */
      get activeFilters() {
        // config jexlFilters are deferred evaluated so they are prepended with
        // jexl at runtime rather than being stored with jexl in the config
        return (
          self.jexlFilters ??
          getConf(self, 'jexlFilters').map((r: string) => `jexl:${r}`)
        )
      },
      /**
       * #getter
       */
      get rendererTypeName() {
        return getConf(self, ['renderer', 'type'])
      },

      /**
       * #getter
       */
      get sequenceAdapter() {
        const { assemblyManager } = getSession(self)
        const track = getParent<{ configuration: AnyConfigurationModel }>(
          self,
          2,
        )
        const assemblyNames = readConfObject(
          track.configuration,
          'assemblyNames',
        ) as string[]
        const assembly = assemblyManager.get(assemblyNames[0]!)
        return assembly ? getConf(assembly, ['sequence', 'adapter']) : undefined
      },

      /**
       * #getter
       */
      get showLabels() {
        return self.trackShowLabels ?? getConf(self, ['renderer', 'showLabels'])
      },

      /**
       * #getter
       */
      get showDescriptions() {
        return (
          self.trackShowDescriptions ??
          getConf(self, ['renderer', 'showDescriptions'])
        )
      },

      /**
       * #getter
       */
      get maxHeight() {
        return self.trackMaxHeight ?? getConf(self, ['renderer', 'maxHeight'])
      },

      /**
       * #getter
       */
      get displayMode() {
        return (
          self.trackDisplayMode ?? getConf(self, ['renderer', 'displayMode'])
        )
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
      get rendererConfig() {
        const configBlob = getConf(self, ['renderer']) || {}
        const config = configBlob as Omit<typeof configBlob, symbol>

        // Return plain object instead of MST model to avoid expensive .create()
        // calls and object identity changes on every access
        return {
          ...config,
          showLabels: self.showLabels,
          showDescriptions: self.showDescriptions,
          displayMode: self.displayMode,
          maxHeight: self.maxHeight,
        }
      },
    }))

    .actions(self => ({
      /**
       * #action
       */
      setJexlFilters(f?: string[]) {
        self.jexlFilters = cast(f)
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
      toggleShowLabels() {
        self.trackShowLabels = !self.showLabels
      },
      /**
       * #action
       */
      toggleShowDescriptions() {
        self.trackShowDescriptions = !self.showDescriptions
      },
      /**
       * #action
       */
      setDisplayMode(val: string) {
        self.trackDisplayMode = val
      },
      /**
       * #action
       */
      setMaxHeight(val?: number) {
        self.trackMaxHeight = val
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Override featureUnderMouse to return the volatile feature
       * which is fetched asynchronously via CoreGetFeatureDetails
       */
      get featureUnderMouse() {
        return self.featureUnderMouseVolatile
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
         * #method
         */
        renderProps() {
          const superProps = superRenderProps()
          return {
            ...(superProps as Omit<typeof superProps, symbol>),
            config: self.rendererConfig,
            filters: new SerializableFilterChain({
              filters: self.activeFilters,
            }),
            sequenceAdapter: self.sequenceAdapter,
          }
        },

        /**
         * #method
         */
        renderingProps() {
          const superProps = superRenderingProps()
          const session = getSession(self)
          return {
            ...superProps,
            async onFeatureClick(_: unknown, featureId?: string) {
              const { rpcManager } = session
              const { parentTrack } = self
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
                      trackInstanceId: parentTrack.id,
                      rendererType: self.rendererTypeName,
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
            async onFeatureContextMenu(_: unknown, featureId?: string) {
              const { rpcManager } = session
              const { parentTrack } = self
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
                      trackInstanceId: parentTrack.id,
                      rendererType: self.rendererTypeName,
                    },
                  )) as { feature: SimpleFeatureSerialized | undefined }

                  if (isAlive(self) && feature) {
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
        trackMenuItems(): MenuItem[] {
          return [
            ...superTrackMenuItems(),
            {
              label: 'Show...',
              icon: VisibilityIcon,
              subMenu: [
                {
                  label: 'Show labels',
                  type: 'checkbox',
                  checked: self.showLabels,
                  onClick: () => {
                    self.toggleShowLabels()
                  },
                },
                {
                  label: 'Show descriptions',
                  type: 'checkbox',
                  checked: self.showDescriptions,
                  onClick: () => {
                    self.toggleShowDescriptions()
                  },
                },
              ],
            },
            {
              label: 'Display mode',
              icon: VisibilityIcon,
              subMenu: [
                'normal',
                'compact',
                'reducedRepresentation',
                'collapse',
              ].map(val => ({
                label: val,
                type: 'radio' as const,
                checked: self.displayMode === val,
                onClick: () => {
                  self.setDisplayMode(val)
                },
              })),
            },
            {
              label: 'Set max track height',
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
              label: 'Filters',
              subMenu: [
                {
                  label: 'Edit filters...',
                  onClick: () => {
                    getSession(self).queueDialog(handleClose => [
                      AddFiltersDialog,
                      {
                        model: self,
                        handleClose,
                      },
                    ])
                  },
                },
              ],
            },
          ]
        },
      }
    })
    .postProcessSnapshot(snap => {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (!snap) {
        return snap
      }
      const {
        trackShowLabels,
        trackShowDescriptions,
        trackDisplayMode,
        trackMaxHeight,
        jexlFilters,
        ...rest
      } = snap as Omit<typeof snap, symbol>
      return {
        ...rest,
        ...(trackShowLabels !== undefined ? { trackShowLabels } : {}),
        ...(trackShowDescriptions !== undefined
          ? { trackShowDescriptions }
          : {}),
        ...(trackDisplayMode !== undefined ? { trackDisplayMode } : {}),
        ...(trackMaxHeight !== undefined ? { trackMaxHeight } : {}),
        ...(jexlFilters?.length ? { jexlFilters } : {}),
      } as typeof snap
    })
}

export type LinearFeatureDisplayStateModel = ReturnType<
  typeof stateModelFactory
>
export type LinearFeatureDisplayModel = Instance<LinearFeatureDisplayStateModel>

export default stateModelFactory
