import { ConfigurationSchema } from '@jbrowse/core/configuration'

export const baseLinearDisplayConfigSchema = ConfigurationSchema(
  'BaseLinearDisplay',
  {
    maxFeatureScreenDensity: {
      type: 'number',
      description:
        'maximum features per pixel that is displayed in the view, used if byte size estimates not available',
      defaultValue: 0.3,
    },
    fetchSizeLimit: {
      type: 'number',
      defaultValue: 1_000_000,
      description:
        "maximum data to attempt to download for a given track, used if adapter doesn't specify one",
    },
  },
  { explicitIdentifier: 'displayId' },
)
