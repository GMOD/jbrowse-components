import { types } from 'mobx-state-tree'
import HierarchicalSelector from './components/HierarchicalTrackSelector'
import { ConfigurationSchema } from '../../configuration'
import Plugin, { DrawerWidgetType } from '../../Plugin'

const stateModel = types.compose(
  'HierarchicalTrackSelectorDrawerWidget',
  types.model({
    type: types.literal('HierarchicalTrackSelectorDrawerWidget'),
  }),
)

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
        ReactComponent: HierarchicalSelector,
      })
    })
  }
}
