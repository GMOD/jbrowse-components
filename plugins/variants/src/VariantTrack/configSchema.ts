import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { createBaseTrackConfig } from '@jbrowse/core/pluggableElementTypes'
import PluginManager from '@jbrowse/core/PluginManager'

const configSchema = (pluginManager: PluginManager) =>
  ConfigurationSchema(
    'VariantTrack',
    {},
    { baseConfiguration: createBaseTrackConfig(pluginManager) },
  )

export default configSchema
