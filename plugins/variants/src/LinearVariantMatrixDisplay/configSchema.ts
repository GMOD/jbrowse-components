import { ConfigurationSchema } from '@jbrowse/core/configuration'
import PluginManager from '@jbrowse/core/PluginManager'
import { linearBasicDisplayConfigSchemaFactory } from '@jbrowse/plugin-linear-genome-view'

// locals
import configSchema from '../LinearVariantMatrixRenderer/configSchema'

/**
 * #config LinearVariantMatrixDisplay
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

export default function configSchemaF(pluginManager: PluginManager) {
  return ConfigurationSchema(
    'LinearVariantMatrixDisplay',
    {
      renderer: configSchema,
    },
    {
      /**
       * #baseConfiguration
       */
      baseConfiguration: linearBasicDisplayConfigSchemaFactory(pluginManager),
      explicitlyTyped: true,
    },
  )
}
