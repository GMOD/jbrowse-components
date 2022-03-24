import { lazy } from 'react'
import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
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
        const showLabels = getConf(self, ['renderer', 'showLabels'])
        return self.trackShowLabels !== undefined
          ? self.trackShowLabels
          : showLabels
      },

      get showDescriptions() {
        const showDescriptions = getConf(self, ['renderer', 'showLabels'])
        return self.trackShowDescriptions !== undefined
          ? self.trackShowDescriptions
          : showDescriptions
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
