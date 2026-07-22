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
     */
    color: {
      type: 'color',
      defaultValue: '#0068d1',
      description: 'fill color for every score box',
    },
    /**
     * #slot
     * feature attribute read as the score (box height); normalized per region
     */
    scoreColumn: {
      type: 'string',
      defaultValue: 'score',
      description: 'feature attribute used as the score',
    },
  },
  { explicitIdentifier: 'displayId', explicitlyTyped: true },
)

export type LinearScoreDisplayConfigModel = typeof configSchema
