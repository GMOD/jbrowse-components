import { ConfigurationSchema } from '@jbrowse/core/configuration'

export const baseLinearDisplayConfigSchema = ConfigurationSchema(
  'BaseLinearDisplay',
  {
    mouseover: {
      type: 'string',
      description: 'what to display in a given mouseover',
      //       defaultValue: `function(feature) {
      //   return feature.get('name')
      // }`,
      defaultValue: `jexl:getFeatureData(feature, 'name')`,

      functionSignature: ['feature'],
    },
    maxDisplayedBpPerPx: {
      type: 'number',
      description: 'maximum bpPerPx that is displayed in the view',
      defaultValue: Number.MAX_VALUE,
    },
  },
  { explicitIdentifier: 'displayId' },
)
