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
        // the format list guesses only `.txt.gz` as GWAS, so a bgzipped BED
        // or TSV of results is offered this reading beside BedTabixAdapter's
        adapterMetadata: { alsoReads: /\.(bed|tsv)\.b?gz$/i },
        getAdapterClass: () => import('./GWASAdapter.ts').then(r => r.default),
      }),
  )
}
