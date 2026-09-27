import { DERIVES_FROM_SEQUENCE } from '@jbrowse/core/data_adapters/dataAdapterCache'
import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'

import configSchema from './configSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function CrisprGuideAdapterF(pluginManager: PluginManager) {
  pluginManager.addAdapterType(() => {
    return new AdapterType({
      name: 'CrisprGuideAdapter',
      adapterCapabilities: [DERIVES_FROM_SEQUENCE],
      displayName: 'CRISPR guide RNA adapter',
      adapterMetadata: {
        hiddenFromGUI: true,
      },
      configSchema,
      getAdapterClass: () =>
        import('./CrisprGuideAdapter.ts').then(r => r.default),
    })
  })
}
