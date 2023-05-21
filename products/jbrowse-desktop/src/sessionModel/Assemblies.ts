import { Instance, types } from 'mobx-state-tree'

import PluginManager from '@jbrowse/core/PluginManager'
import { AnyConfigurationModel } from '@jbrowse/core/configuration'
import { BaseSessionModel } from '@jbrowse/product-core'
import { TemporaryAssembliesMixin } from '@jbrowse/app-core'

/**
 * #stateModel DesktopSessionAssembliesModel
 */
export function DesktopSessionAssembliesModel(
  pluginManager: PluginManager,
  assemblyConfigSchemasType = types.frozen(),
) {
  return types
    .compose(
      BaseSessionModel(pluginManager),
      TemporaryAssembliesMixin(pluginManager, assemblyConfigSchemasType),
    )

    .views(self => ({
      /**
       * #getter
       */
      get assemblyNames(): string[] {
        return self.jbrowse.assemblyNames
      },
      /**
       * #getter
       */
      get assemblyManager() {
        return self.root.assemblyManager
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      addAssemblyConf(assemblyConf: AnyConfigurationModel) {
        return self.jbrowse.addAssemblyConf(assemblyConf)
      },
    }))
}
