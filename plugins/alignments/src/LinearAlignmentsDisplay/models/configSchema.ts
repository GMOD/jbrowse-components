import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { baseLinearDisplayConfigSchema } from '@jbrowse/plugin-linear-genome-view'
import PluginManager from '@jbrowse/core/PluginManager'

/**
 * !config LinearAlignmentsDisplay
 * has a "pileup" sub-display, where you can see individual reads and a
 * quantitative "snpcoverage" sub-display track showing SNP frequencies
 */
const configModelFactory = (pluginManager: PluginManager) => {
  return ConfigurationSchema(
    'LinearAlignmentsDisplay',
    {
      /**
       * !slot
       */
      pileupDisplay: pluginManager.getDisplayType('LinearPileupDisplay')
        .configSchema,
      /**
       * !slot
       */
      snpCoverageDisplay: pluginManager.getDisplayType(
        'LinearSNPCoverageDisplay',
      ).configSchema,
    },
    {
      /**
       * !baseConfiguration
       */
      baseConfiguration: baseLinearDisplayConfigSchema,
      explicitlyTyped: true,
    },
  )
}

export type AlignmentsConfigModel = ReturnType<typeof configModelFactory>
export default configModelFactory
