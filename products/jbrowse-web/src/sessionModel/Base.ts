import { Instance, types } from 'mobx-state-tree'

import PluginManager from '@jbrowse/core/PluginManager'
import { AnyConfigurationModel } from '@jbrowse/core/configuration'

import { Session as CoreSession } from '@jbrowse/product-core'

export function BaseSession(pluginManager: PluginManager) {
  const BaseSession = CoreSession.Base(pluginManager)
    .props({
      /**
       * #property
       */
      margin: 0,
      
      /**
       * #property
       */
      sessionPlugins: types.array(types.frozen()),
    })
    .views(self => ({
      /**
       * #getter
       */
      get tracks(): AnyConfigurationModel[] {
        return [...self.sessionTracks, ...self.jbrowse.tracks]
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      setName(str: string) {
        self.name = str
      },
    }))
  return BaseSession
}

export type BaseSessionModel = Instance<ReturnType<typeof BaseSession>>
