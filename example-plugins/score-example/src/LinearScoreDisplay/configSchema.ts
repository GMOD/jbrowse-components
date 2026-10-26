// #exampleFile shared | config slots (encoding.color, encoding.y)
import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config LinearScoreDisplay
 * Config for the worked-example score display. Attaches to any `FeatureTrack`.
 */
export const configSchema = ConfigurationSchema(
  'LinearScoreDisplay',
  {
    /**
     * #slot
     */
    height: {
      type: 'number',
      defaultValue: 100,
      description: 'height of the display in pixels',
    },
    /**
     * #slot
     * The channels each box paints through, spelled as the built-in
     * displays spell theirs: `color.value` fills every box, and `y.field`
     * names the feature attribute read as the box height.
     */
    encoding: ConfigurationSchema('LinearScoreEncoding', {
      color: ConfigurationSchema('LinearScoreColor', {
        /**
         * #slot encoding.color.value
         */
        value: {
          type: 'color',
          defaultValue: '#0068d1',
          description: 'fill color for every score box',
        },
      }),
      y: ConfigurationSchema('LinearScoreY', {
        /**
         * #slot encoding.y.field
         */
        field: {
          type: 'string',
          defaultValue: 'score',
          description:
            'feature attribute read as the score (box height); normalized per region',
        },
      }),
    }),
  },
  { explicitIdentifier: 'displayId', explicitlyTyped: true },
)

export type LinearScoreDisplayConfigModel = typeof configSchema
