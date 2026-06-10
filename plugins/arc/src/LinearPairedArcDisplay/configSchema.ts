import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { baseLinearDisplayConfigSchema } from '@jbrowse/plugin-linear-genome-view'

import type { Instance } from '@jbrowse/mobx-state-tree'

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

export type LinearPairedArcDisplayConfigModel = ReturnType<
  typeof configSchemaFactory
>
export type LinearPairedArcDisplayConfig =
  Instance<LinearPairedArcDisplayConfigModel>
