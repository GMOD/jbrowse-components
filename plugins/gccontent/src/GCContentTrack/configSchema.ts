import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { createBaseTrackConfig } from '@jbrowse/core/pluggableElementTypes'
import type PluginManager from '@jbrowse/core/PluginManager'

/**
 * #config GCContentTrack
 * used for having a gc content track outside of the "reference sequence display"
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

const configSchema = (pluginManager: PluginManager) =>
  ConfigurationSchema(
    'GCContentTrack',
    {},
    {
      /**
       * #baseConfiguration
       */
      baseConfiguration: createBaseTrackConfig(pluginManager),
    },
  )

export default configSchema
