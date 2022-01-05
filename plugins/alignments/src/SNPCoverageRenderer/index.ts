import { ConfigurationSchema } from '@jbrowse/core/configuration'
import ConfigSchema from './configSchema'
import PluginManager from '@jbrowse/core/PluginManager'
import SNPCoverageRenderer from './SNPCoverageRenderer'

import { WiggleRendering } from '@jbrowse/plugin-wiggle'

export const configSchema = ConfigurationSchema(
  'SNPCoverageRenderer',
  {},
  { baseConfiguration: ConfigSchema, explicitlyTyped: true },
)

export default function register(pluginManager: PluginManager) {
  pluginManager.addRendererType(
    () =>
      new SNPCoverageRenderer({
        name: 'SNPCoverageRenderer',
        ReactComponent: WiggleRendering,
        configSchema,
        pluginManager,
      }),
  )
}
