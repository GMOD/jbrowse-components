import { AdapterType } from '@jbrowse/core/pluggableElementTypes'

import configSchema from './configSchema'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function GtfAdapterF(pluginManager: PluginManager) {
  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        name: 'GtfAdapter',
        displayName: 'GTF adapter',
        configSchema,
        getAdapterClass: () => import('./GtfAdapter').then(r => r.default),
      }),
  )
}
