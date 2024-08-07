import { types } from 'mobx-state-tree'

import PluginManager from '@jbrowse/core/PluginManager'
import { AnyConfiguration } from '@jbrowse/core/configuration'
import { BaseSession } from '@jbrowse/product-core'
import { BaseAssemblyConfigSchema } from '@jbrowse/core/assemblyManager'

/**
 * #stateModel SessionAssembliesMixin
 * #category root
 */
export function SessionAssembliesMixin(
  pluginManager: PluginManager,
  assemblyConfigSchemasType: BaseAssemblyConfigSchema,
) {
  return types
    .model({
      /**
       * #property
       */
      sessionAssemblies: types.array(assemblyConfigSchemasType),
    })
    .actions(s => {
      const self = s as typeof s & BaseSession
      return {
        /**
         * #action
         */
        addSessionAssembly(conf: AnyConfiguration) {
          const asm = self.sessionAssemblies.find(f => f.name === conf.name)
          if (asm) {
            console.warn(`Assembly ${conf.name} already exists`)
            return asm
          }
          const length = self.sessionAssemblies.push(conf)
          return self.sessionAssemblies[length - 1]
        },

        /**
         * #action
         */
        removeSessionAssembly(assemblyName: string) {
          const elt = self.sessionAssemblies.find(a => a.name === assemblyName)
          if (elt) {
            self.sessionAssemblies.remove(elt)
          }
        },
      }
    })
}
