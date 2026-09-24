import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'

import configSchema from './configSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function GWASAdapterF(pluginManager: PluginManager) {
  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        name: 'GWASAdapter',
        displayName: 'GWAS adapter',
        configSchema,
        getAdapterClass: () => import('./GWASAdapter.ts').then(r => r.default),
      }),
  )
}
