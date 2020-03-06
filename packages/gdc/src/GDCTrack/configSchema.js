import { ConfigurationSchema } from '@gmod/jbrowse-core/configuration'
import { BaseTrackConfig as LinearGenomeTrackConfig } from '@gmod/jbrowse-plugin-linear-genome-view'
import { types } from 'mobx-state-tree'

export default pluginManager => {
  return ConfigurationSchema(
    'GDCTrack',
    {
      adapter: pluginManager.pluggableConfigSchemaType('adapter'),
      renderer: pluginManager.pluggableConfigSchemaType('renderer'),
    },
    { baseConfiguration: LinearGenomeTrackConfig, explicitlyTyped: true },
  )
}
