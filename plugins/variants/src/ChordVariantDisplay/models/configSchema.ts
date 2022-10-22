import { ConfigurationSchema } from '@jbrowse/core/configuration'
import PluginManager from '@jbrowse/core/PluginManager'
import { baseChordDisplayConfig } from '@jbrowse/plugin-circular-view'
import { types } from 'mobx-state-tree'

/**
 * #config ChordVariantDisplay
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

function stateModelFactory(pluginManager: PluginManager) {
  return ConfigurationSchema(
    'ChordVariantDisplay',
    {
      /**
       * #slot
       */
      renderer: types.optional(
        pluginManager.pluggableConfigSchemaType('renderer'),
        { type: 'StructuralVariantChordRenderer' },
      ),
    },
    {
      /**
       * #baseConfiguration
       */
      baseConfiguration: baseChordDisplayConfig,
      explicitlyTyped: true,
    },
  )
}

export default stateModelFactory
