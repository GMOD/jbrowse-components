import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { linearWiggleDisplayConfigSchema } from '@jbrowse/plugin-wiggle'

// Reuses LinearWiggleDisplay's schema, but overrides `color` so we don't
// inherit wiggle's bicolor sentinel (`#f0f`). Manhattan is single-color and
// supports per-feature jexl callbacks.
export function configSchemaFactory() {
  return ConfigurationSchema(
    'LinearManhattanDisplay',
    {
      color: {
        type: 'color',
        defaultValue: '#0068d1',
        description: 'CSS color or jexl callback for Manhattan points',
      },
    },
    {
      baseConfiguration: linearWiggleDisplayConfigSchema,
      explicitlyTyped: true,
    },
  )
}
