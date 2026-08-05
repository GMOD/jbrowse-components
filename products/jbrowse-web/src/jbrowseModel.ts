import { JBrowseModelF } from '@jbrowse/app-core'
import { stripBaseUris } from '@jbrowse/core/util/addRelativeUris'
import { getSnapshot, resolveIdentifier, types } from '@jbrowse/mobx-state-tree'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'

// The devtools console pair for window.JBrowseSession/JBrowseRootModel: with
// these you can `getSnapshot(JBrowseSession)` or resolve a config by id from a
// running instance, which is the fastest way to inspect real state. Nothing in
// the repo imports them, so they read as dead to a grep — they are used by hand,
// and by anyone debugging a deployed build. Don't remove them on that evidence.
window.getSnapshot = getSnapshot
window.resolveIdentifier = resolveIdentifier

/**
 * #stateModel JBrowseWebConfigModel
 * #internal thin product wrapper that declares no members of its own — the
 * documented surface is AppCoreJBrowseModel, so this gets no website page
 * #category root
 * the rootModel.jbrowse state model for JBrowse Web
 */
export default function JBrowseWeb({
  pluginManager,
  assemblyConfigSchema,
}: {
  pluginManager: PluginManager
  assemblyConfigSchema: AnyConfigurationSchemaType
}) {
  return types.snapshotProcessor(
    JBrowseModelF({
      pluginManager,
      assemblyConfigSchema,
    }),
    {
      // strip the synthetic baseUri keys added by addRelativeUris when
      // serializing config back out (e.g. for the admin "Save config" flow)
      postProcessor(snapshot) {
        return stripBaseUris(structuredClone(snapshot))
      },
    },
  )
}
