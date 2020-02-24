import { ConfigurationSchema } from '@gmod/jbrowse-core/configuration'
import { BaseTrackConfig } from '@gmod/jbrowse-plugin-linear-genome-view'

export default pluginManager => {
  const pileupTrackConfigSchema = pluginManager.getTrackType('PileupTrack')
    .configSchema
  const snpCoverageTrackConfigSchema = pluginManager.getTrackType(
    'SNPCoverageTrack',
  ).configSchema

  return ConfigurationSchema(
    'ComboTrack',
    {
      pileupTrackConfig: pileupTrackConfigSchema,
      snpCoverageTrackConfig: snpCoverageTrackConfigSchema,
    },
    { baseConfiguration: BaseTrackConfig, explicitlyTyped: true },
  )
}
