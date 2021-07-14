import { lazy } from 'react'
import WidgetType from '@jbrowse/core/pluggableElementTypes/WidgetType'
import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'

import {
  stateModelFactory as GridBookmarkStateModelFactory,
  configSchema as GridBookmarkConfigSchema,
} from './GridBookmarkWidget'

export default class extends Plugin {
  name = 'GridBookmarkPlugin'

  install(pluginManager: PluginManager) {
    pluginManager.addWidgetType(() => {
      return new WidgetType({
        name: 'GridBookmarkWidget',
        heading: 'Bookmarked regions',
        configSchema: GridBookmarkConfigSchema,
        stateModel: GridBookmarkStateModelFactory(pluginManager),
        ReactComponent: lazy(
          () => import('./GridBookmarkWidget/components/GridBookmarkWidget'),
        ),
      })
    })
  }

  configure(pluginManager: PluginManager) {}
}
