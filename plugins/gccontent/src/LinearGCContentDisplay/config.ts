import { ConfigurationSchema } from '@jbrowse/core/configuration'
import PluginManager from '@jbrowse/core/PluginManager'

/**
 * #config LinearGCContentDisplay
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

export default function WiggleConfigFactory(pluginManager: PluginManager) {
  const baseConfiguration = pluginManager.getDisplayType(
    'LinearWiggleDisplay',
  ).configSchema

  return ConfigurationSchema(
    'LinearGCContentDisplay',
    {},
    { baseConfiguration, explicitlyTyped: true },
  )
}
