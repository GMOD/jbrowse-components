import { types } from '@jbrowse/mobx-state-tree'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { BaseAssemblyConfigSchema } from '@jbrowse/core/assemblyManager'
import type { AnyConfiguration } from '@jbrowse/core/configuration'
import type { BaseSession } from '@jbrowse/product-core'

/**
 * #stateModel AssembliesMixin
 * #category root
 *
 * Adds `sessionAssemblies` (admin-aware, persisted-with-session assemblies) and
 * `temporaryAssemblies` (used for ad-hoc read-vs-ref style assemblies).
 */
export function AssembliesMixin(
  _pluginManager: PluginManager,
  assemblyConfigSchemasType: BaseAssemblyConfigSchema,
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

        /**
         * #action
         * used for read vs ref type assemblies.
         */
        addTemporaryAssembly(conf: AnyConfiguration) {
          const asm = self.temporaryAssemblies.find(f => f.name === conf.name)
          if (asm) {
            console.warn(`Assembly ${conf.name} already exists`)
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
      }
    })
    .postProcessSnapshot(snap => {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (!snap) {
        return snap
      }
      const { sessionAssemblies, temporaryAssemblies, ...rest } = snap as Omit<
        typeof snap,
        symbol
      >
      return {
        ...rest,
        ...(sessionAssemblies.length ? { sessionAssemblies } : {}),
        ...(temporaryAssemblies.length ? { temporaryAssemblies } : {}),
      } as typeof snap
    })
}
