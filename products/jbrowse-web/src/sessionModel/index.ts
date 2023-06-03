import { AbstractSessionModel } from '@jbrowse/core/util/types'
import { Instance } from 'mobx-state-tree'
import PluginManager from '@jbrowse/core/PluginManager'
import { BaseAssemblyConfigSchema } from '@jbrowse/core/assemblyManager'
import { BaseWebSession } from '@jbrowse/web-core'

/**
 * #stateModel JBrowseWebSessionModel
 * composed of
 * - SnackbarModel
 * - ReferenceManagementSessionMixin
 * - DrawerWidgetSessionMixin
 * - DialogQueueSessionMixin
 * - ThemeManagerSessionMixin
 * - MultipleViewsSessionMixin
 * - SessionTracksManagerSessionMixin
 * - SessionAssembliesMixin
 * - TemporaryAssembliesMixin
 * - WebSessionConnectionsMixin
 */
export default function sessionModelFactory({
  pluginManager,
  assemblyConfigSchema,
}: {
  pluginManager: PluginManager
  assemblyConfigSchema: BaseAssemblyConfigSchema
}) {
  return BaseWebSession({ pluginManager, assemblyConfigSchema })
}

export type WebSessionModelType = ReturnType<typeof sessionModelFactory>
export type WebSessionModel = Instance<WebSessionModelType>

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function z(x: Instance<WebSessionModelType>): AbstractSessionModel {
  // this function's sole purpose is to get typescript to check
  // that the session model implements all of AbstractSessionModel
  return x
}
