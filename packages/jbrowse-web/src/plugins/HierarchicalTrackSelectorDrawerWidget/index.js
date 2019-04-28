import { lazy } from 'react'
import { ConfigurationSchema } from '@gmod/jbrowse-core/configuration'
import Plugin from '@gmod/jbrowse-core/Plugin'
import DrawerWidgetType from '@gmod/jbrowse-core/pluggableElementTypes/DrawerWidgetType'
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
        {},
        // TODO: Implement these configs
        // {
        //   allCollapsed: {
        //     type: 'boolean',
        //     defaultValue: false,
        //   },
        //   allExpanded: {
        //     type: 'boolean',
        //     defaultValue: false,
        //   },
        // },
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
