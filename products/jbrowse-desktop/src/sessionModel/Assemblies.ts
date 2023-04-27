import { Instance, getParent, types } from 'mobx-state-tree'

import PluginManager from '@jbrowse/core/PluginManager'
import { AnyConfigurationModel } from '@jbrowse/core/configuration'
import { RootModel } from '../rootModel'

export default function Assemblies(
  pluginManager: PluginManager,
  assemblyConfigSchemasType = types.frozen(),
) {
  return types
    .model({
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
      get assemblies(): AnyConfigurationModel[] {
        return getParent<RootModel>(self).jbrowse.assemblies
      },
      /**
       * #getter
       */
      get assemblyNames(): string[] {
        return getParent<RootModel>(self).jbrowse.assemblyNames
      },
      /**
       * #getter
       */
      get assemblyManager() {
        return getParent<any>(self).assemblyManager
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
      addAssemblyConf(assemblyConf: any) {
        return getParent<any>(self).jbrowse.addAssemblyConf(assemblyConf)
      },
    }))
}
