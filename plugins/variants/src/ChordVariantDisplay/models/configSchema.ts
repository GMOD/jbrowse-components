import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'
import { baseChordDisplayConfig } from '@jbrowse/plugin-circular-view'

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
