import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config SyntenyOffscreen
 * #category view
 * The linear synteny view's `offscreen` part: a mark along each edge of a
 * band for every alignment whose other end lies where the facing row is not
 * looking, which a click follows there.
 *
 * #example
 * ```js
 * { type: 'LinearSyntenyView', offscreen: { show: false } }
 * ```
 */
export const syntenyOffscreenConfigSchema = ConfigurationSchema(
  'SyntenyOffscreen',
  {
    /**
     * #slot
     */
    show: {
      type: 'boolean',
      defaultValue: true,
      description:
        'draw the marks; off also skips the second query per pair of rows they cost',
    },
  },
  { closed: true },
)
