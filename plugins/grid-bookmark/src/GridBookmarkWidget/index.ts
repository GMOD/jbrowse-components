import { lazy } from 'react'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { WidgetType } from '@jbrowse/core/pluggableElementTypes'
import stateModelFactory from './model'
import PluginManager from '@jbrowse/core/PluginManager'

const configSchema = ConfigurationSchema('GridBookmarkWidget', {})

export default (pluginManager: PluginManager) => {
  pluginManager.addWidgetType(() => {
    return new WidgetType({
      name: 'GridBookmarkWidget',
      heading: 'Bookmarked regions',
      configSchema,
      stateModel: stateModelFactory(pluginManager),
      ReactComponent: lazy(() => import('./components/GridBookmarkWidget')),
    })
  })
}
