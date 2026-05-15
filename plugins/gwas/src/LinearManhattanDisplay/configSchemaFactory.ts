import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { linearWiggleDisplayConfigSchema } from '@jbrowse/plugin-wiggle'

// Reuses LinearWiggleDisplay's configuration schema verbatim — every field
// (color, scaleType, autoscale, min/maxScore, etc.) comes from wiggle. Only
// the type name changes so MST registers a distinct display.
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
