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
import VisibilityIcon from '@material-ui/icons/Visibility'

// locals
import { BaseLinearDisplay } from '../BaseLinearDisplay'

const SetMaxHeightDlg = lazy(() => import('./components/SetMaxHeight'))

const stateModelFactory = (configSchema: AnyConfigurationSchemaType) =>
  types
    .compose(
      'LinearBasicDisplay',
      BaseLinearDisplay,
      types.model({
        type: types.literal('LinearBasicDisplay'),
        trackShowLabels: types.maybe(types.boolean),
        trackShowDescriptions: types.maybe(types.boolean),
        trackDisplayMode: types.maybe(types.string),
        trackMaxHeight: types.maybe(types.number),
        configuration: ConfigurationReference(configSchema),
      }),
    )
    .views(self => ({
      get rendererTypeName() {
        return getConf(self, ['renderer', 'type'])
      },

      get showLabels() {
        return self.trackShowLabels ?? getConf(self, ['renderer', 'showLabels'])
      },

      get showDescriptions() {
        return (
          self.trackShowDescriptions ??
          getConf(self, ['renderer', 'showDescriptions'])
        )
      },

      get maxHeight() {
        return self.trackMaxHeight ?? getConf(self, ['renderer', 'maxHeight'])
      },

      get displayMode() {
        const displayMode = getConf(self, ['renderer', 'displayMode'])
        return self.trackDisplayMode ?? displayMode
      },
      get rendererConfig() {
        const configBlob = getConf(self, ['renderer']) || {}

        return self.rendererType.configSchema.create(
          {
            ...configBlob,
            showLabels: this.showLabels,
            showDescriptions: this.showDescriptions,
            displayMode: this.displayMode,
            maxHeight: this.maxHeight,
          },
          getEnv(self),
        )
      },
    }))

    .actions(self => ({
      toggleShowLabels() {
        self.trackShowLabels = !self.showLabels
      },
      toggleShowDescriptions() {
        self.trackShowDescriptions = !self.showDescriptions
      },
      setDisplayMode(val: string) {
        self.trackDisplayMode = val
      },
      setMaxHeight(val: number) {
        self.trackMaxHeight = val
      },
    }))
    .views(self => {
      const {
        trackMenuItems: superTrackMenuItems,
        renderProps: superRenderProps,
      } = self
      return {
        renderProps() {
          const config = self.rendererConfig

          return {
            ...superRenderProps(),
            config,
          }
        },

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
              onClick: () => self.toggleShowDescriptions(),
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

export type FeatureTrackStateModel = ReturnType<typeof stateModelFactory>
export type FeatureTrackModel = Instance<FeatureTrackStateModel>

export default stateModelFactory
