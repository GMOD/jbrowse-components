import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { getParentRenderProps } from '@jbrowse/core/util/tracks'
import { MenuItem } from '@jbrowse/core/ui'
import { basicTrackStateModelFactory } from '@jbrowse/plugin-linear-genome-view'
import VisibilityIcon from '@material-ui/icons/Visibility'

import { types, Instance } from 'mobx-state-tree'
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
      const { trackMenuItems } = self
      return {
        get renderProps() {
          const config = self.rendererType.configSchema.create({
            ...getConf(self, 'renderer'),
            displayMode: self.displayMode,
            showLabels: self.showLabels,
          })
          return {
            ...self.composedRenderProps,
            ...getParentRenderProps(self),
            config,
          }
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
      }
    })

export type FeatureTrackStateModel = ReturnType<typeof stateModelFactory>
export type FeatureTrackModel = Instance<FeatureTrackStateModel>

export default stateModelFactory
