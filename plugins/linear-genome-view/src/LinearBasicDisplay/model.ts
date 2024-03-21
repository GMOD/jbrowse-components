import { lazy } from 'react'
import {
  getConf,
  ConfigurationReference,
  AnyConfigurationSchemaType,
} from '@jbrowse/core/configuration'
import { getSession } from '@jbrowse/core/util'
import { MenuItem } from '@jbrowse/core/ui'
import { types, getEnv, Instance } from 'mobx-state-tree'

// icons
import VisibilityIcon from '@mui/icons-material/Visibility'

// locals
import { BaseLinearDisplay } from '../BaseLinearDisplay'

const SetMaxHeightDialog = lazy(() => import('./components/SetMaxHeight'))

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
        configuration: ConfigurationReference(configSchema),

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
        trackShowDescriptions: types.maybe(types.boolean),

        /**
         * #property
         */
        trackShowLabels: types.maybe(types.boolean),

        /**
         * #property
         */
        type: types.literal('LinearBasicDisplay'),
      }),
    )
    .views(self => ({
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
      get maxHeight() {
        return self.trackMaxHeight ?? getConf(self, ['renderer', 'maxHeight'])
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
      get showDescriptions() {
        return (
          self.trackShowDescriptions ??
          getConf(self, ['renderer', 'showDescriptions'])
        )
      },

      /**
       * #getter
       */
      get showLabels() {
        return self.trackShowLabels ?? getConf(self, ['renderer', 'showLabels'])
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
            displayMode: self.displayMode,
            maxHeight: self.maxHeight,
            showDescriptions: self.showDescriptions,
            showLabels: self.showLabels,
          },
          getEnv(self),
        )
      },
    }))

    .actions(self => ({
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

      /**
       * #action
       */
      toggleShowDescriptions() {
        self.trackShowDescriptions = !self.showDescriptions
      },

      /**
       * #action
       */
      toggleShowLabels() {
        self.trackShowLabels = !self.showLabels
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
          const config = self.rendererConfig
          const superProps = superRenderProps()
          const superPropsOmit = superProps as Omit<typeof superProps, symbol>
          return {
            ...superPropsOmit,
            config,
          }
        },

        /**
         * #method
         */
        trackMenuItems(): MenuItem[] {
          return [
            ...superTrackMenuItems(),
            {
              checked: self.showLabels,
              icon: VisibilityIcon,
              label: 'Show labels',
              onClick: () => self.toggleShowLabels(),
              type: 'checkbox',
            },
            {
              checked: self.showDescriptions,
              icon: VisibilityIcon,
              label: 'Show descriptions',
              onClick: () => self.toggleShowDescriptions(),
              type: 'checkbox',
            },
            {
              icon: VisibilityIcon,
              label: 'Display mode',
              subMenu: [
                'compact',
                'reducedRepresentation',
                'normal',
                'collapse',
              ].map(val => ({
                label: val,
                onClick: () => self.setDisplayMode(val),
              })),
            },
            {
              label: 'Set max height',
              onClick: () => {
                getSession(self).queueDialog(handleClose => [
                  SetMaxHeightDialog,
                  { handleClose, model: self },
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
