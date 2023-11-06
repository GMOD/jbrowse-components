import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { baseLinearDisplayConfigSchema } from '@jbrowse/plugin-linear-genome-view'

/**
 * #config LinearArcDisplay
 */
export function configSchemaFactory(name: string) {
  return ConfigurationSchema(
    name,
    {
      /**
       * #slot
       */
      color: {
        type: 'color',
        description: 'the color of the arcs',
        defaultValue: 'jexl:defaultPairedArcColor(feature,alt)',
        contextVariable: ['feature', 'alt'],
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
