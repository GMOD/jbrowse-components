import { ConfigurationSchema } from '@gmod/jbrowse-core/configuration'
import { BaseTrackConfig } from '@gmod/jbrowse-plugin-linear-genome-view'

export default pluginManager => {
  const alignmentsTrackConfigSchema = pluginManager.getTrackType(
    'AlignmentsTrack',
  ).configSchema
  const snpCoverageTrackConfigSchema = pluginManager.getTrackType(
    'SNPCoverageTrack',
  ).configSchema

  return ConfigurationSchema(
    'ComboTrack',
    {
      alignmentsTrack: alignmentsTrackConfigSchema,
      snpCoverageTrack: snpCoverageTrackConfigSchema,
    },
    { baseConfiguration: BaseTrackConfig, explicitlyTyped: true },
  )
}
