import React from 'react'
import { types } from 'mobx-state-tree'
import { ConfigurationSchema } from '../../configuration'
import Plugin, { DrawerWidgetType } from '../../Plugin'

const HierarchicalSelector = React.lazy(() =>
  import('./components/HierarchicalTrackSelector'),
)

const stateModel = types.compose(
  'HierarchicalTrackSelectorDrawerWidget',
  types.model({
    id: types.identifier,
    type: types.literal('HierarchicalTrackSelectorDrawerWidget'),
  }),
)

export default class HierarchicalTrackSelectorDrawerWidget extends Plugin {
  install(pluginManager) {
    pluginManager.addDrawerWidgetType(() => {
      const configSchema = ConfigurationSchema(
        'HierarchicalTrackSelectorDrawerWidget',
        {
          allCollapsed: {
            type: 'boolean',
            defaultValue: false,
          },
          allExpanded: {
            type: 'boolean',
            defaultValue: true,
          },
        },
      )

      return new DrawerWidgetType({
        name: 'HierarchicalTrackSelectorDrawerWidget',
        configSchema,
        stateModel,
        LazyReactComponent: HierarchicalSelector,
      })
    })
  }
}
