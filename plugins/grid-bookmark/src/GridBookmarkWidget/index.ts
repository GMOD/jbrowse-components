import { lazy } from 'react'

import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { WidgetType } from '@jbrowse/core/pluggableElementTypes'

import AddHighlightModelF from './components/Highlight/index.tsx'
import stateModelFactory from './model.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

const configSchema = ConfigurationSchema('GridBookmarkWidget', {})

export default function GridBookmarkWidgetF(pluginManager: PluginManager) {
  pluginManager.addWidgetType(() => {
    return new WidgetType({
      name: 'GridBookmarkWidget',
      heading: 'Bookmarked regions',
      configSchema,
      stateModel: stateModelFactory(pluginManager),
      ReactComponent: lazy(() => import('./components/GridBookmarkWidget.tsx')),
    })
  })
  AddHighlightModelF(pluginManager)
}
