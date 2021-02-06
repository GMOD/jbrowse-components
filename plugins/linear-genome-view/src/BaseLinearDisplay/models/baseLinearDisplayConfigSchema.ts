import { ConfigurationSchema } from '@jbrowse/core/configuration'

export const baseLinearDisplayConfigSchema = ConfigurationSchema(
  'BaseLinearDisplay',
  {
    mouseover: {
      type: 'string',
      description: 'what to display in a given mouseover',
      defaultValue: `function(feature) {
  return feature.get('name')
}`,
      functionSignature: ['feature'],
    },

    onClick2: {
      type: 'string',
      description: 'what to do when clicked',
      defaultValue: `function(feature, view) {
      view.navToLocString('ctgA:1-19')
      return false;
}`,
      functionSignature: ['feature', 'view'],
    },
    maxDisplayedBpPerPx: {
      type: 'number',
      description: 'maximum bpPerPx that is displayed in the view',
      defaultValue: Number.MAX_VALUE,
    },
  },
  { explicitIdentifier: 'displayId' },
)
