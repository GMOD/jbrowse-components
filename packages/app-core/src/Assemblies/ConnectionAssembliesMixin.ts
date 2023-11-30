import { types } from 'mobx-state-tree'

import PluginManager from '@jbrowse/core/PluginManager'
import { AnyConfiguration } from '@jbrowse/core/configuration'
import { BaseSession } from '@jbrowse/product-core'
import { BaseAssemblyConfigSchema } from '@jbrowse/core/assemblyManager'

/**
 * #stateModel ConnectionAssembliesMixin
 * #category root
 */
export function ConnectionAssembliesMixin(
  pluginManager: PluginManager,
  assemblyConfigSchemasType: BaseAssemblyConfigSchema,
) {
  return types
    .model({
      /**
       * #property
       */
      connectionAssemblies: types.array(assemblyConfigSchemasType),
    })
    .actions(s => {
      const self = s as typeof s & BaseSession
      return {
        /**
         * #action
         */
        addConnectionAssembly(conf: AnyConfiguration) {
          const asm = self.connectionAssemblies.find(f => f.name === conf.name)
          if (asm) {
            console.warn(`Assembly ${conf.name} already exists`)
            return asm
          }
          const length = self.connectionAssemblies.push(conf)
          return self.connectionAssemblies[length - 1]
        },

        /**
         * #action
         */
        removeConnectionAssembly(assemblyName: string) {
          const elt = self.connectionAssemblies.find(
            a => a.name === assemblyName,
          )
          if (elt) {
            self.connectionAssemblies.remove(elt)
          }
        },
      }
    })
}
