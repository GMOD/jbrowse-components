import { types } from '@jbrowse/mobx-state-tree'
import {
  MultipleViewsSessionMixin,
  PreferencesSessionMixin,
  ReferenceManagementSessionMixin,
  SessionTracksManagerSessionMixin,
  ThemeManagerSessionMixin,
} from '@jbrowse/product-core'

import { AssembliesMixin } from '../Assemblies/index.ts'
import { WorkspaceLayoutMixin } from '../WorkspaceLayout/index.ts'
import { AppSessionMixin } from './AppSessionMixin.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { BaseAssemblyConfigSchema } from '@jbrowse/core/assemblyManager'

/**
 * #stateModel AppSessionModel
 *
 * The session every full app (desktop, web, react-app) is built on: views in
 * a workspace layout, session tracks and assemblies, theme and preferences.
 * Each product composes its own connections and track-menu mixins onto it.
 */
export function AppSessionModel({
  pluginManager,
  assemblyConfigSchema,
}: {
  pluginManager: PluginManager
  assemblyConfigSchema: BaseAssemblyConfigSchema
}) {
  return types.compose(
    'AppSessionModel',
    ReferenceManagementSessionMixin(pluginManager),
    ThemeManagerSessionMixin(pluginManager),
    MultipleViewsSessionMixin(pluginManager),
    PreferencesSessionMixin(pluginManager),
    SessionTracksManagerSessionMixin(pluginManager),
    AssembliesMixin(assemblyConfigSchema),
    AppSessionMixin(),
    WorkspaceLayoutMixin(),
  )
}
