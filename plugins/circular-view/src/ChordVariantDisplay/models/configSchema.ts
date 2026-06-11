import { ConfigurationSchema } from '@jbrowse/core/configuration'

import type PluginManager from '@jbrowse/core/PluginManager'

/**
 * #config ChordVariantDisplay
 */

function configSchemaF(_pluginManager: PluginManager) {
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
      strokeColor: {
        type: 'color',
        description: 'the line color of each arc',
        defaultValue: 'rgba(255,133,0,0.32)',
        contextVariable: ['feature'],
      },
      /**
       * #slot
       */
      strokeColorSelected: {
        type: 'color',
        description: 'the line color of an arc that has been selected',
        defaultValue: 'black',
        contextVariable: ['feature'],
      },
      /**
       * #slot
       */
      strokeColorHover: {
        type: 'color',
        description:
          'the line color of an arc that is being hovered over with the mouse',
        defaultValue: '#555',
        contextVariable: ['feature'],
      },
    },
    {
      explicitIdentifier: 'displayId',
      explicitlyTyped: true,
      preProcessSnapshot: (snap: Record<string, unknown>) => {
        const { renderer, ...rest } = snap
        if (renderer && typeof renderer === 'object') {
          const r = renderer as Record<string, unknown>
          return {
            ...rest,
            ...(r.strokeColor !== undefined
              ? { strokeColor: r.strokeColor }
              : {}),
            ...(r.strokeColorSelected !== undefined
              ? { strokeColorSelected: r.strokeColorSelected }
              : {}),
            ...(r.strokeColorHover !== undefined
              ? { strokeColorHover: r.strokeColorHover }
              : {}),
          }
        }
        return snap
      },
    },
  )
}

export default configSchemaF
