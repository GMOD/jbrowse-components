import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'
import configSchema from './configSchema'
import type PluginManager from '@jbrowse/core/PluginManager'

export default function BigWigAdapterF(pluginManager: PluginManager) {
  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        name: 'BigWigAdapter',
        displayName: 'BigWig adapter',
        configSchema,
        adapterCapabilities: [
          'hasResolution',
          'hasLocalStats',
          'hasGlobalStats',
        ],
        getAdapterClass: () => import('./BigWigAdapter').then(r => r.default),
      }),
  )
}
