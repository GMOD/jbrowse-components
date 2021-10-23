import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { baseLinearDisplayConfigSchema } from '@jbrowse/plugin-linear-genome-view'
import PluginManager from '@jbrowse/core/PluginManager'

const configModelFactory = (pluginManager: PluginManager) => {
  const PileupDisplayConfigSchema = pluginManager.getDisplayType(
    'LinearPileupDisplay',
  ).configSchema
  const SNPCoverageDisplayConfigSchema = pluginManager.getDisplayType(
    'LinearSNPCoverageDisplay',
  ).configSchema

  return ConfigurationSchema(
    'LinearAlignmentsDisplay',
    {
      pileupDisplay: PileupDisplayConfigSchema,
      snpCoverageDisplay: SNPCoverageDisplayConfigSchema,
    },
    { baseConfiguration: baseLinearDisplayConfigSchema, explicitlyTyped: true },
  )
}

export type AlignmentsConfigModel = ReturnType<typeof configModelFactory>
export default configModelFactory
