import stateModelFactory, { HierarchicalTrackSelectorModel } from './model'
import configSchema from './configSchema'
import PluginManager from '@jbrowse/core/PluginManager'
import { WidgetType } from '@jbrowse/core/pluggableElementTypes'
import { lazy } from 'react'

export { stateModelFactory, configSchema }
export type { HierarchicalTrackSelectorModel }

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
