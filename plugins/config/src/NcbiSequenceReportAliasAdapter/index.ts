import { AdapterType } from '@jbrowse/core/pluggableElementTypes'
import PluginManager from '@jbrowse/core/PluginManager'

import configSchema from './configSchema'

export default function NcbiSequenceReportAliasAdapterF(
  pluginManager: PluginManager,
) {
  pluginManager.addAdapterType(() => {
    return new AdapterType({
      name: 'NcbiSequenceReportAliasAdapter',
      configSchema,
      getAdapterClass: () =>
        import('./NcbiSequenceReportAliasAdapter').then(r => r.default),
      adapterMetadata: {
        hiddenFromGUI: true,
      },
    })
  })
}
