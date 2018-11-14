import { types } from 'mobx-state-tree'
import HierarchicalSelector from './components/HierarchicalSelector'
import { ConfigurationSchema } from '../../configuration'

const stateModel = types.model({
  // ... state for the hierarchical track selector
})

export default class HierarchicalTrackSelectorDrawerWidget extends Plugin {
  install(pluginManager) {
    pluginManager.addDrawerWidgetType(() => {
      const configSchema = ConfigurationSchema(
        'HierarchicalTrackSelectorDrawerWidget',
        {
          // .. define the configuration schema here
        },
      )

      return new DrawerWidgetType({
        name: 'HierarchicalTrackSelectorDrawerWidget',
        configSchema,
        stateModel,
        RenderingComponent: HierarchicalSelector,
      })
    })
  }
}
