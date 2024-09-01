import PluginManager from '@jbrowse/core/PluginManager'

export function getLowerPanelDisplays(pluginManager: PluginManager) {
  return (
    pluginManager
      .getDisplayElements()
      // @ts-expect-error
      .filter(f => f.subDisplay?.type === 'LinearAlignmentsDisplay')
      // @ts-expect-error
      .filter(f => f.subDisplay?.lowerPanel)
  )
}
