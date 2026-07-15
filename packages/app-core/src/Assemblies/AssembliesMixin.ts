import { readConfObject } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'
import { asSession } from '@jbrowse/product-core'

import type PluginManager from '@jbrowse/core/PluginManager'
import type {
  BaseAssemblyConfigModel,
  BaseAssemblyConfigSchema,
} from '@jbrowse/core/assemblyManager'
import type { AnyConfiguration } from '@jbrowse/core/configuration'

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
      sessionAssemblies: types.stripDefault(
        types.array(assemblyConfigSchemasType),
        [],
      ),
      /**
       * #property
       */
      temporaryAssemblies: types.stripDefault(
        types.array(assemblyConfigSchemasType),
        [],
      ),
    })
    .actions(s => {
      const self = asSession(s)
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
    .views(s => {
      const self = asSession(s)
      return {
        /**
         * #getter
         * sessionAssemblies plus jbrowse config assemblies. Does not include
         * temporaryAssemblies; this is the list shown in the AssemblySelector
         * dropdown.
         */
        get assemblies(): BaseAssemblyConfigModel[] {
          return [...self.jbrowse.assemblies, ...self.sessionAssemblies]
        },
      }
    })
    .views(self => ({
      /**
       * #getter
       * names of the assemblies returned by the `assemblies` getter
       */
      get assemblyNames(): string[] {
        return self.assemblies.map(a => readConfObject(a, 'name'))
      },
    }))
}
