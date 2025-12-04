import { types } from '@jbrowse/mobx-state-tree'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfiguration } from '@jbrowse/core/configuration'

/**
 * #stateModel TemporaryAssembliesMixin
 * #category root
 */
export function TemporaryAssembliesMixin(
  _pluginManager: PluginManager,
  assemblyConfigSchemasType = types.frozen(),
) {
  return types
    .model({
      /**
       * #property
       */
      temporaryAssemblies: types.array(assemblyConfigSchemasType),
    })
    .actions(self => ({
      /**
       * #action
       * used for read vs ref type assemblies.
       */
      addTemporaryAssembly(conf: AnyConfiguration) {
        const asm = self.temporaryAssemblies.find(f => f.name === conf.name)
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
      removeTemporaryAssembly(name: string) {
        const elt = self.temporaryAssemblies.find(a => a.name === name)
        if (elt) {
          self.temporaryAssemblies.remove(elt)
        }
      },
    }))
}
