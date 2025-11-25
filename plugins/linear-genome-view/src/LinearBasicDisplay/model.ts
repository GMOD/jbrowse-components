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
  getSession,
} from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import VisibilityIcon from '@mui/icons-material/Visibility'
import { autorun } from 'mobx'
import {
  addDisposer,
  cast,
  getEnv,
  getParent,
  isAlive,
  types,
} from 'mobx-state-tree'

import { BaseLinearDisplay } from '../BaseLinearDisplay'

import type {
  AnyConfigurationModel,
  AnyConfigurationSchemaType,
} from '@jbrowse/core/configuration'
import type { MenuItem } from '@jbrowse/core/ui'
import type { Feature, SimpleFeatureSerialized } from '@jbrowse/core/util'
import type { Instance } from 'mobx-state-tree'

const SetMaxHeightDialog = lazy(() => import('./components/SetMaxHeightDialog'))
const AddFiltersDialog = lazy(() => import('./components/AddFiltersDialog'))

/**
 * #stateModel LinearBasicDisplay
 * #category display
 * used by `FeatureTrack`, has simple settings like "show/hide feature labels",
 * etc.
 *
 * extends
 * - [BaseLinearDisplay](../baselineardisplay)
 */
function stateModelFactory(configSchema: AnyConfigurationSchemaType) {
  return types
    .compose(
      'LinearBasicDisplay',
      BaseLinearDisplay,
      types.model({
        /**
         * #property
         */
        type: types.literal('LinearBasicDisplay'),
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
        trackShowSubfeatureLabels: types.maybe(types.boolean),
        /**
         * #property
         */
        trackSubfeatureLabelPosition: types.maybe(types.string),
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

      /**
       * #getter
       */
      get showSubfeatureLabels() {
        return (
          self.trackShowSubfeatureLabels ??
          getConf(self, ['renderer', 'showSubfeatureLabels'])
        )
      },

      /**
       * #getter
       */
      get subfeatureLabelPosition() {
        return (
          self.trackSubfeatureLabelPosition ??
          getConf(self, ['renderer', 'subfeatureLabelPosition'])
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

        return self.rendererType.configSchema.create(
          {
            ...config,
            showLabels: self.showLabels,
            showDescriptions: self.showDescriptions,
            showSubfeatureLabels: self.showSubfeatureLabels,
            subfeatureLabelPosition: self.subfeatureLabelPosition,
            displayMode: self.displayMode,
            maxHeight: self.maxHeight,
          },
          getEnv(self),
        )
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
      toggleShowSubfeatureLabels() {
        self.trackShowSubfeatureLabels = !self.showSubfeatureLabels
      },
      /**
       * #action
       */
      setSubfeatureLabelPosition(val: string) {
        self.trackSubfeatureLabelPosition = val
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
      } = self
      return {
        /**
         * #method
         */
        renderProps() {
          const superProps = superRenderProps()
          const session = getSession(self)
          const { assemblyManager } = session

          // Get the assembly's sequenceAdapter configuration
          let sequenceAdapter
          // Get assembly names from the parent track's configuration
          const track = getParent<{ configuration: AnyConfigurationModel }>(
            self,
            2,
          )
          const assemblyNames = readConfObject(
            track.configuration,
            'assemblyNames',
          ) as string[]

          const assembly = assemblyManager.get(assemblyNames[0]!)
          if (assembly) {
            // Get the sequence adapter config and ensure it's a plain object
            const adapterConfig = getConf(assembly, ['sequence', 'adapter'])
            sequenceAdapter = adapterConfig
          } else {
            console.warn('No assembly found for:', assemblyNames[0])
          }

          return {
            ...(superProps as Omit<typeof superProps, symbol>),
            config: self.rendererConfig,
            filters: new SerializableFilterChain({
              filters: self.activeFilters,
            }),
            sequenceAdapter,
            // Override onFeatureClick to use CoreGetFeatureDetails This avoids
            // heavy serialization overhead from webworker
            async onFeatureClick(_: unknown, featureId?: string) {
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
            // Override onFeatureContextMenu to use CoreGetFeatureDetails
            async onFeatureContextMenu(_: unknown, featureId?: string) {
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
              label: 'Show labels',
              icon: VisibilityIcon,
              type: 'checkbox',
              checked: self.showLabels,
              onClick: () => {
                self.toggleShowLabels()
              },
            },
            {
              label: 'Show descriptions',
              icon: VisibilityIcon,
              type: 'checkbox',
              checked: self.showDescriptions,
              onClick: () => {
                self.toggleShowDescriptions()
              },
            },
            {
              label: 'Show subfeature labels',
              icon: VisibilityIcon,
              type: 'checkbox',
              checked: self.showSubfeatureLabels,
              onClick: () => {
                self.toggleShowSubfeatureLabels()
              },
            },
            {
              label: 'Subfeature label position',
              icon: VisibilityIcon,
              subMenu: ['below', 'overlay'].map(val => ({
                label: val,
                type: 'radio' as const,
                checked: self.subfeatureLabelPosition === val,
                onClick: () => {
                  self.setSubfeatureLabelPosition(val)
                },
              })),
            },
            {
              label: 'Display mode',
              icon: VisibilityIcon,
              subMenu: [
                'compact',
                'reducedRepresentation',
                'normal',
                'collapse',
              ].map(val => ({
                label: val,
                onClick: () => {
                  self.setDisplayMode(val)
                },
              })),
            },
            {
              label: 'Set max height',
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
              label: 'Edit filters',
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
          ]
        },
      }
    })
    .actions(self => ({
      afterAttach() {
        // Autorun synchronizes featureUnderMouse with featureIdUnderMouse
        // asynchronously. This is needed because we don't serialize all
        // features from the renderer over RPC to avoid overhead
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
                      rendererType: self.rendererTypeName,
                    },
                  )) as { feature: SimpleFeatureSerialized | undefined }

                  // Check featureIdUnderMouse is still the same as the
                  // feature.id that was returned e.g. that the user hasn't
                  // moused over to a new position during the async operation
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
}

export type FeatureTrackStateModel = ReturnType<typeof stateModelFactory>
export type FeatureTrackModel = Instance<FeatureTrackStateModel>

export default stateModelFactory
