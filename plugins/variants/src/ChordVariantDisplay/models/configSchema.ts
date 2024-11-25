import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { baseChordDisplayConfig } from '@jbrowse/plugin-circular-view'
import { types } from 'mobx-state-tree'
import type PluginManager from '@jbrowse/core/PluginManager'

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
