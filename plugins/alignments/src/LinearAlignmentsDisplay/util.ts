import type PluginManager from '@jbrowse/core/PluginManager'

export function getLowerPanelDisplays(pluginManager: PluginManager) {
  return pluginManager
    .getDisplayElements()
    .filter(f => f.subDisplay?.type === 'LinearAlignmentsDisplay')
    .filter(f => f.subDisplay?.lowerPanel)
}
