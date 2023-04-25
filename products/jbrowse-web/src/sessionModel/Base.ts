import { Instance, getParent, types } from 'mobx-state-tree'
import shortid from 'shortid'

import PluginManager from '@jbrowse/core/PluginManager'

export function BaseSession(pluginManager: PluginManager) {
  const BaseSession = types
    .model({
      /**
       * #property
       */
      id: types.optional(types.identifier, shortid()),
      /**
       * #property
       */
      name: types.string,
      /**
       * #property
       */
      margin: 0,
      /**
       * #property
       */
      views: types.array(pluginManager.pluggableMstType('view', 'stateModel')),
      /**
       * #property
       */
      widgets: types.map(
        pluginManager.pluggableMstType('widget', 'stateModel'),
      ),
      /**
       * #property
       */
      activeWidgets: types.map(
        types.safeReference(
          pluginManager.pluggableMstType('widget', 'stateModel'),
        ),
      ),
      /**
       * #property
       */
      sessionTracks: types.array(
        pluginManager.pluggableConfigSchemaType('track'),
      ),

      /**
       * #property
       */
      sessionPlugins: types.array(types.frozen()),
      /**
       * #property
       */
      minimized: types.optional(types.boolean, false),
    })
    .views(self => ({
      /**
       * #getter
       */
      get adminMode(): boolean {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return getParent<any>(self).adminMode
      },
    }))
  return BaseSession
}

export type BaseSessionModel = Instance<ReturnType<typeof BaseSession>>
