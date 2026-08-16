import type PluginManager from '@jbrowse/core/PluginManager'
import type { BaseAssemblyConfigSchema } from '@jbrowse/core/assemblyManager/assemblyConfigSchema'
import type { IAnyType } from '@jbrowse/mobx-state-tree'

/**
 * What each app product's root model takes as its `sessionModelFactory`
 * argument: the root builds the assembly config schema once and hands it to the
 * session model, so the session's assembly slots are the same type the root's
 * are rather than a second schema built from the same plugins.
 *
 * One name for the three roots that take it (web, desktop, react-app). They had
 * a copy each, and two of them spelled the schema as a local
 * `ReturnType<typeof assemblyConfigSchemaFactory>` alias — which is what
 * `BaseAssemblyConfigSchema` already is.
 */
export type SessionModelFactory = (args: {
  pluginManager: PluginManager
  assemblyConfigSchema: BaseAssemblyConfigSchema
}) => IAnyType
