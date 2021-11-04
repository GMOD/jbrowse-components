import { ConfigurationSchema } from '@jbrowse/core/configuration'

export const baseLinearDisplayConfigSchema = ConfigurationSchema(
  'BaseLinearDisplay',
  {
    maxFeatureScreenDensity: {
      type: 'number',
      description: 'maximum features per pixel that is displayed in the view',
      defaultValue: 0.5,
    },
  },
  { explicitIdentifier: 'displayId' },
)
