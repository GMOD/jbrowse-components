import {
  ConfigurationReference,
  getConf,
  readConfObject,
} from '@jbrowse/core/configuration'
import { MenuItem } from '@jbrowse/core/ui'
import VisibilityIcon from '@material-ui/icons/Visibility'
import { basicTrackStateModelFactory } from '@jbrowse/plugin-linear-genome-view'

import { types, getSnapshot, Instance } from 'mobx-state-tree'
import { AnyConfigurationSchemaType } from '@jbrowse/core/configuration/configurationSchema'

const stateModelFactory = (configSchema: AnyConfigurationSchemaType) =>
  types
    .compose(
      'FeatureTrack',
      basicTrackStateModelFactory(configSchema),
      types.model({
        type: types.literal('FeatureTrack'),
        showLabels: types.optional(types.boolean, true),
        displayMode: types.optional(types.string, 'normal'),
        configuration: ConfigurationReference(configSchema),
      }),
    )
    .actions(self => ({
      toggleShowLabels() {
        self.showLabels = !self.showLabels
      },
      setDisplayMode(val: string) {
        self.displayMode = val
      },
    }))
    .views(self => {
      const { trackMenuItems, renderProps } = self
      return {
        get newConf() {
          return self.rendererType.configSchema.create({
            showLabels: self.showLabels,
            displayMode: self.displayMode,
            ...getSnapshot(renderProps.config),
          })
        },
        get trackMenuItems(): MenuItem[] {
          const displayModes = [
            'compact',
            'reducedRepresentation',
            'normal',
            'collapse',
          ]
          return [
            ...trackMenuItems,
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
              label: 'Display mode',
              icon: VisibilityIcon,
              subMenu: displayModes.map(val => ({
                label: val,
                onClick: () => {
                  self.setDisplayMode(val)
                },
              })),
            },
          ]
        },
        get renderProps() {
          return {
            ...renderProps,
            config: this.newConf,
          }
        },
      }
    })

export type FeatureTrackStateModel = ReturnType<typeof stateModelFactory>
export type FeatureTrackModel = Instance<FeatureTrackStateModel>

export default stateModelFactory
