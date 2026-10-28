import type PluginManager from '@jbrowse/core/PluginManager'
import type { BaseAssemblyConfigSchema } from '@jbrowse/core/assemblyManager/assemblyConfigSchema'
import type { IAnyType } from '@jbrowse/mobx-state-tree'

/**
 * A session model factory taking the root's assembly config schema, so the
 * session's assembly slots are the same type the root's are.
 *
 * @deprecated each app root now types its `sessionModelFactory` as its own
 * product's factory, which keeps the session's type; this erases it.
 */
export type SessionModelFactory = (args: {
  pluginManager: PluginManager
  assemblyConfigSchema: BaseAssemblyConfigSchema
}) => IAnyType
