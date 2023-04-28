import shortid from 'shortid'

import type PluginManager from '@jbrowse/core/PluginManager'
import { Instance, getParent, types } from 'mobx-state-tree'
import { RootModel } from '../RootModel'
import { AnyConfigurationModel } from '@jbrowse/core/configuration'
import { BaseAssemblyConfigSchema } from '@jbrowse/core/assemblyManager'

/** base session shared by **all** JBrowse products. Be careful what you include here, everything will use it. */
export default function BaseSession(pluginManager: PluginManager) {
  return types
    .model({
      /**
       * #property
       */
      id: types.optional(types.identifier, shortid()),
      /**
       * #property
       */
      name: types.identifier,
    })
    .volatile(() => ({
      /**
       * #volatile
       * this is the globally "selected" object. can be anything.
       * code that wants to deal with this should examine it to see what
       * kind of thing it is.
       */
      selection: undefined as unknown,
    }))
    .views(self => ({
      get root() {
        return getParent<RootModel>(self)
      },
      /**
       * #getter
       */
      get jbrowse() {
        return this.root.jbrowse
      },
      /**
       * #getter
       */
      get rpcManager() {
        return this.root.rpcManager
      },
      /**
       * #getter
       */
      get configuration(): AnyConfigurationModel {
        return this.jbrowse.configuration
      },

      get adminMode() {
        return this.root.adminMode
      },
      /**
       * #getter
       */
      get assemblies(): Instance<BaseAssemblyConfigSchema>[] {
        return this.jbrowse.assemblies
      },
      /**
       * #getter
       */
      get textSearchManager() {
        return this.root.textSearchManager
      },
      /**
       * #getter
       */
      get history() {
        return self.root.history
      },
      /**
       * #getter
       */
      get menus() {
        return self.root.menus
      },
    }))
}
