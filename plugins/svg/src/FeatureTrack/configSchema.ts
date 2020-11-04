import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { BaseTrackConfig } from '@jbrowse/plugin-linear-genome-view'

export default ConfigurationSchema(
  'FeatureTrack',
  {},
  { explicitlyTyped: true, baseConfiguration: BaseTrackConfig },
)
