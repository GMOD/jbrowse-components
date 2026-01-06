import { AdapterType } from '@jbrowse/core/pluggableElementTypes'

import configSchema from './configSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function HicAdapterF(pluginManager: PluginManager) {
  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        name: 'HicAdapter',
        displayName: 'Hi-C adapter',
        configSchema,
        getAdapterClass: () => import('./HicAdapter.ts').then(r => r.default),
      }),
  )
}
