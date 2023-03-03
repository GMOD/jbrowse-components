import stateModelFactory from './model'
import configSchema from './configSchema'
import PluginManager from '@jbrowse/core/PluginManager'
import { WidgetType } from '@jbrowse/core/pluggableElementTypes'
import { lazy } from 'react'

export default (pluginManager: PluginManager) => {
  pluginManager.addWidgetType(() => {
    return new WidgetType({
      name: 'HierarchicalTrackSelectorWidget',
      heading: 'Available tracks',
      configSchema,
      stateModel: stateModelFactory(pluginManager),
      ReactComponent: lazy(
        () => import('./components/HierarchicalTrackSelector'),
      ),
    })
  })
}

export {
  type HierarchicalTrackSelectorModel,
  default as stateModelFactory,
} from './model'
export { default as configSchema } from './configSchema'
