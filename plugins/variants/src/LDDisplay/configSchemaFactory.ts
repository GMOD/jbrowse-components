import { ConfigurationSchema } from '@jbrowse/core/configuration'

import sharedLDConfigFactory from './SharedLDConfigSchema.ts'
import ldRendererConfigSchema from '../LDRenderer/configSchema.ts'

export function makeLDDisplayConfigSchema(typeName: string) {
  return ConfigurationSchema(
    typeName,
    {
      /**
       * #slot
       * LDRenderer
       */
      renderer: ldRendererConfigSchema,
      /**
       * #slot
       */
      height: {
        type: 'number',
        defaultValue: 400,
      },
    },
    {
      /**
       * #baseConfiguration
       */
      baseConfiguration: sharedLDConfigFactory(),
      explicitlyTyped: true,
    },
  )
}
