import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { BaseTrackConfig as LinearGenomeTrackConfig } from '@jbrowse/plugin-linear-genome-view'
import { Instance } from 'mobx-state-tree'
import PluginManager from '@jbrowse/core/PluginManager'

const HicTrackConfigFactory = (pluginManager: PluginManager) => {
  const HicRendererConfigSchema = pluginManager.getRendererType('HicRenderer')
    .configSchema

  return ConfigurationSchema(
    'HicTrack',
    {
      adapter: pluginManager.pluggableConfigSchemaType('adapter'),
      renderer: HicRendererConfigSchema,
    },
    { baseConfiguration: LinearGenomeTrackConfig, explicitlyTyped: true },
  )
}

export type HicTrackConfigModel = ReturnType<typeof HicTrackConfigFactory>
export type HicTrackConfig = Instance<HicTrackConfigModel>
export default HicTrackConfigFactory
