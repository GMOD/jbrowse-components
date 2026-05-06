import { ConfigurationSchema } from '@jbrowse/core/configuration'

import { baseLinearDisplayConfigSchema } from '../BaseLinearDisplay/index.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

/**
 * #config LinearBasicDisplay
 * #category display
 * the default display for feature tracks in the linear genome view; renders
 * features using the SvgFeatureRenderer (now CanvasFeatureRenderer)
 */
function configSchemaFactory(pluginManager: PluginManager) {
  return ConfigurationSchema(
    'LinearBasicDisplay',
    {
      /**
       * #slot
       */
      renderer: pluginManager.pluggableConfigSchemaType('renderer'),
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

export default configSchemaFactory
