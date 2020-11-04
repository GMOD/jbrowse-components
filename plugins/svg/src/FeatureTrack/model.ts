import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { MenuItem } from '@jbrowse/core/ui'
import VisibilityIcon from '@material-ui/icons/Visibility'
import { basicTrackStateModelFactory } from '@jbrowse/plugin-linear-genome-view'

import { types, Instance } from 'mobx-state-tree'
import { AnyConfigurationSchemaType } from '@jbrowse/core/configuration/configurationSchema'

const stateModelFactory = (configSchema: AnyConfigurationSchemaType) =>
  types
    .compose(
      'FeatureTrack',
      basicTrackStateModelFactory(configSchema),
      types
        .model({
          type: types.literal('FeatureTrack'),
          showLabels: types.maybe(types.boolean, true),
          displayMode: types.maybe(types.string, 'normal'),
          configuration: ConfigurationReference(configSchema),
        })
        .volatile(() => ({
          // avoid circular reference since FeatureTrackComponent receives this model
        })),
    )
    .actions(self => ({
      setShowLabels(val: boolean) {
        self.showLabels = val
      },
      setDisplayMode(val: string) {
        self.displayMode = val
      },
    }))
    .views(self => {
      const { trackMenuItems } = self
      return {
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
              onClick: val => {
                self.setShowLabels(val)
              },
            },
            // {
            //   label: 'Display mode',
            //   icon: VisibilityIcon,
            //   type: 'checkbox',
            //   subMenu: [
            //     {
            //       'label': 'Compact',
            //       onClick: () => {
            //         self.setDisplayMode
            //       }

            //     },

            //   ]
            //   onClick: self.toggleCoverage,
            //   checked: self.showCoverage,
            // },
          ]
        },
      }
    })

export type FeatureTrackStateModel = ReturnType<typeof stateModelFactory>
export type FeatureTrackModel = Instance<FeatureTrackStateModel>

export default stateModelFactory
