import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config LinearSyntenyAxis
 * #category view
 * The linear synteny view's `axis`: each row's ruler, whose ticks `grid`
 * carries down through the ribbons to the coordinates they pair with on the
 * row below, so a ribbon's shear and stretch show.
 *
 * #example
 * ```js
 * { type: 'LinearSyntenyView', axis: { grid: true } }
 * ```
 */
export const linearSyntenyAxisConfigSchema = ConfigurationSchema(
  'LinearSyntenyAxis',
  {
    /**
     * #slot
     */
    grid: {
      type: 'boolean',
      defaultValue: false,
      description: "carry each row's ruler ticks down through the ribbons",
    },
  },
  { closed: true },
)
