import { lazy } from 'react'
import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { getParentRenderProps } from '@jbrowse/core/util/tracks'
import { getSession } from '@jbrowse/core/util'
import { MenuItem } from '@jbrowse/core/ui'
import VisibilityIcon from '@material-ui/icons/Visibility'
import { types, getEnv, Instance } from 'mobx-state-tree'
import { AnyConfigurationSchemaType } from '@jbrowse/core/configuration/configurationSchema'
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
        const showLabels = getConf(self, ['renderer', 'showLabels'])
        return self.trackShowLabels !== undefined
          ? self.trackShowLabels
          : showLabels
      },

      get maxHeight() {
        const maxHeight = getConf(self, ['renderer', 'maxHeight'])
        return self.trackMaxHeight !== undefined
          ? self.trackMaxHeight
          : maxHeight
      },

      get displayMode() {
        const displayMode = getConf(self, ['renderer', 'displayMode'])
        return self.trackDisplayMode !== undefined
          ? self.trackDisplayMode
          : displayMode
      },
      get rendererConfig() {
        const configBlob = getConf(self, ['renderer']) || {}

        return self.rendererType.configSchema.create(
          {
            ...configBlob,
            showLabels: this.showLabels,
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
      setDisplayMode(val: string) {
        self.trackDisplayMode = val
      },
      setMaxHeight(val: number) {
        self.trackMaxHeight = val
      },
    }))
    .views(self => {
      const { trackMenuItems } = self
      return {
        get renderProps() {
          const config = self.rendererConfig

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
            {
              label: 'Set max height',
              onClick: () => {
                getSession(self).setDialogComponent(SetMaxHeightDlg, {
                  model: self,
                })
              },
            },
          ]
        },
      }
    })

export type FeatureTrackStateModel = ReturnType<typeof stateModelFactory>
export type FeatureTrackModel = Instance<FeatureTrackStateModel>

export default stateModelFactory
