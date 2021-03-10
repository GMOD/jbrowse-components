import { ConfigurationSchema } from '@jbrowse/core/configuration'

export const baseLinearDisplayConfigSchema = ConfigurationSchema(
  'BaseLinearDisplay',
  {
    maxDisplayedBpPerPx: {
      type: 'number',
      description: 'maximum bpPerPx that is displayed in the view',
      defaultValue: Number.MAX_VALUE,
    },
  },
  { explicitIdentifier: 'displayId' },
)
