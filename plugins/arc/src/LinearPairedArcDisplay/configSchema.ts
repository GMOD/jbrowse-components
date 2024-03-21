import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { baseLinearDisplayConfigSchema } from '@jbrowse/plugin-linear-genome-view'

/**
 * #config LinearPairedArcDisplay
 */
export function configSchemaFactory() {
  return ConfigurationSchema(
    'LinearPairedArcDisplay',
    {
      /**
       * #slot
       */
      color: {
        contextVariable: ['feature', 'alt'],
        defaultValue: 'jexl:defaultPairedArcColor(feature,alt)',
        description: 'the color of the arcs',
        type: 'color',
      },
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
