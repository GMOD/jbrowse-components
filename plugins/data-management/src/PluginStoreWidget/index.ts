import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { WidgetType } from '@jbrowse/core/pluggableElementTypes'
import { lazyWithPreload } from '@jbrowse/core/util/lazyWithPreload'

import stateModelFactory from './model.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

const configSchema = ConfigurationSchema('PluginStoreWidget', {})

export default function PluginStoreWidgetF(pluginManager: PluginManager) {
  pluginManager.addWidgetType(() => {
    return new WidgetType({
      name: 'PluginStoreWidget',
      heading: 'Plugin store',
      configSchema,
      stateModel: stateModelFactory(pluginManager),
      ReactComponent: lazyWithPreload(
        () => import('./components/PluginStoreWidget.tsx'),
      ),
    })
  })
}
