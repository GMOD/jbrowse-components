import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { TrackRowAdornment } from '@jbrowse/core/ui/trackRowAdornment'
import type { AbstractSessionModel } from '@jbrowse/core/util'

export type { TrackRowAdornment }

/**
 * Ask the loaded plugins whether this track's row should say more than its
 * name. Resolved once per track where the tree's sources are assembled, not per
 * keystroke and not per render.
 */
export function trackRowAdornmentFor({
  conf,
  session,
  pluginManager,
  viewAssemblyNames,
}: {
  conf: AnyConfigurationModel
  session: AbstractSessionModel
  pluginManager: PluginManager
  viewAssemblyNames: string[]
}) {
  return pluginManager.evaluateExtensionPoint(
    /** #extensionPoint TrackSelector-trackRowAdornment | sync | Add a glyph, a short suffix and a tooltip line to a track's row in the hierarchical track selector */
    'TrackSelector-trackRowAdornment',
    undefined,
    { conf, session, viewAssemblyNames },
  )
}
