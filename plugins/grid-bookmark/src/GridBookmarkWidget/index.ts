import { lazy } from 'react'

import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { WidgetType } from '@jbrowse/core/pluggableElementTypes'

import stateModelFactory from './model.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

const configSchema = ConfigurationSchema('GridBookmarkWidget', {})

export default function GridBookmarkWidgetF(pluginManager: PluginManager) {
  pluginManager.addWidgetType(() => {
    return new WidgetType({
      name: 'GridBookmarkWidget',
      heading: 'Highlights',
      configSchema,
      stateModel: stateModelFactory(pluginManager),
      ReactComponent: lazy(() => import('./components/GridBookmarkWidget.tsx')),
    })
  })
}
