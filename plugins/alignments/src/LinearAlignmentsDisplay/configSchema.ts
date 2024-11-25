import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { baseLinearDisplayConfigSchema } from '@jbrowse/plugin-linear-genome-view'
import type PluginManager from '@jbrowse/core/PluginManager'

/**
 * #config LinearAlignmentsDisplay
 * has a "pileup" sub-display, where you can see individual reads and a
 * quantitative "snpcoverage" sub-display track showing SNP frequencies
 * extends
 * - [BaseLinearDisplay](../baselineardisplay)
 */
export default function configModelFactory(pluginManager: PluginManager) {
  return ConfigurationSchema(
    'LinearAlignmentsDisplay',
    {
      /**
       * #slot
       */
      pileupDisplay: pluginManager.getDisplayType('LinearPileupDisplay')!
        .configSchema,

      /**
       * #slot
       */
      snpCoverageDisplay: pluginManager.getDisplayType(
        'LinearSNPCoverageDisplay',
      )!.configSchema,

      /**
       * #slot
       */
      height: {
        type: 'number',
        defaultValue: 250,
      },
    },
    {
      /**
       * #baseConfiguration
       */
      baseConfiguration: baseLinearDisplayConfigSchema,
      explicitlyTyped: true,
    },
  )
}
