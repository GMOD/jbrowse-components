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
    .views(s => {
      const self = asSession(s)
      return {
        /**
         * #method
         * The assembly config already carrying `name`, from any of the three
         * arrays the assemblyManager draws on, or undefined.
         *
         * One namespace, because `name` is the assembly config's MST
         * identifier: a second config carrying a name one of the others
         * already has doesn't fail at the add, it makes every
         * `assembly.configuration` safeReference in the manager ambiguous, and
         * MST then throws on every read of one — inside the manager's own
         * autorun and inside `assemblyNameMap`, which takes the session down.
         * So each add path checks all three, not just the array it pushes to.
         */
        findAssemblyConf(name: unknown): BaseAssemblyConfigModel | undefined {
          return [
            ...self.jbrowse.assemblies,
            ...self.sessionAssemblies,
            ...self.temporaryAssemblies,
          ].find(f => f.name === name)
        },
      }
    })
    .actions(s => {
      const self = asSession(s)
      return {
        /**
         * #action
         */
        addSessionAssembly(conf: AnyConfiguration) {
          const asm = self.findAssemblyConf(conf.name)
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
          // checked here rather than left to jbrowse.addAssemblyConf, which
          // sees only its own array: in admin mode the name still has to clear
          // the session-scoped arrays as well
          const asm = self.findAssemblyConf(conf.name)
          if (asm) {
            console.warn(`Assembly ${conf.name} already exists`)
            return
          }
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
          const asm = self.findAssemblyConf(conf.name)
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
