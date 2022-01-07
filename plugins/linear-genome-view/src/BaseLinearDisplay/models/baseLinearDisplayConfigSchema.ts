import { ConfigurationSchema } from '@jbrowse/core/configuration'

export const baseLinearDisplayConfigSchema = ConfigurationSchema(
  'BaseLinearDisplay',
  {
    maxFeatureScreenDensity: {
      type: 'number',
      description: 'maximum features per pixel that is displayed in the view',
      defaultValue: 0.5,
    },
    maxAllowableBytes: {
      type: 'number',
      defaultValue: 1_000,
      description: 'maximum data to attempt to download for a given track',
    },
  },
  { explicitIdentifier: 'displayId' },
)
