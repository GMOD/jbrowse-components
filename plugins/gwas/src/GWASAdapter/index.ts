import { ConfigurationSchema } from '@jbrowse/core/configuration'
import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function GWASAdapterF(pluginManager: PluginManager) {
  pluginManager.addAdapterType(() => {
    const res = pluginManager.getAdapterType('BedTabixAdapter')!
    // Override `scoreColumn` default from BedTabix's empty-string default so
    // GWAS files load with a sensible score column out of the box — without
    // this, accepting defaults yields NaN scores from the un-named BED-score
    // column.
    const configSchema = ConfigurationSchema(
      'GWASAdapter',
      {
        scoreColumn: {
          type: 'string',
          description: 'BED column to read as the Manhattan plot score',
          defaultValue: 'neg_log_pvalue',
        },
      },
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
