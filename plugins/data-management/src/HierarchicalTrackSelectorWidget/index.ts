import { WidgetType } from '@jbrowse/core/pluggableElementTypes'
import { lazyWithPreload } from '@jbrowse/core/util/lazyWithPreload'

import configSchema from './configSchema.ts'
import stateModelFactory from './model.ts'

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
      ReactComponent: lazyWithPreload(
        () => import('./components/HierarchicalTrackSelector.tsx'),
      ),
    })
  })
}

export {
  type HierarchicalTrackSelectorModel,
  default as stateModelFactory,
} from './model.ts'
export { default as configSchema } from './configSchema.ts'
