import { ConfigurationSchema } from '@jbrowse/core/configuration'
import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function GWASAdapterF(pluginManager: PluginManager) {
  pluginManager.addAdapterType(() => {
    const res = pluginManager.getAdapterType('BedTabixAdapter')
    /**
     * #config GWASAdapter
     * #category adapter
     * adapter for GWAS results files; a BedTabixAdapter with `scoreColumn`
     * defaulted to `neg_log_pvalue` so files load with a sensible Manhattan
     * plot score out of the box
     */
    const configSchema = ConfigurationSchema(
      'GWASAdapter',
      {
        /**
         * #slot
         */
        scoreColumn: {
          type: 'string',
          description: 'BED column to read as the Manhattan plot score',
          defaultValue: 'neg_log_pvalue',
        },
      },
      {
        /**
         * #baseConfiguration
         */
        baseConfiguration: res.configSchema,
        explicitlyTyped: true,
      },
    )
    return new AdapterType({
      name: 'GWASAdapter',
      displayName: 'GWAS adapter',
      configSchema,
      // No GWAS-specific parsing: reuse BedTabixAdapter's class as-is, only the
      // config defaults above differ.
      getAdapterClass: res.getAdapterClass,
    })
  })
}
