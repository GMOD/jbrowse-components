import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { baseLinearDisplayConfigSchema } from '@jbrowse/plugin-linear-genome-view'
import PluginManager from '@jbrowse/core/PluginManager'

/**
 * #config LinearAlignmentsDisplay
 * has a "pileup" sub-display, where you can see individual reads and a
 * quantitative "snpcoverage" sub-display track showing SNP frequencies
 */
function configModelFactory(pm: PluginManager) {
  return ConfigurationSchema(
    'LinearAlignmentsDisplay',
    {
      /**
       * #slot
       */
      pileupDisplay: {
        type: 'frozen',
        defaultValue: null,
      },

      /**
       * #slot
       */
      snpCoverageDisplay: pm.getDisplayType('LinearSNPCoverageDisplay')
        .configSchema,
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

export default configModelFactory
