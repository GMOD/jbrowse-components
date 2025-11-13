import { lazy } from 'react'

import { ConfigurationReference, getConf, readConfObject } from '@jbrowse/core/configuration'
import SerializableFilterChain from '@jbrowse/core/pluggableElementTypes/renderers/util/serializableFilterChain'
import { getSession } from '@jbrowse/core/util'
import VisibilityIcon from '@mui/icons-material/Visibility'
import { cast, getEnv, getParent, types } from 'mobx-state-tree'

import { BaseLinearDisplay } from '../BaseLinearDisplay'

import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { MenuItem } from '@jbrowse/core/ui'
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
        configuration: ConfigurationReference(configSchema),
        /**
         * #property
         */
        jexlFilters: types.maybe(types.array(types.string)),
      }),
    )
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
          try {
            // Get assembly names from the parent track's configuration
            const track = getParent(self, 2) as any
            if (track && track.configuration) {
              const assemblyNames = readConfObject(track.configuration, 'assemblyNames') as string[]
              console.log('[LinearBasicDisplay] assemblyNames from track:', assemblyNames)

              if (assemblyNames && assemblyNames.length > 0) {
                const assembly = assemblyManager.get(assemblyNames[0])
                if (assembly) {
                  // Get the sequence adapter config and ensure it's a plain object
                  const adapterConfig = getConf(assembly, ['sequence', 'adapter'])
                  sequenceAdapter = adapterConfig
                  console.log('[LinearBasicDisplay] Got sequenceAdapter:', sequenceAdapter)
                } else {
                  console.warn('[LinearBasicDisplay] No assembly found for:', assemblyNames[0])
                }
              }
            } else {
              console.warn('[LinearBasicDisplay] Could not get parent track')
            }
          } catch (e) {
            // If we can't get the assembly, just continue without sequenceAdapter
            console.warn('[LinearBasicDisplay] Could not get assembly sequence adapter:', e)
          }

          return {
            ...(superProps as Omit<typeof superProps, symbol>),
            config: self.rendererConfig,
            filters: new SerializableFilterChain({
              filters: self.activeFilters,
            }),
            sequenceAdapter,
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
}

export type FeatureTrackStateModel = ReturnType<typeof stateModelFactory>
export type FeatureTrackModel = Instance<FeatureTrackStateModel>

export default stateModelFactory
