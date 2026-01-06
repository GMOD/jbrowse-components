import { AdapterType } from '@jbrowse/core/pluggableElementTypes'

import configSchema from './configSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function NcbiSequenceReportAliasAdapterF(
  pluginManager: PluginManager,
) {
  pluginManager.addAdapterType(() => {
    return new AdapterType({
      name: 'NcbiSequenceReportAliasAdapter',
      configSchema,
      getAdapterClass: () =>
        import('./NcbiSequenceReportAliasAdapter.ts').then(r => r.default),
      adapterMetadata: {
        hiddenFromGUI: true,
      },
    })
  })
}
