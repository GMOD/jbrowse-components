import shortid from 'shortid'

import type PluginManager from '@jbrowse/core/PluginManager'
import { getParent, types } from 'mobx-state-tree'
import { RootModel } from '../RootModel'
import { AnyConfigurationModel } from '@jbrowse/core/configuration'

/** base session shared by **all** JBrowse products. Be careful what you include here, everything will use it. */
export default function BaseSession(
  pluginManager: PluginManager,
  defaultAdminMode = true,
) {
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
       * Boolean indicating whether the session is in admin mode or not
       */
      adminMode: defaultAdminMode,
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
        return this.jbrowse.rpcManager
      },
      /**
       * #getter
       */
      get configuration(): AnyConfigurationModel {
        return this.jbrowse.configuration
      },
    }))
}
