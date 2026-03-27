import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { createBaseTrackConfig } from '@jbrowse/core/pluggableElementTypes/models'

import type PluginManager from '@jbrowse/core/PluginManager'

const configSchema = (pluginManager: PluginManager) =>
  ConfigurationSchema(
    'MultiSyntenyTrack',
    {},
    {
      baseConfiguration: createBaseTrackConfig(pluginManager),
    },
  )

export default configSchema
