import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { linearWiggleDisplayConfigSchema } from '@jbrowse/plugin-wiggle'

// Reuses LinearWiggleDisplay's schema; only the type name differs.
export function configSchemaFactory() {
  return ConfigurationSchema(
    'LinearManhattanDisplay',
    {},
    {
      baseConfiguration: linearWiggleDisplayConfigSchema,
      explicitlyTyped: true,
    },
  )
}
