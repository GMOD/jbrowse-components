import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { baseLinearDisplayConfigSchema } from '@jbrowse/plugin-linear-genome-view'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { Instance } from 'mobx-state-tree'

/**
 * #config LinearHicDisplay
 * #category display
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

const HicTrackConfigFactory = (pluginManager: PluginManager) => {
  return ConfigurationSchema(
    'LinearHicDisplay',
    {
      /**
       * #slot
       */
      renderer: pluginManager.getRendererType('HicRenderer')!.configSchema,
    },
    {
      /**
       * #baseConfiguration
       */
      baseConfiguration: baseLinearDisplayConfigSchema,
      explicitlyTyped: true,
    },
  )
}

export type HicTrackConfigModel = ReturnType<typeof HicTrackConfigFactory>
export type HicTrackConfig = Instance<HicTrackConfigModel>
export default HicTrackConfigFactory
