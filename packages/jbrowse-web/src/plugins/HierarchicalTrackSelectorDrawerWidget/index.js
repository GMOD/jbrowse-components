import { lazy } from 'react'
import { ConfigurationSchema } from '../../configuration'
import Plugin, { DrawerWidgetType } from '../../Plugin'
import HierarchicalTrackSelModelFactory from './model'

const HierarchicalSelector = lazy(() =>
  import('./components/HierarchicalTrackSelector'),
)

export default class HierarchicalTrackSelectorDrawerWidget extends Plugin {
  install(pluginManager) {
    pluginManager.addDrawerWidgetType(() => {
      const stateModel = HierarchicalTrackSelModelFactory(pluginManager)

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
        heading: 'Available Tracks',
        configSchema,
        stateModel,
        LazyReactComponent: HierarchicalSelector,
      })
    })
  }
}
