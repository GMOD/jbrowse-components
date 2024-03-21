import { lazy } from 'react'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { WidgetType } from '@jbrowse/core/pluggableElementTypes'
import PluginManager from '@jbrowse/core/PluginManager'

// locals
import stateModelFactory from './model'
import AddHighlightModelF from './components/Highlight'

const configSchema = ConfigurationSchema('GridBookmarkWidget', {})

export default (pluginManager: PluginManager) => {
  pluginManager.addWidgetType(() => {
    return new WidgetType({
      ReactComponent: lazy(() => import('./components/GridBookmarkWidget')),
      configSchema,
      heading: 'Bookmarked regions',
      name: 'GridBookmarkWidget',
      stateModel: stateModelFactory(pluginManager),
    })
  })
  AddHighlightModelF(pluginManager)
}
