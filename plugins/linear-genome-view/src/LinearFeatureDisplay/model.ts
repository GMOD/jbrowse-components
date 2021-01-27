import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { getParentRenderProps } from '@jbrowse/core/util/tracks'
import { MenuItem } from '@jbrowse/core/ui'
import VisibilityIcon from '@material-ui/icons/Visibility'
import { types, Instance } from 'mobx-state-tree'
import { AnyConfigurationSchemaType } from '@jbrowse/core/configuration/configurationSchema'
import { BaseLinearDisplay } from '../BaseLinearDisplay'

const stateModelFactory = (configSchema: AnyConfigurationSchemaType) =>
  types
    .compose(
      'LinearFeatureDisplay',
      BaseLinearDisplay,
      types.model({
        type: types.literal('LinearFeatureDisplay'),
        trackShowLabels: types.maybe(types.boolean),
        trackDisplayMode: types.maybe(types.string),
        configuration: ConfigurationReference(configSchema),
      }),
    )
    .views(self => ({
      get rendererTypeName() {
        return getConf(self, ['renderer', 'type'])
      },

      get showLabels() {
        const showLabels = getConf(self, ['renderer', 'showLabels'])
        return self.trackShowLabels !== undefined
          ? self.trackShowLabels
          : showLabels
      },

      get displayMode() {
        const displayMode = getConf(self, ['renderer', 'displayMode'])
        return self.trackDisplayMode !== undefined
          ? self.trackDisplayMode
          : displayMode
      },
      get rendererConfig() {
        const configBlob =
          getConf(self, ['renderers', this.rendererTypeName]) || {}

        return self.rendererType.configSchema.create({
          ...configBlob,
          showLabels: this.showLabels,
          displayMode: this.displayMode,
        })
      },
    }))

    .actions(self => ({
      toggleShowLabels() {
        self.trackShowLabels = !self.showLabels
      },
      setDisplayMode(val: string) {
        self.trackDisplayMode = val
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
