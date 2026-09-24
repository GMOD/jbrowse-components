import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { WidgetType } from '@jbrowse/core/pluggableElementTypes'
import { lazyWithPreload } from '@jbrowse/core/util/lazyWithPreload'

import stateModelFactory from './model.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

const configSchema = ConfigurationSchema('AddTrackWidget', {})

export default function AddTrackWidgetF(pluginManager: PluginManager) {
  pluginManager.addWidgetType(() => {
    return new WidgetType({
      name: 'AddTrackWidget',
      heading: 'Add a track',
      configSchema,
      stateModel: stateModelFactory(pluginManager),
      ReactComponent: lazyWithPreload(
        () => import('./components/AddTrackWidget.tsx'),
      ),
    })
  })
}
