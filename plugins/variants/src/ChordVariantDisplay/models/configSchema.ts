import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

import type PluginManager from '@jbrowse/core/PluginManager'

/**
 * #config ChordVariantDisplay
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

function configSchemaF(pluginManager: PluginManager) {
  return ConfigurationSchema(
    'ChordVariantDisplay',
    {
      /**
       * #slot
       */
      onChordClick: {
        type: 'boolean',
        description:
          'callback that should be run when a chord in the track is clicked',
        defaultValue: false,
        contextVariable: ['feature', 'track', 'pluginManager'],
      },
      /**
       * #slot
       */
      renderer: types.optional(
        pluginManager.pluggableConfigSchemaType('renderer'),
        { type: 'StructuralVariantChordRenderer' },
      ),
    },
    {
      explicitIdentifier: 'displayId',
      explicitlyTyped: true,
    },
  )
}

export default configSchemaF
