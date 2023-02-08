import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { baseLinearDisplayConfigSchema } from '@jbrowse/plugin-linear-genome-view'
import PluginManager from '@jbrowse/core/PluginManager'

/**
 * #config LinearAlignmentsDisplay
 * has a "pileup" sub-display, where you can see individual reads and a
 * quantitative "snpcoverage" sub-display track showing SNP frequencies
 */
export default function configModelFactory(pm: PluginManager) {
  return ConfigurationSchema(
    'LinearAlignmentsDisplay',
    {
      /**
       * #slot
       */
      pileupDisplay: pm.getDisplayType('LinearPileupDisplay').configSchema,

      /**
       * #slot
       */
      snpCoverageDisplay: pm.getDisplayType('LinearSNPCoverageDisplay')
        .configSchema,

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
