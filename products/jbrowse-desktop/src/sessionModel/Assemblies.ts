import { Instance, types } from 'mobx-state-tree'

import PluginManager from '@jbrowse/core/PluginManager'
import { AnyConfigurationModel } from '@jbrowse/core/configuration'
import { Base } from '@jbrowse/product-core/src/Session'

/**
 * #stateModel JBrowseDesktopSessionAssembliesModel
 */
export default function Assemblies(
  pluginManager: PluginManager,
  assemblyConfigSchemasType = types.frozen(),
) {
  return Base(pluginManager)
    .props({
      /**
       * #property
       */
      sessionAssemblies: types.array(assemblyConfigSchemasType),
      /**
       * #property
       */
      temporaryAssemblies: types.array(assemblyConfigSchemasType),
    })
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
      addAssembly(assemblyConfig: Instance<typeof assemblyConfigSchemasType>) {
        self.sessionAssemblies.push(assemblyConfig)
      },

      /**
       * #action
       */
      removeAssembly(assemblyName: string) {
        const index = self.sessionAssemblies.findIndex(
          asm => asm.name === assemblyName,
        )
        if (index !== -1) {
          self.sessionAssemblies.splice(index, 1)
        }
      },

      /**
       * #action
       */
      removeTemporaryAssembly(assemblyName: string) {
        const index = self.temporaryAssemblies.findIndex(
          asm => asm.name === assemblyName,
        )
        if (index !== -1) {
          self.temporaryAssemblies.splice(index, 1)
        }
      },

      /**
       * #action
       * used for read vs ref type assemblies
       */
      addTemporaryAssembly(assemblyConfig: AnyConfigurationModel) {
        const asm = self.sessionAssemblies.find(
          f => f.name === assemblyConfig.name,
        )
        if (asm) {
          console.warn(`Assembly ${assemblyConfig.name} was already existing`)
          return asm
        }
        const length = self.temporaryAssemblies.push(assemblyConfig)
        return self.temporaryAssemblies[length - 1]
      },

      /**
       * #action
       */
      addAssemblyConf(assemblyConf: AnyConfigurationModel) {
        return self.jbrowse.addAssemblyConf(assemblyConf)
      },
    }))
}
