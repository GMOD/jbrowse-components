import { types } from 'mobx-state-tree'

import PluginManager from '@jbrowse/core/PluginManager'
import {
  AnyConfiguration,
  AnyConfigurationModel,
  readConfObject,
} from '@jbrowse/core/configuration'
import { BaseSession } from '@jbrowse/product-core/src/Session/Base'

/**
 * #stateModel JBrowseWebSessionAssembliesMixin
 * #category root
 */
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
    .views(s => {
      const self = s as typeof s & BaseSession
      return {
        /**
         * #getter
         */
        get assemblies(): AnyConfigurationModel[] {
          return self.jbrowse.assemblies
        },
        /**
         * #getter
         */
        get assemblyNames(): string[] {
          const { assemblyNames } = self.jbrowse
          const sessionAssemblyNames = self.sessionAssemblies.map(assembly =>
            readConfObject(assembly, 'name'),
          )
          return [...assemblyNames, ...sessionAssemblyNames]
        },
        /**
         * #getter
         */
        get assemblyManager() {
          return self.root.assemblyManager
        },
      }
    })
    .actions(s => {
      const self = s as typeof s & BaseSession
      return {
        /**
         * #action
         */
        addAssembly(conf: AnyConfiguration) {
          const asm = self.sessionAssemblies.find(f => f.name === conf.name)
          if (asm) {
            console.warn(`Assembly ${conf.name} was already existing`)
            return asm
          }
          const length = self.sessionAssemblies.push(conf)
          return self.sessionAssemblies[length - 1]
        },

        /**
         * #action
         * used for read vs ref type assemblies.
         */
        addTemporaryAssembly(conf: AnyConfiguration) {
          const asm = self.sessionAssemblies.find(f => f.name === conf.name)
          if (asm) {
            console.warn(`Assembly ${conf.name} was already existing`)
            return asm
          }
          const length = self.temporaryAssemblies.push(conf)
          return self.temporaryAssemblies[length - 1]
        },

        /**
         * #action
         */
        addAssemblyConf(assemblyConf: AnyConfiguration) {
          return self.jbrowse.addAssemblyConf(assemblyConf)
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
      }
    })
}
