import Plugin from '@jbrowse/core/Plugin'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { WidgetType } from '@jbrowse/core/pluggableElementTypes'
import { lazyWithPreload } from '@jbrowse/core/util/lazyWithPreload'
import { ElementId } from '@jbrowse/core/util/types/mst'
import { types } from '@jbrowse/mobx-state-tree'

import type PluginManager from '@jbrowse/core/PluginManager'

export const configSchema = ConfigurationSchema('SessionManager', {})

export const stateModel = types.model('SessionManager', {
  id: ElementId,
  type: types.literal('SessionManager'),
})

// The "Sessions" widget. Here rather than in app-core because only jbrowse-web
// has the autosave database it lists.
export default class SessionManagerPlugin extends Plugin {
  name = 'SessionManagerPlugin'

  install(pluginManager: PluginManager) {
    pluginManager.addWidgetType(
      () =>
        new WidgetType({
          name: 'SessionManager',
          discardOnClose: true,
          heading: 'Sessions',
          configSchema,
          stateModel,
          ReactComponent: lazyWithPreload(
            () => import('./components/SessionManager.tsx'),
          ),
        }),
    )
  }
}
