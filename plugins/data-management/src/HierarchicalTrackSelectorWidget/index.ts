import { lazy } from 'react'
import { WidgetType } from '@jbrowse/core/pluggableElementTypes'
import configSchema from './configSchema'
import stateModelFactory from './model'
import type PluginManager from '@jbrowse/core/PluginManager'

export default function HierarchicalTrackSelectorWidgetF(
  pluginManager: PluginManager,
) {
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
