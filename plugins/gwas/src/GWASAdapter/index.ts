import { ConfigurationSchema } from '@jbrowse/core/configuration'
import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function GWASAdapterF(pluginManager: PluginManager) {
  pluginManager.addAdapterType(() => {
    const res = pluginManager.getAdapterType('BedTabixAdapter')!
    const configSchema = ConfigurationSchema(
      'GWASAdapter',
      {},
      { baseConfiguration: res.configSchema, explicitlyTyped: true },
    )
    return new AdapterType({
      name: 'GWASAdapter',
      displayName: 'GWAS adapter',
      configSchema,
      getAdapterClass: res.getAdapterClass,
    })
  })
}
