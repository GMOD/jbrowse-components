import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { baseLinearDisplayConfigSchema } from '@jbrowse/plugin-linear-genome-view'
import PluginManager from '@jbrowse/core/PluginManager'

/**
 * #config LinearAlignmentsDisplay
 * has a "pileup" sub-display, where you can see individual reads and a
 * quantitative "snpcoverage" sub-display track showing SNP frequencies
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

const configModelFactory = (pm: PluginManager) => {
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

export type AlignmentsConfigModel = ReturnType<typeof configModelFactory>
export default configModelFactory
