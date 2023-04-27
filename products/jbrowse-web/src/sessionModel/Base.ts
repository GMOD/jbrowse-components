import { Instance, getParent, types } from 'mobx-state-tree'

import PluginManager from '@jbrowse/core/PluginManager'
import { AnyConfigurationModel } from '@jbrowse/core/configuration'
import RpcManager from '@jbrowse/core/rpc/RpcManager'

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
      sessionTracks: types.array(
        pluginManager.pluggableConfigSchemaType('track'),
      ),
      /**
       * #property
       */
      sessionPlugins: types.array(types.frozen()),
    })
    .views(self => ({
      /**
       * #getter
       */
      get jbrowse() {
        return getParent<any>(self).jbrowse
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
      get rpcManager() {
        return self.jbrowse.rpcManager as RpcManager
      },
      /**
       * #getter
       */
      get configuration(): AnyConfigurationModel {
        return self.jbrowse.configuration
      },
      /**
       * #getter
       */
      get adminMode(): boolean {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return getParent<any>(self).adminMode
      },
      /**
       * #getter
       */
      get tracks(): AnyConfigurationModel[] {
        return [...self.sessionTracks, ...getParent<any>(self).jbrowse.tracks]
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
