import { types } from '@jbrowse/mobx-state-tree'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { BaseAssemblyConfigSchema } from '@jbrowse/core/assemblyManager'
import type { AnyConfiguration } from '@jbrowse/core/configuration'
import type { BaseSession } from '@jbrowse/product-core'

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
        addAssembly(conf: AnyConfiguration) {
          if (self.adminMode) {
            self.jbrowse.addAssemblyConf(conf)
          } else {
            this.addSessionAssembly(conf)
          }
        },

        /**
         * #action
         */
        removeAssembly(name: string) {
          if (self.adminMode) {
            self.jbrowse.removeAssemblyConf(name)
          } else {
            this.removeSessionAssembly(name)
          }
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
    .postProcessSnapshot(snap => {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (!snap) {
        return snap
      }
      const { sessionAssemblies, ...rest } = snap as Omit<typeof snap, symbol>
      return {
        ...rest,
        ...(sessionAssemblies.length ? { sessionAssemblies } : {}),
      } as typeof snap
    })
}
