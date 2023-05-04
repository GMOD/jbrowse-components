import shortid from 'shortid'

import type PluginManager from '@jbrowse/core/PluginManager'
import { Instance, getParent, types } from 'mobx-state-tree'
import { BaseRootModelType } from '../RootModel'
import { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import { BaseAssemblyConfigSchema } from '@jbrowse/core/assemblyManager'

/** base session shared by **all** JBrowse products. Be careful what you include here, everything will use it. */
export default function BaseSession<
  ROOT_MODEL_TYPE extends BaseRootModelType = BaseRootModelType,
  JB_CONFIG_SCHEMA extends AnyConfigurationSchemaType = AnyConfigurationSchemaType,
>(pluginManager: PluginManager) {
  return types
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
        return getParent<ROOT_MODEL_TYPE>(self)
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
      get configuration(): Instance<JB_CONFIG_SCHEMA> {
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
      get version() {
        return this.root.version
      },
    }))
    .actions(self => ({
      /**
       * #action
       * set the global selection, i.e. the globally-selected object.
       * can be a feature, a view, just about anything
       * @param thing -
       */
      setSelection(thing: unknown) {
        self.selection = thing
      },

      /**
       * #action
       * clears the global selection
       */
      clearSelection() {
        self.selection = undefined
      },
    }))
}

export type BaseSessionType = ReturnType<typeof BaseSession>
