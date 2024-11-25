import { lazy } from 'react'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { WidgetType } from '@jbrowse/core/pluggableElementTypes'

import stateModelFactory from './model'
import type PluginManager from '@jbrowse/core/PluginManager'
const configSchema = ConfigurationSchema('AddTrackWidget', {})

export default function AddTrackWidgetF(pluginManager: PluginManager) {
  pluginManager.addWidgetType(() => {
    return new WidgetType({
      name: 'AddTrackWidget',
      heading: 'Add a track',
      configSchema,
      stateModel: stateModelFactory(pluginManager),
      ReactComponent: lazy(() => import('./components/AddTrackWidget')),
    })
  })
}
