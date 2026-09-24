import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { WidgetType } from '@jbrowse/core/pluggableElementTypes'
import { lazyWithPreload } from '@jbrowse/core/util/lazyWithPreload'

import stateModel from './model.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

const configSchema = ConfigurationSchema('AddConnectionWidget', {})

export default function AddConnectionWidgetF(pluginManager: PluginManager) {
  pluginManager.addWidgetType(() => {
    return new WidgetType({
      name: 'AddConnectionWidget',
      heading: 'Add a connection',
      configSchema,
      stateModel,
      ReactComponent: lazyWithPreload(
        () => import('./components/AddConnectionWidget.tsx'),
      ),
    })
  })
}
