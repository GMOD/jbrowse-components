import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'

import configSchema from './configSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function LdmatAdapterF(pluginManager: PluginManager) {
  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        name: 'LdmatAdapter',
        displayName: 'ldmat HDF5 adapter',
        configSchema,
        adapterMetadata: {
          category: 'Linkage disequilibrium',
          description:
            'Adapter for LD matrices in ldmat HDF5 format (https://github.com/G2Lab/ldmat)',
        },
        getAdapterClass: () =>
          import('./LdmatAdapter.ts').then(r => r.default),
      }),
  )
}
